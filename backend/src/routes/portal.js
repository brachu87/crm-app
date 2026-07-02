/**
 * Portal del socio (clientes de los negocios).
 * Login con número de socio (usuario) + DNI (contraseña inicial).
 * Token propio (k:'portal', cid=clientId), separado del token de la app.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

const router = express.Router();

function portalAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t) return res.status(401).json({ error: 'No autorizado' });
  try {
    const d = jwt.verify(t, process.env.JWT_SECRET);
    if (d.k !== 'portal' || !d.cid) return res.status(401).json({ error: 'Token inválido' });
    req.socioId = d.cid;
    next();
  } catch { return res.status(401).json({ error: 'Sesión vencida' }); }
}

// POST /api/portal/login  { memberNumber, password }
router.post('/login', async (req, res) => {
  try {
    const memberNumber = String(req.body.memberNumber || '').trim();
    const password = String(req.body.password || '');
    if (!memberNumber || !password) return res.status(400).json({ error: 'Ingresá tu número de socio y contraseña' });

    const client = await prisma.client.findUnique({
      where: { memberNumber },
      include: { business: { select: { name: true } } },
    });
    if (!client) return res.status(401).json({ error: 'Número de socio o contraseña incorrectos' });

    let valid = false;
    if (client.portalPassword) valid = await bcrypt.compare(password, client.portalPassword);
    else valid = !!client.dni && password === client.dni; // primera vez: la contraseña es el DNI

    if (!valid) return res.status(401).json({ error: 'Número de socio o contraseña incorrectos' });
    if (client.active === false) return res.status(403).json({ error: 'Tu cuenta está inactiva. Contactá al negocio.' });

    const token = jwt.sign({ cid: client.id, k: 'portal' }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({
      token,
      client: { name: client.name, memberNumber: client.memberNumber, businessName: client.business?.name || '' },
      mustChangePassword: !client.portalPassword, // sigue usando el DNI
    });
  } catch (e) { console.error('[portal-login]', e.message); res.status(500).json({ error: 'Error' }); }
});

// GET /api/portal/me — resumen de cuenta + actividades
router.get('/me', portalAuth, async (req, res) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: req.socioId },
      include: {
        business: { select: { name: true } },
        enrollments: {
          include: {
            activity: { select: { name: true, price: true } },
            cuotas: { include: { payments: true }, orderBy: { period: 'desc' } },
          },
        },
        accountMovements: { orderBy: { date: 'desc' } },
      },
    });
    if (!client) return res.status(404).json({ error: 'No encontrado' });

    const appointments = await prisma.appointment.findMany({
      where: { clientId: client.id, status: 'completed' },
      include: { service: { select: { name: true } } },
      orderBy: { date: 'desc' },
    });

    const allCuotas = client.enrollments.flatMap((e) => e.cuotas);
    const totalCharged = allCuotas.reduce((s, c) => s + Math.max(0, c.amountDue - (c.discount || 0)), 0);
    const totalPaid    = allCuotas.reduce((s, c) => s + c.payments.reduce((p, pay) => p + pay.amount, 0), 0);
    const manualCargos = client.accountMovements.filter((m) => m.type === 'cargo').reduce((s, m) => s + m.amount, 0);
    const manualAbonos = client.accountMovements.filter((m) => m.type === 'abono').reduce((s, m) => s + m.amount, 0);
    const apptCharged  = appointments.reduce((s, a) => s + (a.price || 0), 0);
    const apptPaid     = appointments.filter((a) => a.paymentStatus === 'paid').reduce((s, a) => s + (a.price || 0), 0);
    const balance = totalCharged + manualCargos + apptCharged - totalPaid - manualAbonos - apptPaid;

    const activities = client.enrollments.map((e) => {
      const current = e.cuotas[0] || null;
      return {
        name: e.activity?.name || 'Actividad',
        amount: e.amountDue,
        status: current?.paymentStatus || 'pending',
        dueDate: current?.dueDate || null,
      };
    });

    res.json({
      name: client.name,
      memberNumber: client.memberNumber,
      dni: client.dni || null,
      businessName: client.business?.name || '',
      balance,
      activities,
      hasCustomPassword: !!client.portalPassword,
    });
  } catch (e) { console.error('[portal-me]', e.message); res.status(500).json({ error: 'Error' }); }
});

// POST /api/portal/change-password { newPassword }
router.post('/change-password', portalAuth, async (req, res) => {
  try {
    const newPassword = String(req.body.newPassword || '');
    if (newPassword.length < 4) return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
    await prisma.client.update({ where: { id: req.socioId }, data: { portalPassword: await bcrypt.hash(newPassword, 10) } });
    res.json({ ok: true });
  } catch (e) { console.error('[portal-pass]', e.message); res.status(500).json({ error: 'Error' }); }
});

module.exports = router;
