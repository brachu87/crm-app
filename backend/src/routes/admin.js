const express = require('express');
const prisma = require('../prisma');
const router = express.Router();

function adminAuth(req, res, next) {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

async function ensureApprovedColumn() {
  try {
    const info = await prisma.$queryRawUnsafe(`PRAGMA table_info("Business")`);
    const exists = info.some(col => col.name === 'approved');
    if (!exists) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Business" ADD COLUMN "approved" INTEGER NOT NULL DEFAULT 0`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Business" ADD COLUMN "approvedAt" TEXT`);
      // Approve all existing accounts
      await prisma.$executeRawUnsafe(`UPDATE "Business" SET "approved" = 1, "approvedAt" = datetime('now')`);
    }
  } catch (err) {
    console.error('ensureApprovedColumn error:', err.message);
  }
}

// GET /api/admin/accounts
router.get('/accounts', adminAuth, async (req, res) => {
  try {
    await ensureApprovedColumn();

    const businesses = await prisma.$queryRawUnsafe(`
      SELECT b.id, b.name, b.category, b."createdAt", b.approved, b."approvedAt",
             u.name as ownerName, u.email as ownerEmail
      FROM "Business" b
      LEFT JOIN "User" u ON u."businessId" = b.id AND u.role = 'owner'
      ORDER BY b."createdAt" DESC
    `);

    const result = businesses.map(b => ({
      id: b.id,
      name: b.name,
      category: b.category,
      createdAt: b.createdAt,
      approved: b.approved === 1 || b.approved === true,
      approvedAt: b.approvedAt,
      users: b.ownerName ? [{ name: b.ownerName, email: b.ownerEmail }] : [],
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
    await ensureApprovedColumn();
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
    await ensureApprovedColumn();
    await prisma.$executeRawUnsafe(
      `UPDATE "Business" SET approved = 0, "approvedAt" = NULL WHERE id = ?`,
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

    // Borrar en orden respetando FK (hijos antes que padres)
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
    // Pagos → Cuotas → Enrollments → Activities
    await D(`DELETE FROM "Payment" WHERE "cuotaId" IN (SELECT c.id FROM "Cuota" c JOIN "Enrollment" e ON c."enrollmentId" = e.id JOIN "Activity" a ON e."activityId" = a.id WHERE a."businessId" = ?)`, id);
    await D(`DELETE FROM "Cuota" WHERE "enrollmentId" IN (SELECT e.id FROM "Enrollment" e JOIN "Activity" a ON e."activityId" = a.id WHERE a."businessId" = ?)`, id);
    await D(`DELETE FROM "Enrollment" WHERE "activityId" IN (SELECT id FROM "Activity" WHERE "businessId" = ?)`, id);
    await D(`DELETE FROM "Activity" WHERE "businessId" = ?`, id);
    // Notas de clientes → Clientes
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
