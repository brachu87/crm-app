const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// GET /api/dashboard - resumen general del negocio
router.get('/', async (req, res) => {
  try {
    const businessId = req.user.businessId;

    const [clientsCount, activitiesCount, pendingCount, overdueCount, pendingSum, overdueSum, upcoming] =
      await Promise.all([
        prisma.client.count({ where: { businessId } }),
        prisma.activity.count({ where: { businessId, active: true } }),
        prisma.enrollment.count({
          where: { client: { businessId }, paymentStatus: 'pending' },
        }),
        prisma.enrollment.count({
          where: { client: { businessId }, paymentStatus: 'overdue' },
        }),
        prisma.enrollment.aggregate({
          where: { client: { businessId }, paymentStatus: 'pending' },
          _sum: { amountDue: true },
        }),
        prisma.enrollment.aggregate({
          where: { client: { businessId }, paymentStatus: 'overdue' },
          _sum: { amountDue: true },
        }),
        prisma.enrollment.findMany({
          where: {
            client: { businessId },
            paymentStatus: { in: ['pending', 'overdue'] },
            dueDate: { not: null },
          },
          include: { client: true, activity: true },
          orderBy: { dueDate: 'asc' },
          take: 10,
        }),
      ]);

    res.json({
      clientsCount,
      activitiesCount,
      pending: { count: pendingCount, total: pendingSum._sum.amountDue || 0 },
      overdue: { count: overdueCount, total: overdueSum._sum.amountDue || 0 },
      upcomingDueDates: upcoming,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener dashboard' });
  }
});

module.exports = router;
