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

    // Anclar al primer día del mes actual para evitar desbordes de fin de mes
    const anchor = new Date();
    anchor.setHours(0, 0, 0, 0);
    anchor.setDate(1);
    // Ventana alineada con el bucket más viejo que se grafica (months-1 meses atrás)
    const since = new Date(anchor.getFullYear(), anchor.getMonth() - (months - 1), 1);

    // All payments in range (cuotas + turnos)
    const [payments, apptPayments] = await Promise.all([
      prisma.payment.findMany({
        where: {
          date: { gte: since },
          cuota: { enrollment: { activity: { businessId: bId } } },
        },
        select: { amount: true, date: true },
      }),
      prisma.appointment.findMany({
        where: {
          businessId: bId,
          paymentStatus: 'paid',
          paidAt: { gte: since },
        },
        select: { price: true, paidAt: true, clientId: true,
          client: { select: { id: true, name: true } } },
      }),
    ]);

    // All expenses in range
    const expenses = await prisma.expense.findMany({
      where: { businessId: bId, date: { gte: since } },
      select: { amount: true, date: true, category: true },
    });

    // Build monthly buckets
    const monthlyMap = {};
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
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

    res.json({
      monthlyData: Object.values(monthlyMap),
      expensesByCategory,
      totalSalaries,
      overdueCount,
      topClients,
      employees,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar reporte' });
  }
});

module.exports = router;
