const express = require('express');
const prisma = require('../prisma');
const router = express.Router();

const TRIAL_DAYS = 15;

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
    const businesses = await prisma.$queryRawUnsafe(`
      SELECT
        b.id, b.name, b.category, b.phone, b."createdAt", b.approved, b."approvedAt",
        b."subscriptionStatus", b."subscriptionExpires", b."bonificado",
        u.name as ownerName, u.email as ownerEmail, u."lastAccessAt" as ownerLastAccess,
        (SELECT COUNT(*) FROM "User" u2 WHERE u2."businessId" = b.id) as userCount
      FROM "Business" b
      LEFT JOIN "User" u ON u."businessId" = b.id AND u.role = 'owner'
      ORDER BY b."createdAt" DESC
    `);

    const result = businesses.map(b => ({
      id: b.id,
      name: b.name,
      category: b.category,
      phone: b.phone || null,
      createdAt: b.createdAt,
      approved: b.approved === 1 || b.approved === true,
      approvedAt: b.approvedAt,
      subscriptionStatus: b.subscriptionStatus || 'trial',
      subscriptionExpires: b.subscriptionExpires,
      bonificado: b.bonificado === 1 || b.bonificado === true,
      userCount: Number(b.userCount) || 0,
      trialDaysLeft: trialDaysLeft(b.createdAt),
      owner: b.ownerName ? { name: b.ownerName, email: b.ownerEmail, lastAccessAt: b.ownerLastAccess } : null,
    }));

    res.json(result);
  } catch (err) {
    console.error('Admin accounts error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/accounts/:id/approve
router.put('/accounts/:id/approve', adminAuth, async (req, res) => {
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "Business" SET approved = 1, "approvedAt" = datetime('now') WHERE id = ?`,
      req.params.id
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/accounts/:id/reject
router.put('/accounts/:id/reject', adminAuth, async (req, res) => {
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "Business" SET approved = 0, "approvedAt" = NULL WHERE id = ?`,
      req.params.id
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/accounts/:id/bonificado
router.put('/accounts/:id/bonificado', adminAuth, async (req, res) => {
  try {
    const { bonificado } = req.body;
    const val = bonificado ? 1 : 0;
    await prisma.$executeRawUnsafe(
      `UPDATE "Business" SET "bonificado" = ?, "subscriptionStatus" = CASE WHEN ? = 1 THEN 'active' ELSE "subscriptionStatus" END WHERE id = ?`,
      val, val, req.params.id
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/accounts/:id/extend-trial — extiende trial 14 días más
router.put('/accounts/:id/extend-trial', adminAuth, async (req, res) => {
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "Business" SET "createdAt" = datetime('now'), "subscriptionStatus" = 'trial' WHERE id = ?`,
      req.params.id
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/accounts/:id
router.delete('/accounts/:id', adminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const D = (sql, ...args) => prisma.$executeRawUnsafe(sql, ...args);

    await D(`DELETE FROM "ManualIncome" WHERE "businessId" = ?`, id);
    await D(`DELETE FROM "Appointment" WHERE "businessId" = ?`, id);
    await D(`DELETE FROM "Service" WHERE "businessId" = ?`, id);
    await D(`DELETE FROM "PayrollRecord" WHERE "businessId" = ?`, id);
    await D(`DELETE FROM "Attendance" WHERE "businessId" = ?`, id);
    await D(`DELETE FROM "ClassSchedule" WHERE "businessId" = ?`, id);
    await D(`DELETE FROM "ActivityEmployee" WHERE "businessId" = ?`, id);
    await D(`DELETE FROM "Branch" WHERE "businessId" = ?`, id);
    await D(`DELETE FROM "AccountMovement" WHERE "businessId" = ?`, id);
    await D(`DELETE FROM "Expense" WHERE "businessId" = ?`, id);
    await D(`DELETE FROM "Employee" WHERE "businessId" = ?`, id);
    await D(`DELETE FROM "DailyCash" WHERE "businessId" = ?`, id);
    await D(`DELETE FROM "Note" WHERE "businessId" = ?`, id);
    await D(`DELETE FROM "Supplier" WHERE "businessId" = ?`, id);
    await D(`DELETE FROM "Payment" WHERE "cuotaId" IN (SELECT c.id FROM "Cuota" c JOIN "Enrollment" e ON c."enrollmentId" = e.id JOIN "Activity" a ON e."activityId" = a.id WHERE a."businessId" = ?)`, id);
    await D(`DELETE FROM "Cuota" WHERE "enrollmentId" IN (SELECT e.id FROM "Enrollment" e JOIN "Activity" a ON e."activityId" = a.id WHERE a."businessId" = ?)`, id);
    await D(`DELETE FROM "Enrollment" WHERE "activityId" IN (SELECT id FROM "Activity" WHERE "businessId" = ?)`, id);
    await D(`DELETE FROM "Activity" WHERE "businessId" = ?`, id);
    await D(`DELETE FROM "ClientNote" WHERE "clientId" IN (SELECT id FROM "Client" WHERE "businessId" = ?)`, id);
    await D(`DELETE FROM "Client" WHERE "businessId" = ?`, id);
    await D(`DELETE FROM "User" WHERE "businessId" = ?`, id);
    await D(`DELETE FROM "Business" WHERE id = ?`, id);

    res.json({ ok: true });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
