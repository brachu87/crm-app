const express = require('express');
const prisma = require('../prisma');
const { sendTest } = require('../lib/mailer');
const router = express.Router();

const TRIAL_DAYS = 15;
const BASE_PRICE = 50000;      // precio del plan base (incluye INCLUDED_USERS usuarios)
const EXTRA_USER_PRICE = 20000; // costo por cada usuario adicional
const INCLUDED_USERS = 3;      // usuarios incluidos en el plan base

function adminAuth(req, res, next) {
  const envSecret = process.env.ADMIN_SECRET;
  if (!envSecret || envSecret.length < 12) {
    // Block all access if secret is not configured or too weak
    return res.status(503).json({ error: 'Panel de admin no configurado' });
  }
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== envSecret) {
    // Slow down brute force attempts with a small delay
    return setTimeout(() => res.status(401).json({ error: 'No autorizado' }), 500);
  }
  next();
}

function trialDaysLeft(createdAt) {
  const created = new Date(createdAt);
  const expires = new Date(created.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  return Math.max(0, Math.ceil((expires - now) / (1000 * 60 * 60 * 24)));
}

// GET /api/admin/accounts
router.get('/accounts', adminAuth, async (req, res) => {
  try {
    // Prisma client (agnostico a la base) — evita el problema de alias en minuscula de Postgres
    const businesses = await prisma.business.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        users: {
          select: { id: true, name: true, email: true, role: true, lastAccessAt: true, createdAt: true },
        },
      },
    });

    const result = businesses.map(b => {
      const extra = b.extraUsers || 0;
      // Propietario: primero el rol owner; si no hay, el usuario mas antiguo
      const owner = b.users.find(u => u.role === 'owner')
        || [...b.users].sort((a, c) => new Date(a.createdAt || 0) - new Date(c.createdAt || 0))[0]
        || null;
      return {
        id: b.id,
        name: b.name,
        category: b.category,
        phone: b.phone || null,
        createdAt: b.createdAt,
        approved: b.approved === true,
        approvedAt: b.approvedAt,
        subscriptionStatus: b.subscriptionStatus || 'trial',
        subscriptionExpires: b.subscriptionExpires,
        bonificado: b.bonificado === true,
        userCount: b.users.length,
        waPhoneId: b.waPhoneId || null,
        waPhoneNumber: b.waPhoneNumber || null,
        extraUsers: extra,
        userLimit: INCLUDED_USERS + extra,
        monthlyPrice: BASE_PRICE + EXTRA_USER_PRICE * extra,
        trialDaysLeft: trialDaysLeft(b.createdAt),
        owner: owner ? { name: owner.name, email: owner.email, lastAccessAt: owner.lastAccessAt } : null,
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Admin accounts error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/accounts/:id/approve
router.put('/accounts/:id/approve', adminAuth, async (req, res) => {
  try {
    await prisma.business.update({
      where: { id: req.params.id },
      data: { approved: true, approvedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/accounts/:id/reject
router.put('/accounts/:id/reject', adminAuth, async (req, res) => {
  try {
    await prisma.business.update({
      where: { id: req.params.id },
      data: { approved: false, approvedAt: null },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/accounts/:id/bonificado
router.put('/accounts/:id/bonificado', adminAuth, async (req, res) => {
  try {
    const { bonificado } = req.body;
    await prisma.business.update({
      where: { id: req.params.id },
      data: {
        bonificado: !!bonificado,
        // Si se bonifica, activar la cuenta; si no, dejar el estado actual
        ...(bonificado ? { subscriptionStatus: 'active' } : {}),
      },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/accounts/:id/extend-trial — extiende trial 14 días más
router.put('/accounts/:id/extend-trial', adminAuth, async (req, res) => {
  try {
    await prisma.business.update({
      where: { id: req.params.id },
      data: { createdAt: new Date(), subscriptionStatus: 'trial' },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/accounts/:id/extra-users — setea usuarios adicionales (cada uno suma $20.000/mes)
router.put('/accounts/:id/extra-users', adminAuth, async (req, res) => {
  try {
    let n = parseInt(req.body.extraUsers, 10);
    if (isNaN(n) || n < 0) return res.status(400).json({ error: 'Cantidad de usuarios extra inválida' });
    if (n > 50) return res.status(400).json({ error: 'Máximo 50 usuarios extra' });
    await prisma.business.update({
      where: { id: req.params.id },
      data: { extraUsers: n },
    });
    res.json({ ok: true, extraUsers: n, userLimit: INCLUDED_USERS + n, monthlyPrice: BASE_PRICE + EXTRA_USER_PRICE * n });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/accounts/:id/whatsapp — asigna phone_number_id de Meta al negocio
router.put('/accounts/:id/whatsapp', adminAuth, async (req, res) => {
  try {
    const phoneId = (req.body.phoneId || '').toString().trim() || null;
    const phoneNumber = (req.body.phoneNumber || '').toString().trim() || null;
    await prisma.business.update({
      where: { id: req.params.id },
      data: { waPhoneId: phoneId, waPhoneNumber: phoneNumber },
    });
    res.json({ ok: true, waPhoneId: phoneId, waPhoneNumber: phoneNumber });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/accounts/:id
router.delete('/accounts/:id', adminAuth, async (req, res) => {
  try {
    const id = req.params.id;
// Borrado en cascada, en transacción atómica y en orden de dependencias (FK-safe en Postgres).
    await prisma.$transaction([
      prisma.payment.deleteMany({ where: { cuota: { enrollment: { activity: { businessId: id } } } } }),
      prisma.cuota.deleteMany({ where: { enrollment: { activity: { businessId: id } } } }),
      prisma.enrollment.deleteMany({ where: { activity: { businessId: id } } }),
      prisma.clientNote.deleteMany({ where: { client: { businessId: id } } }),
      prisma.accountMovement.deleteMany({ where: { businessId: id } }),
      prisma.manualIncome.deleteMany({ where: { businessId: id } }),
      prisma.appointment.deleteMany({ where: { businessId: id } }),
      prisma.attendance.deleteMany({ where: { businessId: id } }),
      prisma.activityEmployee.deleteMany({ where: { activity: { businessId: id } } }),
      prisma.payrollRecord.deleteMany({ where: { businessId: id } }),
      prisma.classReservation.deleteMany({ where: { businessId: id } }),
      prisma.classSchedule.deleteMany({ where: { businessId: id } }),
      prisma.service.deleteMany({ where: { businessId: id } }),
      prisma.activity.deleteMany({ where: { businessId: id } }),
      prisma.employee.deleteMany({ where: { businessId: id } }),
      prisma.expense.deleteMany({ where: { businessId: id } }),
      prisma.branch.deleteMany({ where: { businessId: id } }),
      prisma.supplier.deleteMany({ where: { businessId: id } }),
      prisma.note.deleteMany({ where: { businessId: id } }),
      prisma.dailyCash.deleteMany({ where: { businessId: id } }),
      prisma.client.deleteMany({ where: { businessId: id } }),
      prisma.user.deleteMany({ where: { businessId: id } }),
      prisma.business.delete({ where: { id } }),
    ]);

    res.json({ ok: true });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/test-email — envía un mail de prueba (diagnóstico SMTP)
router.post('/test-email', adminAuth, async (req, res) => {
  const email = (req.body.email || '').toString().trim();
  if (!email) return res.status(400).json({ error: 'Falta el email' });
  const r = await sendTest(email);
  if (r.ok) res.json({ ok: true, from: r.from });
  else res.status(500).json({ error: r.reason });
});

// ─── Migración de datos (SQLite -> PostgreSQL) ───────────────────────────────
// Orden de tablas respetando dependencias (padres antes que hijos).
const MIGRATION_MODELS = [
  'business', 'user', 'client', 'supplier', 'activity', 'branch', 'employee', 'service',
  'clientNote', 'enrollment', 'cuota', 'payment', 'activityEmployee', 'classSchedule',
  'attendance', 'payrollRecord', 'expense', 'accountMovement', 'appointment',
  'note', 'dailyCash', 'manualIncome',
];

function migrationSecretOk(req) {
  const envSecret = process.env.ADMIN_SECRET;
  if (!envSecret || envSecret.length < 12) return false;
  const s = req.headers['x-admin-secret'] || req.query.secret;
  return s === envSecret;
}

// GET /api/admin/export-db?secret=...  -> descarga un JSON con TODA la base
router.get('/export-db', async (req, res) => {
  if (!migrationSecretOk(req)) return setTimeout(() => res.status(401).json({ error: 'No autorizado' }), 500);
  try {
    const data = {};
    for (const m of MIGRATION_MODELS) {
      data[m] = await prisma[m].findMany();
    }
    res.setHeader('Content-Disposition', 'attachment; filename="gestumio-export.json"');
    res.json({ exportedAt: new Date().toISOString(), data });
  } catch (e) {
    console.error('[export-db]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/import-db  { data: {...} }  -> carga el JSON exportado en la base actual
router.post('/import-db', async (req, res) => {
  if (!migrationSecretOk(req)) return setTimeout(() => res.status(401).json({ error: 'No autorizado' }), 500);
  const data = req.body && req.body.data;
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'Falta el campo data del export' });
  const result = {};
  for (const m of MIGRATION_MODELS) {
    const rows = Array.isArray(data[m]) ? data[m] : [];
    if (rows.length === 0) { result[m] = 0; continue; }
    try {
      const r = await prisma[m].createMany({ data: rows, skipDuplicates: true });
      result[m] = r.count;
    } catch (e) {
      result[m] = 'ERROR: ' + e.message;
    }
  }
  res.json({ ok: true, result });
});

module.exports = router;
