const express = require('express');
const prisma = require('../prisma');
const router = express.Router();

// Simple auth: header X-Admin-Secret debe coincidir con env ADMIN_SECRET
function adminAuth(req, res, next) {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

// GET /api/admin/accounts
router.get('/accounts', adminAuth, async (req, res) => {
  try {
    const businesses = await prisma.business.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        users: {
          where: { role: 'owner' },
          select: { name: true, email: true, createdAt: true },
        },
      },
    });
    res.json(businesses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error' });
  }
});

// PUT /api/admin/accounts/:id/approve
router.put('/accounts/:id/approve', adminAuth, async (req, res) => {
  try {
    const business = await prisma.business.update({
      where: { id: req.params.id },
      data: { approved: true, approvedAt: new Date() },
    });
    res.json(business);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// PUT /api/admin/accounts/:id/reject
router.put('/accounts/:id/reject', adminAuth, async (req, res) => {
  try {
    const business = await prisma.business.update({
      where: { id: req.params.id },
      data: { approved: false, approvedAt: null },
    });
    res.json(business);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
