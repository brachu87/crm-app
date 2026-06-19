const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { scopedWhere } = require('../middleware/tenant');

const router = express.Router();
router.use(authMiddleware);

// GET /api/daily-cash/history - past 90 days with payment/expense totals per day
router.get('/history', async (req, res) => {
  try {
    const bId = req.user.businessId;
    const since = new Date();
    since.setDate(since.getDate() - 90);
    since.setHours(0, 0, 0, 0);

    const cashRecords = await prisma.dailyCash.findMany({
      where: { businessId: bId, date: { gte: since } },
      orderBy: { date: 'desc' },
    });

    // Payments per day
    const payments = await prisma.payment.findMany({
      where: { date: { gte: since }, cuota: { enrollment: { activity: { businessId: bId } } } },
      select: { amount: true, date: true },
    });

    // Expenses per day
    const expenses = await prisma.expense.findMany({
      where: { businessId: bId, date: { gte: since } },
      select: { amount: true, date: true },
    });

    // Build day-keyed map
    const dayMap = {};
    const toDay = (d) => new Date(d).toISOString().slice(0, 10);

    for (const p of payments) {
      const k = toDay(p.date);
      if (!dayMap[k]) dayMap[k] = { date: k, income: 0, expenses: 0, cashRecord: null };
      dayMap[k].income += p.amount;
    }
    for (const e of expenses) {
      const k = toDay(e.date);
      if (!dayMap[k]) dayMap[k] = { date: k, income: 0, expenses: 0, cashRecord: null };
      dayMap[k].expenses += e.amount;
    }
    for (const r of cashRecords) {
      const k = toDay(r.date);
      if (!dayMap[k]) dayMap[k] = { date: k, income: 0, expenses: 0, cashRecord: null };
      dayMap[k].cashRecord = r;
    }

    const days = Object.values(dayMap).sort((a, b) => b.date.localeCompare(a.date));
    res.json(days);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener historial de caja' });
  }
});

// GET /api/daily-cash?date=2024-01-15  (or all if no date)
router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    let where = scopedWhere(req);
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where = { ...where, date: { gte: start, lte: end } };
    }
    const records = await prisma.dailyCash.findMany({
      where,
      orderBy: { date: 'desc' },
    });
    res.json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener caja' });
  }
});

// GET /api/daily-cash/today - Returns today's summary with payments and expenses
router.get('/today', async (req, res) => {
  try {
    const bId = req.user.businessId;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    // Payments made today
    const paymentsRaw = await prisma.payment.findMany({
      where: {
        date: { gte: start, lte: end },
        cuota: { enrollment: { activity: { businessId: bId } } },
      },
      include: { cuota: { include: { enrollment: { include: { client: true, activity: true } } } } },
    });
    // Mantener la forma p.enrollment.{client,activity} que espera el front de Caja
    const payments = paymentsRaw.map((p) => ({ ...p, enrollment: p.cuota.enrollment }));

    // Expenses recorded today
    const expenses = await prisma.expense.findMany({
      where: { businessId: bId, date: { gte: start, lte: end } },
    });

    // Today's cash record (opening/closing)
    const cashRecord = await prisma.dailyCash.findFirst({
      where: { businessId: bId, date: { gte: start, lte: end } },
    });

    const totalIncome = payments.reduce((s, p) => s + p.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

    res.json({ cashRecord, payments, expenses, totalIncome, totalExpenses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener caja del día' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { date, openingBalance, closingBalance, notes } = req.body;
    const record = await prisma.dailyCash.create({
      data: {
        date: date ? new Date(date) : new Date(),
        openingBalance: openingBalance ? parseFloat(openingBalance) : 0,
        closingBalance: closingBalance !== undefined ? parseFloat(closingBalance) : null,
        notes: notes || null,
        businessId: req.user.businessId,
      },
    });
    res.status(201).json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar caja' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.dailyCash.findFirst({ where: scopedWhere(req, { id: req.params.id }) });
    if (!existing) return res.status(404).json({ error: 'Registro no encontrado' });
    const { openingBalance, closingBalance, notes } = req.body;
    const record = await prisma.dailyCash.update({
      where: { id: req.params.id },
      data: {
        openingBalance: openingBalance !== undefined ? parseFloat(openingBalance) : existing.openingBalance,
        closingBalance: closingBalance !== undefined ? (closingBalance !== null ? parseFloat(closingBalance) : null) : existing.closingBalance,
        notes: notes !== undefined ? notes || null : existing.notes,
      },
    });
    res.json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar caja' });
  }
});

module.exports = router;
