const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware);

// GET /api/audit - historial de acciones del negocio
router.get('/', async (req, res) => {
  try {
    const items = await prisma.auditLog.findMany({
      where: { businessId: req.user.businessId },
      orderBy: { createdAt: 'desc' },
      take: 400,
    });
    res.json(items);
  } catch (e) { console.error('[audit list]', e.message); res.status(500).json({ error: 'Error al cargar el historial' }); }
});

module.exports = router;
