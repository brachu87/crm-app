const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const prisma = require('../prisma');

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verifyGoogleToken(credential) {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
}

function makeToken(user) {
  return jwt.sign(
    { userId: user.id, businessId: user.businessId, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { businessName, category, name, email, password } = req.body;
    if (!businessName || !name || !email || !password) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'El email ya está registrado' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const business = await prisma.business.create({ data: { name: businessName, category: category || 'otro' } });
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name, role: 'owner', businessId: business.id },
    });

    res.status(201).json({
      token: makeToken(user),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      business: { id: business.id, name: business.name, category: business.category },
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
    if (!user.business.approved) return res.status(403).json({ error: 'Tu cuenta está pendiente de aprobación. Te avisaremos cuando esté activa.' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

    res.json({
      token: makeToken(user),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
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
    if (!user.business.approved) {
      return res.status(403).json({ error: 'Tu cuenta está pendiente de aprobación. Te avisaremos cuando esté activa.' });
    }

    res.json({
      token: makeToken(user),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
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
    const { credential, businessName, category } = req.body;
    if (!credential || !businessName) return res.status(400).json({ error: 'Faltan datos' });

    const payload = await verifyGoogleToken(credential);
    const { email, name } = payload;

    // Si ya existe, simplemente loguear
    const existing = await prisma.user.findUnique({ where: { email }, include: { business: true } });
    if (existing) {
      return res.json({
        token: makeToken(existing),
        user: { id: existing.id, name: existing.name, email: existing.email, role: existing.role },
        business: { id: existing.business.id, name: existing.business.name, category: existing.business.category },
      });
    }

    const business = await prisma.business.create({ data: { name: businessName, category: category || 'otro' } });
    const user = await prisma.user.create({
      data: { email, password: null, name, role: 'owner', businessId: business.id },
    });

    res.status(201).json({
      token: makeToken(user),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      business: { id: business.id, name: business.name, category: business.category },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar con Google' });
  }
});

module.exports = router;
