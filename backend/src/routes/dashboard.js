const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// GET /api/dashboard - resumen general del negocio
router.get('/', async (req, res) => {
  try {
    const businessId = req.user.businessId;

    // NOTA paso #1: conteos/sumas sobre Cuota pero SIN filtrar inscripciones dadas de baja
    // y usando monto BRUTO (sin restar descuento) — bugs a corregir en pasos #8 y #9.
    const [clientsCount, activitiesCount, pendingCount, overdueCount, pendingSum, overdueSum, upcoming] =
      await Promise.all([
        prisma.client.count({ where: { businessId } }),
        prisma.activity.count({ where: { businessId, active: true } }),
        prisma.cuota.count({
          where: { enrollment: { client: { businessId } }, paymentStatus: 'pending' },
        }),
        prisma.cuota.count({
          where: { enrollment: { client: { businessId } }, paymentStatus: 'overdue' },
        }),
        prisma.cuota.aggregate({
          where: { enrollment: { client: { businessId } }, paymentStatus: 'pending' },
          _sum: { amountDue: true },
        }),
        prisma.cuota.aggregate({
          where: { enrollment: { client: { businessId } }, paymentStatus: 'overdue' },
          _sum: { amountDue: true },
        }),
        prisma.cuota.findMany({
          where: {
            enrollment: { client: { businessId } },
            paymentStatus: { in: ['pending', 'overdue'] },
            dueDate: { not: null },
          },
          include: { enrollment: { include: { client: true, activity: true } } },
          orderBy: { dueDate: 'asc' },
          take: 10,
        }),
      ]);

    // Estado actual de cada inscripción ACTIVA según su última cuota (para el donut "Inscripciones")
    const activeEnrollments = await prisma.enrollment.findMany({
      where: { client: { businessId }, active: true },
      include: { cuotas: { orderBy: { period: 'desc' }, take: 1 } },
    });
    const enrollmentStatus = { paid: 0, pending: 0, overdue: 0 };
    for (const e of activeEnrollments) {
      const st = e.cuotas[0]?.paymentStatus;
      if (enrollmentStatus[st] !== undefined) enrollmentStatus[st]++;
    }

    // Aplanar las cuotas próximas a la forma que consume el Dashboard
    const upcomingDueDates = upcoming.map((c) => ({
      id: c.id,
      clientId: c.enrollment.clientId,
      client: c.enrollment.client,
      activity: c.enrollment.activity,
      dueDate: c.dueDate,
      amountDue: c.amountDue,
      paymentStatus: c.paymentStatus,
    }));

    res.json({
      clientsCount,
      activitiesCount,
      pending: { count: pendingCount, total: pendingSum._sum.amountDue || 0 },
      overdue: { count: overdueCount, total: overdueSum._sum.amountDue || 0 },
      enrollmentStatus,
      upcomingDueDates,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener dashboard' });
  }
});

module.exports = router;
