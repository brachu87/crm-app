const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const prisma = require('../prisma');

const router = express.Router();

// Input sanitization helper
function sanitize(val, maxLen = 200) {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

function validateEmail(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verifyGoogleToken(credential) {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
}

function parsePerms(user) {
  try { return user.permissions ? JSON.parse(user.permissions) : null; } catch { return null; }
}

function makeToken(user) {
  return jwt.sign(
    { userId: user.id, businessId: user.businessId, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}


// Check if business is approved (uses raw SQL, safe if column doesn't exist yet)
async function isBusinessApproved(businessId) {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT approved FROM "Business" WHERE id = ?`, businessId
    );
    if (!rows.length) return true; // no row = allow
    const val = rows[0].approved;
    if (val === undefined || val === null) return true; // column missing = allow
    return val === 1 || val === true;
  } catch {
    return true; // column doesn't exist yet = allow
  }
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { businessName, category, name, email, password, businessPhone } = req.body;
    // Sanitize inputs
    const sBusinessName = sanitize(businessName, 100);
    const sName = sanitize(name, 100);
    const sEmail = sanitize(email, 200).toLowerCase();
    const sCategory = sanitize(category, 50);
    const sPhone = sanitize(businessPhone || '', 30);

    if (!sBusinessName || !sName || !sEmail || !password) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    if (!validateEmail(sEmail)) return res.status(400).json({ error: 'Email inválido' });
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    const existing = await prisma.user.findUnique({ where: { email: sEmail } });
    if (existing) return res.status(409).json({ error: 'El email ya está registrado' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const business = await prisma.business.create({ data: { name: businessName, category: category || 'otro', phone: sPhone || null } });

    // Nueva cuenta empieza como pendiente de aprobación
    try { await prisma.$executeRawUnsafe(`UPDATE "Business" SET approved = 0 WHERE id = ?`, business.id); } catch (_) {}

    const user = await prisma.user.create({
      data: { email: sEmail, password: hashedPassword, name: sName, role: 'owner', businessId: business.id },
    });

    res.status(201).json({
      pending: true,
      message: 'Tu cuenta fue creada y está pendiente de aprobación. Te contactaremos por WhatsApp para habilitarte el acceso.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Faltan email o password' });

    const user = await prisma.user.findUnique({ where: { email }, include: { business: true } });
    if (!user || !user.password) return res.status(401).json({ error: 'Credenciales inválidas' });


    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

    const approved = await isBusinessApproved(user.businessId);
    if (!approved) return res.status(403).json({ error: 'Tu cuenta está pendiente de aprobación. Contactá al administrador.' });

    // Update last access timestamp
    await prisma.user.update({ where: { id: user.id }, data: { lastAccessAt: new Date() } }).catch(() => {});

    res.json({
      token: makeToken(user),
      user: { id: user.id, name: user.name, email: user.email, role: user.role, permissions: parsePerms(user) },
      business: { id: user.business.id, name: user.business.name, category: user.business.category },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// POST /api/auth/google
// Si el usuario ya existe → login. Si no → devuelve needsRegister con datos de Google.
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Token requerido' });

    const payload = await verifyGoogleToken(credential);
    const { email, name } = payload;

    const user = await prisma.user.findUnique({ where: { email }, include: { business: true } });

    if (!user) {
      return res.json({ needsRegister: true, email, name });
    }

    const approved = await isBusinessApproved(user.businessId);
    if (!approved) return res.status(403).json({ error: 'Tu cuenta está pendiente de aprobación. Contactá al administrador.' });

    res.json({
      token: makeToken(user),
      user: { id: user.id, name: user.name, email: user.email, role: user.role, permissions: parsePerms(user) },
      business: { id: user.business.id, name: user.business.name, category: user.business.category },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al autenticar con Google' });
  }
});

// POST /api/auth/google-register
// Verifica token de Google + recibe businessName + category y crea la cuenta.
router.post('/google-register', async (req, res) => {
  try {
    const { credential, businessName, category, businessPhone } = req.body;
    if (!credential || !businessName) return res.status(400).json({ error: 'Faltan datos' });
    const sPhone = sanitize(businessPhone || '', 30);

    const payload = await verifyGoogleToken(credential);
    const { email, name } = payload;

    // Si ya existe un usuario con ese email, simplemente loguear
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      const biz = await prisma.business.findUnique({ where: { id: existing.businessId } });
      return res.json({
        token: makeToken(existing),
        user: { id: existing.id, name: existing.name, email: existing.email, role: existing.role, permissions: parsePerms(existing) },
        business: { id: biz.id, name: biz.name, category: biz.category },
      });
    }

    // Crear business + user en una transacción para que sean atómicos
    const { business } = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({ data: { name: businessName, category: category || 'otro', phone: sPhone || null } });
      await tx.user.create({
        data: { email, password: '', name, role: 'owner', businessId: business.id },
      });
      return { business };
    });

    // Marcar como pendiente de aprobación (raw SQL fuera de transacción es OK)
    try {
      await prisma.$executeRawUnsafe(`UPDATE "Business" SET approved = 0 WHERE id = ?`, business.id);
    } catch (_) { /* columna no existe aún */ }

    res.status(201).json({
      pending: true,
      message: 'Tu cuenta fue creada y está pendiente de aprobación. Te contactaremos por WhatsApp para habilitarte el acceso.',
    });
  } catch (err) {
    console.error('[google-register error]', err);
    res.status(500).json({ error: 'Error al registrar con Google: ' + err.message });
  }
});

// GET /api/auth/me — refresca datos del usuario actual (incluye permissions)
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Sin token' });
  try {
    const jwt = require('jsonwebtoken');
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { business: true },
    });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, permissions: parsePerms(user) },
      business: { id: user.business.id, name: user.business.name, category: user.business.category },
    });
  } catch (e) {
    res.status(401).json({ error: 'Token inválido' });
  }
});

module.exports = router;
