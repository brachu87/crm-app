const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { markOverdueCuotas } = require('../lib/overdue');
const { autoRenewCuotas } = require('../lib/autoRenew');

const router = express.Router();

router.use(authMiddleware);

// GET /api/dashboard - resumen general del negocio
router.get('/', async (req, res) => {
  try {
    const businessId = req.user.businessId;

    // Auto-generar cuotas vencidas al abrir el dashboard
    await markOverdueCuotas({ businessId });
    await autoRenewCuotas({ businessId });

    // Solo cuotas de inscripciones y clientes ACTIVOS (excluye dados de baja)
    const activeScope = { enrollment: { active: true, client: { businessId, active: true } } };

    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    const [clientsCount, activitiesCount, servicesCount, employeesCount, suppliersCount, openCuotas, upcoming, pendingAppts, paymentThisMonth, apptPaidThisMonth, expensesThisMonth, manualIncomeThisMonth] =
      await Promise.all([
        prisma.client.count({ where: { businessId, active: true } }),
        prisma.activity.count({ where: { businessId, active: true } }),
        // Turnos/trabajos del mes corriente (completados o programados)
        prisma.appointment.count({
          where: { businessId, date: { gte: firstOfMonth, lte: lastOfMonth } },
        }),
        prisma.employee.count({ where: { businessId, active: true } }),
        prisma.supplier.count({ where: { businessId } }),
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
        // Ingresos del mes: pagos de cuotas
        prisma.payment.aggregate({
          where: {
            date: {
              gte: new Date(now.getFullYear(), now.getMonth(), 1),
              lte: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
            },
            cuota: { enrollment: { activity: { businessId } } },
          },
          _sum: { amount: true },
        }),
        // Ingresos del mes: turnos/trabajos cobrados
        prisma.appointment.aggregate({
          where: {
            businessId,
            paymentStatus: 'paid',
            paidAt: {
              gte: new Date(now.getFullYear(), now.getMonth(), 1),
              lte: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
            },
          },
          _sum: { price: true },
        }),
        // Gastos del mes
        prisma.expense.aggregate({
          where: {
            businessId,
            date: {
              gte: new Date(now.getFullYear(), now.getMonth(), 1),
              lte: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
            },
          },
          _sum: { amount: true },
        }),
        // Otros ingresos manuales del mes
        prisma.manualIncome.aggregate({
          where: {
            businessId,
            date: { gte: firstOfMonth, lte: lastOfMonth },
          },
          _sum: { amount: true },
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

    // Monthly trend for last 6 months (for sparkline / mini chart)
    const trendMonths = 6;
    const trendSince = new Date(now.getFullYear(), now.getMonth() - (trendMonths - 1), 1);
    const [trendPayments, trendAppts, trendManuals, trendExpenses] = await Promise.all([
      prisma.payment.findMany({
        where: { date: { gte: trendSince }, cuota: { enrollment: { activity: { businessId } } } },
        select: { amount: true, date: true },
      }),
      prisma.appointment.findMany({
        where: { businessId, paymentStatus: 'paid', paidAt: { gte: trendSince } },
        select: { price: true, paidAt: true },
      }),
      prisma.manualIncome.findMany({
        where: { businessId, date: { gte: trendSince.toISOString().slice(0,10) } },
        select: { amount: true, date: true },
      }),
      prisma.expense.findMany({
        where: { businessId, date: { gte: trendSince } },
        select: { amount: true, date: true },
      }),
    ]);
    const trendMap = {};
    for (let i = trendMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      trendMap[key] = { month: key, income: 0, expenses: 0 };
    }
    for (const p of trendPayments) {
      const key = new Date(p.date).toISOString().slice(0,7);
      if (trendMap[key]) trendMap[key].income += p.amount;
    }
    for (const a of trendAppts) {
      const key = new Date(a.paidAt).toISOString().slice(0,7);
      if (trendMap[key]) trendMap[key].income += a.price || 0;
    }
    for (const m of trendManuals) {
      const key = m.date.slice(0,7);
      if (trendMap[key]) trendMap[key].income += m.amount;
    }
    for (const e of trendExpenses) {
      const key = new Date(e.date).toISOString().slice(0,7);
      if (trendMap[key]) trendMap[key].expenses += e.amount;
    }

    // Last month comparison
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth()+1).padStart(2,'0')}`;
    const prevData = trendMap[prevKey] || { income: 0, expenses: 0 };
    const currKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const currData = trendMap[currKey] || { income: 0, expenses: 0 };

    res.json({
      clientsCount,
      activitiesCount,
      servicesCount,
      employeesCount,
      suppliersCount,
      ingresosDelMes: (paymentThisMonth._sum?.amount || 0) + (apptPaidThisMonth._sum?.price || 0) + (manualIncomeThisMonth._sum?.amount || 0),
      gastosDelMes: expensesThisMonth._sum?.amount || 0,
      pending,
      overdue,
      enrollmentStatus,
      upcomingDueDates,
      pendingAppts: { count: apptPendingCount, total: apptPendingTotal },
      monthlyTrend: Object.values(trendMap),
      prevMonth: prevData,
      currMonth: currData,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener dashboard' });
  }
});

module.exports = router;
