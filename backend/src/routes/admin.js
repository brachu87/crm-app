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

// GET /api/admin/accounts — usa SQL crudo para no depender del schema de Prisma
router.get('/accounts', adminAuth, async (req, res) => {
  try {
    // Primero asegurar que la columna existe
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "approved" BOOLEAN NOT NULL DEFAULT false
    `).catch(() => {});
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP
    `).catch(() => {});

    const businesses = await prisma.$queryRawUnsafe(`
      SELECT b.id, b.name, b.category, b."createdAt", b.approved, b."approvedAt",
             u.name as "ownerName", u.email as "ownerEmail"
      FROM "Business" b
      LEFT JOIN "User" u ON u."businessId" = b.id AND u.role = 'owner'
      ORDER BY b."createdAt" DESC
    `);

    // Dar formato compatible con el panel
    const result = businesses.map(b => ({
      id: b.id,
      name: b.name,
      category: b.category,
      createdAt: b.createdAt,
      approved: b.approved,
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
    await prisma.$executeRawUnsafe(
      `UPDATE "Business" SET approved = true, "approvedAt" = NOW() WHERE id = $1`,
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
      `UPDATE "Business" SET approved = false, "approvedAt" = NULL WHERE id = $1`,
      req.params.id
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
