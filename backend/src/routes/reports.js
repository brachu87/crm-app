const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { markOverdueCuotas } = require('../lib/overdue');

const router = express.Router();
router.use(authMiddleware);

// GET /api/reports/summary?months=6
router.get('/summary', async (req, res) => {
  try {
    const bId = req.user.businessId;
    const months = parseInt(req.query.months) || 6;

    // All payments in range (cuotas + turnos + manuales)
    const [payments, apptPayments, manualIncomes] = await Promise.all([
      prisma.payment.findMany({
        where: {
          date: { gte: since, lte: until },
          cuota: { enrollment: { activity: { businessId: bId } } },
        },
        select: { amount: true, date: true },
      }),
      prisma.appointment.findMany({
        where: {
          businessId: bId,
          paymentStatus: 'paid',
          paidAt: { gte: since, lte: until },
        },
        select: { price: true, paidAt: true, clientId: true,
          client: { select: { id: true, name: true } } },
      }),
      prisma.manualIncome.findMany({
        where: { businessId: bId, date: { gte: since.toISOString().slice(0,10), lte: until.toISOString().slice(0,10) } },
        select: { amount: true, date: true, category: true, description: true },
      }),
    ]);

    // All expenses in range
    const expenses = await prisma.expense.findMany({
      where: { businessId: bId, date: { gte: since, lte: until } },
      select: { amount: true, date: true, category: true, supplierId: true },
    });

    // Build monthly buckets dynamically based on the date range
    const monthlyMap = {};
    const rangeStart = new Date(since.getFullYear(), since.getMonth(), 1);
    const rangeEnd   = new Date(until.getFullYear(), until.getMonth(), 1);
    for (let d = new Date(rangeStart); d <= rangeEnd; d.setMonth(d.getMonth() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap[key] = { month: key, income: 0, expenses: 0 };
    }

    for (const p of payments) {
      const d = new Date(p.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyMap[key]) monthlyMap[key].income += p.amount;
    }

    for (const a of apptPayments) {
      const d = new Date(a.paidAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyMap[key]) monthlyMap[key].income += a.price || 0;
    }

    for (const m of manualIncomes) {
      const key = m.date.slice(0, 7); // "YYYY-MM"
      if (monthlyMap[key]) monthlyMap[key].income += m.amount;
    }

    for (const e of expenses) {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyMap[key]) monthlyMap[key].expenses += e.amount;
    }

    // Expenses by category
    const categoryMap = {};
    for (const e of expenses) {
      categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount;
    }
    const expensesByCategory = Object.entries(categoryMap)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);

    // Manual incomes by category
    const manualCatMap = {};
    for (const m of manualIncomes) {
      manualCatMap[m.category] = (manualCatMap[m.category] || 0) + m.amount;
    }
    const manualIncomesByCategory = Object.entries(manualCatMap)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);

    // Total salaries (active employees)
    const employees = await prisma.employee.findMany({
      where: { businessId: bId, active: true },
      select: { name: true, salary: true, role: true },
    });
    const totalSalaries = employees.reduce((s, e) => s + (e.salary || 0), 0);

    // Overdue enrollments
    // Refresca las cuotas vencidas antes de contarlas
    await markOverdueCuotas({ businessId: bId });

    const overdueCount = await prisma.cuota.count({
      where: {
        enrollment: { activity: { businessId: bId }, active: true },
        paymentStatus: 'overdue',
      },
    });

    // Top clients by payment amount
    const allPayments = await prisma.payment.findMany({
      where: { cuota: { enrollment: { activity: { businessId: bId } } } },
      include: { cuota: { include: { enrollment: { include: { client: { select: { id: true, name: true } } } } } } },
    });
    const clientMap = {};
    for (const p of allPayments) {
      const c = p.cuota.enrollment.client;
      if (!clientMap[c.id]) clientMap[c.id] = { name: c.name, total: 0 };
      clientMap[c.id].total += p.amount;
    }
    for (const a of apptPayments) {
      const c = a.client;
      if (!c) continue;
      if (!clientMap[c.id]) clientMap[c.id] = { name: c.name, total: 0 };
      clientMap[c.id].total += a.price || 0;
    }
    const topClients = Object.values(clientMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Top suppliers by expense (only expenses with supplierId)
    const supplierExpenses = await prisma.expense.findMany({
      where: { businessId: bId, supplierId: { not: null }, date: { gte: since, lte: until } },
      select: { amount: true, supplierId: true, supplier: { select: { id: true, name: true } } },
    });
    const supplierMap = {};
    for (const e of supplierExpenses) {
      const sid = e.supplierId;
      if (!supplierMap[sid]) supplierMap[sid] = { name: e.supplier.name, total: 0, count: 0 };
      supplierMap[sid].total += e.amount;
      supplierMap[sid].count += 1;
    }
    const topSuppliers = Object.values(supplierMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    res.json({
      monthlyData: Object.values(monthlyMap),
      expensesByCategory,
      manualIncomesByCategory,
      totalSalaries,
      overdueCount,
      topClients,
      topSuppliers,
      employees,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar reporte' });
  }
});

module.exports = router;

// ─── EXTRA REPORTS ────────────────────────────────────────────────────────────

// GET /api/reports/overdue-detail  — Morosos con detalle
router.get('/overdue-detail', async (req, res) => {
  try {
    const bId = req.user.businessId;
    const cuotas = await prisma.cuota.findMany({
      where: {
        enrollment: { activity: { businessId: bId }, active: true },
        paymentStatus: 'overdue',
      },
      include: {
        enrollment: {
          include: {
            client: { select: { id: true, name: true, phone: true } },
            activity: { select: { name: true } },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
    const now = new Date();
    const result = cuotas.map((q) => {
      const days = Math.floor((now - new Date(q.dueDate)) / 86400000);
      return {
        cuotaId: q.id,
        client: q.enrollment.client,
        activity: q.enrollment.activity.name,
        dueDate: q.dueDate,
        amount: q.amount,
        daysOverdue: days,
      };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/income-by-activity?from=&to=  — Ingresos por actividad
router.get('/income-by-activity', async (req, res) => {
  try {
    const bId = req.user.businessId;
    const months = parseInt(req.query.months) || 6;
    let since, until;
    if (req.query.from && req.query.to) {
      since = new Date(req.query.from + 'T00:00:00');
      until = new Date(req.query.to + 'T23:59:59');
    } else {
      const now = new Date();
      since = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
      until = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    // Payments from cuotas grouped by activity
    const payments = await prisma.payment.findMany({
      where: { date: { gte: since, lte: until }, cuota: { enrollment: { activity: { businessId: bId } } } },
      include: { cuota: { include: { enrollment: { include: { activity: { select: { id: true, name: true } } } } } } },
      select: { amount: true, cuota: true },
    });

    // Appointment payments grouped by service
    const appts = await prisma.appointment.findMany({
      where: { businessId: bId, paymentStatus: 'paid', paidAt: { gte: since, lte: until } },
      include: { service: { select: { id: true, name: true } } },
      select: { price: true, service: true },
    });

    const actMap = {};
    for (const p of payments) {
      const act = p.cuota.enrollment.activity;
      if (!actMap[act.id]) actMap[act.id] = { name: act.name, type: 'Actividad', total: 0, count: 0 };
      actMap[act.id].total += p.amount;
      actMap[act.id].count += 1;
    }
    for (const a of appts) {
      const svc = a.service;
      if (!svc) continue;
      const key = 'svc_' + svc.id;
      if (!actMap[key]) actMap[key] = { name: svc.name, type: 'Servicio', total: 0, count: 0 };
      actMap[key].total += a.price || 0;
      actMap[key].count += 1;
    }
    const result = Object.values(actMap).sort((a, b) => b.total - a.total);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/retention?months=6  — Retención mensual
router.get('/retention', async (req, res) => {
  try {
    const bId = req.user.businessId;
    const months = parseInt(req.query.months) || 6;
    const now = new Date();
    const result = [];

    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd   = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

      // Enrollments active at start of month
      const activeAtStart = await prisma.enrollment.count({
        where: {
          activity: { businessId: bId },
          active: true,
          startDate: { lte: monthStart },
        },
      });

      // Payments received this month (renewed)
      const paidThisMonth = await prisma.payment.count({
        where: {
          date: { gte: monthStart, lte: monthEnd },
          cuota: { enrollment: { activity: { businessId: bId } } },
        },
      });

      // New enrollments this month
      const newEnrollments = await prisma.enrollment.count({
        where: {
          activity: { businessId: bId },
          startDate: { gte: monthStart, lte: monthEnd },
        },
      });

      const label = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
      const retentionRate = activeAtStart > 0 ? Math.round((paidThisMonth / activeAtStart) * 100) : null;
      result.push({ month: label, activeAtStart, paidThisMonth, newEnrollments, retentionRate });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/cash-projection  — Flujo de caja proyectado 60 días
router.get('/cash-projection', async (req, res) => {
  try {
    const bId = req.user.businessId;
    const now = new Date();
    const until = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59);

    // Upcoming cuotas due (pending/overdue)
    const upcoming = await prisma.cuota.findMany({
      where: {
        enrollment: { activity: { businessId: bId }, active: true },
        paymentStatus: { in: ['pending', 'overdue'] },
        dueDate: { gte: now, lte: until },
      },
      select: { amount: true, dueDate: true, paymentStatus: true },
      orderBy: { dueDate: 'asc' },
    });

    // Group by week
    const weekMap = {};
    for (const q of upcoming) {
      const d = new Date(q.dueDate);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay()); // Sunday
      const key = weekStart.toISOString().slice(0, 10);
      if (!weekMap[key]) weekMap[key] = { week: key, expected: 0, count: 0 };
      weekMap[key].expected += q.amount;
      weekMap[key].count += 1;
    }

    // Current balance: total collected - total expenses (last 30d as baseline)
    const past30 = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const [collected, spent] = await Promise.all([
      prisma.payment.aggregate({ _sum: { amount: true }, where: { date: { gte: past30 }, cuota: { enrollment: { activity: { businessId: bId } } } } }),
      prisma.expense.aggregate({ _sum: { amount: true }, where: { businessId: bId, date: { gte: past30 } } }),
    ]);

    res.json({
      weeks: Object.values(weekMap),
      totalExpected: upcoming.reduce((s, q) => s + q.amount, 0),
      overdueCount: upcoming.filter(q => q.paymentStatus === 'overdue').length,
      lastMonthCollected: collected._sum.amount || 0,
      lastMonthExpenses: spent._sum.amount || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/monthly-comparison  — Comparativo 12 meses
router.get('/monthly-comparison', async (req, res) => {
  try {
    const bId = req.user.businessId;
    const months = 12;
    const now = new Date();
    const since = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
    const until = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [payments, appts, manuals, expenses, enrollmentsByMonth] = await Promise.all([
      prisma.payment.findMany({
        where: { date: { gte: since, lte: until }, cuota: { enrollment: { activity: { businessId: bId } } } },
        select: { amount: true, date: true },
      }),
      prisma.appointment.findMany({
        where: { businessId: bId, paymentStatus: 'paid', paidAt: { gte: since, lte: until } },
        select: { price: true, paidAt: true },
      }),
      prisma.manualIncome.findMany({
        where: { businessId: bId, date: { gte: since.toISOString().slice(0,10), lte: until.toISOString().slice(0,10) } },
        select: { amount: true, date: true },
      }),
      prisma.expense.findMany({
        where: { businessId: bId, date: { gte: since, lte: until } },
        select: { amount: true, date: true },
      }),
      prisma.enrollment.groupBy({
        by: [], // we'll do this manually
        where: { activity: { businessId: bId } },
      }),
    ]);

    // Active clients per month — count enrollments active during that month
    const allEnrollments = await prisma.enrollment.findMany({
      where: { activity: { businessId: bId } },
      select: { startDate: true, active: true },
    });

    const monthMap = {};
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap[key] = { month: key, income: 0, expenses: 0, result: 0, activeClients: 0 };
    }

    for (const p of payments) {
      const key = new Date(p.date).toISOString().slice(0,7);
      if (monthMap[key]) monthMap[key].income += p.amount;
    }
    for (const a of appts) {
      const key = new Date(a.paidAt).toISOString().slice(0,7);
      if (monthMap[key]) monthMap[key].income += a.price || 0;
    }
    for (const m of manuals) {
      const key = m.date.slice(0,7);
      if (monthMap[key]) monthMap[key].income += m.amount;
    }
    for (const e of expenses) {
      const key = new Date(e.date).toISOString().slice(0,7);
      if (monthMap[key]) monthMap[key].expenses += e.amount;
    }
    // Active clients per month
    for (const key of Object.keys(monthMap)) {
      const [yr, mo] = key.split('-').map(Number);
      const monthStart = new Date(yr, mo - 1, 1);
      const monthEnd = new Date(yr, mo, 0);
      monthMap[key].activeClients = allEnrollments.filter(e => new Date(e.startDate) <= monthEnd && e.active).length;
    }
    for (const m of Object.values(monthMap)) {
      m.result = m.income - m.expenses;
    }

    res.json(Object.values(monthMap));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/class-occupancy  — Ocupación por horario
router.get('/class-occupancy', async (req, res) => {
  try {
    const bId = req.user.businessId;
    const schedules = await prisma.classSchedule.findMany({
      where: { activity: { businessId: bId, active: true } },
      include: {
        activity: { select: { name: true, capacity: true } },
        branch: { select: { name: true } },
        employee: { select: { name: true } },
      },
    });

    // Count active enrollments per activity as proxy for occupancy
    const enrollmentCounts = await prisma.enrollment.groupBy({
      by: ['activityId'],
      where: { activity: { businessId: bId }, active: true },
      _count: { id: true },
    });
    const enrollMap = {};
    for (const e of enrollmentCounts) enrollMap[e.activityId] = e._count.id;

    const result = schedules.map((s) => ({
      id: s.id,
      activity: s.activity.name,
      branch: s.branch?.name || null,
      instructor: s.employee?.name || null,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      capacity: s.activity.capacity || null,
      enrolled: enrollMap[s.activityId] || 0,
      occupancyPct: s.activity.capacity
        ? Math.round(((enrollMap[s.activityId] || 0) / s.activity.capacity) * 100)
        : null,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
