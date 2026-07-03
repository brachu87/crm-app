const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const prisma = require('../prisma');
const { sendPasswordResetEmail, sendWelcomeEmail } = require('../lib/mailer');

const router = express.Router();
const validate = require('../lib/validate');
const schemas = require('../schemas');

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
    { expiresIn: '8h' }
  );
}


// Check if business is approved (uses raw SQL, safe if column doesn't exist yet)
async function isBusinessApproved(businessId) {
  try {
    const biz = await prisma.business.findUnique({
      where: { id: businessId },
      select: { approved: true },
    });
    if (!biz) return true; // no row = allow
    if (biz.approved === undefined || biz.approved === null) return true;
    return biz.approved === true || biz.approved === 1;
  } catch {
    return true; // fail-open
  }
}

// POST /api/auth/register
router.post('/register', validate(schemas.register), async (req, res) => {
  try {
    const { businessName, category, name, email, password, businessPhone } = req.body;
    // Sanitize inputs
    const sBusinessName = sanitize(businessName, 100);
    const sName = sanitize(name, 100);
    const sEmail = sanitize(email, 200).toLowerCase();
    const sCategory = sanitize(category, 50);
    const sPhone = sanitize(businessPhone || '', 30);

    if (!sBusinessName || !sName || !sEmail || !password || !sPhone) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    if (!validateEmail(sEmail)) return res.status(400).json({ error: 'Email inválido' });
    if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

    const existing = await prisma.user.findUnique({ where: { email: sEmail } });
    if (existing) return res.status(409).json({ error: 'El email ya está registrado' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const business = await prisma.business.create({ data: { name: businessName, category: category || 'otro', phone: sPhone || null } });

    // Auto-approve: la cuenta empieza con acceso inmediato en período de prueba
    try { await prisma.business.update({ where: { id: business.id }, data: { approved: true } }); } catch (_) {}

    const user = await prisma.user.create({
      data: { email: sEmail, password: hashedPassword, name: sName, role: 'owner', businessId: business.id },
    });

    // Mail de bienvenida (no bloqueante)
    sendWelcomeEmail({ toEmail: sEmail, toName: sName, businessName: sBusinessName }).catch(() => {});

    res.status(201).json({
      token: makeToken(user),
      user: { id: user.id, name: user.name, email: user.email, role: user.role, permissions: null },
      business: { id: business.id, name: business.name, category: business.category, enabledModules: business.enabledModules || null },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar' });
  }
});

// POST /api/auth/login
router.post('/login', validate(schemas.login), async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Faltan email o password' });

    const user = await prisma.user.findUnique({ where: { email }, include: { business: true } });
    if (!user || !user.password) return res.status(401).json({ error: 'Credenciales inválidas' });


    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

    const approved = await isBusinessApproved(user.businessId);
    if (!approved) return res.status(403).json({ error: 'Tu período de prueba venció. Suscribite en Ajustes → Facturación para continuar.' });

    // Check subscription status
    if (user.business.subscriptionStatus === 'expired' && !user.business.bonificado) {
      return res.status(403).json({ error: 'Tu período de prueba venció. Suscribite en Ajustes → Facturación para continuar.' });
    }

    // Update last access timestamp
    await prisma.user.update({ where: { id: user.id }, data: { lastAccessAt: new Date() } }).catch(() => {});

    res.json({
      token: makeToken(user),
      user: { id: user.id, name: user.name, email: user.email, role: user.role, permissions: parsePerms(user) },
      business: { id: user.business.id, name: user.business.name, category: user.business.category, enabledModules: user.business.enabledModules || null },
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
    if (!approved) return res.status(403).json({ error: 'Tu período de prueba venció. Suscribite en Ajustes → Facturación para continuar.' });

    if (user.business.subscriptionStatus === 'expired' && !user.business.bonificado) {
      return res.status(403).json({ error: 'Tu período de prueba venció. Suscribite en Ajustes → Facturación para continuar.' });
    }

    res.json({
      token: makeToken(user),
      user: { id: user.id, name: user.name, email: user.email, role: user.role, permissions: parsePerms(user) },
      business: { id: user.business.id, name: user.business.name, category: user.business.category, enabledModules: user.business.enabledModules || null },
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
        business: { id: biz.id, name: biz.name, category: biz.category, enabledModules: biz.enabledModules || null },
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

    // Auto-approve: acceso inmediato con período de prueba
    try {
      await prisma.business.update({ where: { id: business.id }, data: { approved: true } });
    } catch (_) { /* ignore */ }

    const newUser = await prisma.user.findUnique({ where: { email }, include: { business: true } });

    // Mail de bienvenida (no bloqueante)
    sendWelcomeEmail({ toEmail: email, toName: name || '', businessName }).catch(() => {});

    res.status(201).json({
      token: makeToken(newUser),
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, permissions: null },
      business: { id: business.id, name: business.name, category: business.category, enabledModules: business.enabledModules || null },
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
      business: { id: user.business.id, name: user.business.name, category: user.business.category, enabledModules: user.business.enabledModules || null },
    });
  } catch (e) {
    res.status(401).json({ error: 'Token inválido' });
  }
});

// POST /api/auth/forgot-password  — envía email con enlace para restablecer
router.post('/forgot-password', async (req, res) => {
  try {
    const email = sanitize(req.body.email).toLowerCase();
    if (!validateEmail(email)) return res.status(400).json({ error: 'Email inválido' });
    const user = await prisma.user.findFirst({ where: { email } });
    if (user) {
      const secret = process.env.JWT_SECRET + (user.password || '');
      const token = jwt.sign({ uid: user.id, k: 'pwreset' }, secret, { expiresIn: '1h' });
      const base = (process.env.APP_URL || 'https://app.gestumio.com').replace(/\/$/, '');
      const resetUrl = `${base}/restablecer?token=${encodeURIComponent(token)}`;
      sendPasswordResetEmail({ toEmail: user.email, toName: user.name || '', resetUrl }).catch(() => {});
    }
    // Respuesta uniforme: no revelar si el email existe
    res.json({ ok: true });
  } catch (e) {
    console.error('[forgot-password]', e.message);
    res.status(500).json({ error: 'Error' });
  }
});

// POST /api/auth/reset-password  — setea la nueva contraseña con el token del email
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Faltan datos' });
    if (String(password).length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.uid || decoded.k !== 'pwreset') return res.status(400).json({ error: 'Enlace inválido' });
    const user = await prisma.user.findUnique({ where: { id: decoded.uid } });
    if (!user) return res.status(400).json({ error: 'Enlace inválido' });
    const secret = process.env.JWT_SECRET + (user.password || '');
    try { jwt.verify(token, secret); }
    catch { return res.status(400).json({ error: 'El enlace expiró o ya fue usado. Pedí uno nuevo.' }); }
    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
    res.json({ ok: true });
  } catch (e) {
    console.error('[reset-password]', e.message);
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
