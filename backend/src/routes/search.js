const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { scopedWhere } = require('../middleware/tenant');

const router = express.Router();
router.use(authMiddleware);

// GET /api/search?q=term
router.get('/', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ clients: [], activities: [] });

    const bId = req.user.businessId;

    const [clients, activities] = await Promise.all([
      prisma.client.findMany({
        where: {
          businessId: bId,
          active: true,
          OR: [
            { name: { contains: q } },
            { phone: { contains: q } },
            { email: { contains: q } },
          ],
        },
        select: { id: true, name: true, phone: true, email: true },
        take: 6,
        orderBy: { name: 'asc' },
      }),
      prisma.activity.findMany({
        where: {
          businessId: bId,
          active: true,
          name: { contains: q },
        },
        select: { id: true, name: true, schedule: true, price: true },
        take: 4,
        orderBy: { name: 'asc' },
      }),
    ]);

    res.json({ clients, activities });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en búsqueda' });
  }
});

module.exports = router;
