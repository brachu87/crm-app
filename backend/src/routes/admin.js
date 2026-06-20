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
      await prisma.$executeRawUnsafe(`ALTER TABLE "Business" ADD COLUMN "approved" INTEGER NOT NULL DEFAULT 1`);
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

module.exports = router;
