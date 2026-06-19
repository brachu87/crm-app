const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// GET /api/dashboard - resumen general del negocio
router.get('/', async (req, res) => {
  try {
    const businessId = req.user.businessId;

    // Solo cuotas de inscripciones y clientes ACTIVOS (excluye dados de baja)
    const activeScope = { enrollment: { active: true, client: { businessId, active: true } } };

    const [clientsCount, activitiesCount, openCuotas, upcoming, pendingAppts] =
      await Promise.all([
        prisma.client.count({ where: { businessId } }),
        prisma.activity.count({ where: { businessId, active: true } }),
        prisma.cuota.findMany({
          where: { ...activeScope, paymentStatus: { in: ['pending', 'overdue'] } },
          select: { amountDue: true, discount: true, paymentStatus: true },
        }),
        prisma.cuota.findMany({
          where: { ...activeScope, paymentStatus: { in: ['pending', 'overdue'] }, dueDate: { not: null } },
          include: { enrollment: { include: { client: true, activity: true } } },
          orderBy: { dueDate: 'asc' },
          take: 10,
        }),
        prisma.appointment.aggregate({
          where: { businessId, status: 'completed', paymentStatus: 'pending' },
          _count: { id: true },
          _sum: { price: true },
        }),
      ]);

    // Conteos y totales por estado, sumando el NETO (amountDue - discount)
    const pending = { count: 0, total: 0 };
    const overdue = { count: 0, total: 0 };
    for (const c of openCuotas) {
      const net = Math.max(0, c.amountDue - (c.discount || 0));
      const bucket = c.paymentStatus === 'overdue' ? overdue : pending;
      bucket.count++;
      bucket.total += net;
    }

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

    // Add pending appointment totals to pending bucket
    const apptPendingCount = pendingAppts._count.id || 0;
    const apptPendingTotal = pendingAppts._sum.price || 0;

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
      pending,
      overdue,
      enrollmentStatus,
      upcomingDueDates,
      pendingAppts: { count: apptPendingCount, total: apptPendingTotal },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener dashboard' });
  }
});

module.exports = router;
