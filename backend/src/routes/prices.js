const express = require('express');
const prisma = require('../prisma');
const router = express.Router();

// GET /api/prices — all activities and services with their prices
router.get('/', async (req, res) => {
  try {
    const bId = req.user.businessId;

    const [activities, services] = await Promise.all([
      prisma.activity.findMany({
        where: { businessId: bId, active: true },
        select: { id: true, name: true, price: true, description: true },
        orderBy: { name: 'asc' },
      }),
      prisma.service.findMany({
        where: { businessId: bId, active: true },
        select: { id: true, name: true, price: true, description: true, duration: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    res.json({
      activities: activities.map(a => ({ ...a, type: 'activity' })),
      services: services.map(s => ({ ...s, type: 'service' })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/prices/bulk-update — apply % adjustment to selected items
// Body: { items: [{ id, type }], percent: number }
// percent: positive = increase, negative = decrease
router.put('/bulk-update', async (req, res) => {
  try {
    const bId = req.user.businessId;
    const { items, percent } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No se seleccionaron elementos' });
    }
    if (typeof percent !== 'number' || percent < -99 || percent > 1000) {
      return res.status(400).json({ error: 'Porcentaje inválido (entre -99 y 1000)' });
    }

    const multiplier = 1 + percent / 100;

    const activityIds = items.filter(i => i.type === 'activity').map(i => i.id);
    const serviceIds  = items.filter(i => i.type === 'service').map(i => i.id);

    const updates = [];

    if (activityIds.length > 0) {
      // Verify ownership before updating
      const owned = await prisma.activity.findMany({
        where: { id: { in: activityIds }, businessId: bId },
        select: { id: true, price: true },
      });
      for (const act of owned) {
        const newPrice = Math.round(act.price * multiplier * 100) / 100;
        updates.push(prisma.activity.update({
          where: { id: act.id },
          data: { price: newPrice },
        }));
      }
    }

    if (serviceIds.length > 0) {
      const owned = await prisma.service.findMany({
        where: { id: { in: serviceIds }, businessId: bId },
        select: { id: true, price: true },
      });
      for (const svc of owned) {
        const newPrice = Math.round(svc.price * multiplier * 100) / 100;
        updates.push(prisma.service.update({
          where: { id: svc.id },
          data: { price: newPrice },
        }));
      }
    }

    await prisma.$transaction(updates);

    res.json({ ok: true, updated: updates.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
