const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { scopedWhere } = require('../middleware/tenant');

const router = express.Router();
router.use(authMiddleware);

// GET /api/expenses
router.get('/', async (req, res) => {
  try {
    const expenses = await prisma.expense.findMany({
      where: scopedWhere(req),
      orderBy: { date: 'desc' },
    });
    res.json(expenses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener gastos' });
  }
});

// POST /api/expenses
router.post('/', async (req, res) => {
  try {
    const { amount, date, category, description, paymentMethod } = req.body;
    if (!amount) return res.status(400).json({ error: 'El monto es obligatorio' });
    if (!category) return res.status(400).json({ error: 'La categoría es obligatoria' });

    const expense = await prisma.expense.create({
      data: {
        amount: parseFloat(amount),
        date: date ? new Date(date) : new Date(),
        category,
        description: description || null,
        paymentMethod: paymentMethod || null,
        businessId: req.user.businessId,
      },
    });
    res.status(201).json(expense);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear gasto' });
  }
});

// PUT /api/expenses/:id
router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.expense.findFirst({
      where: scopedWhere(req, { id: req.params.id }),
    });
    if (!existing) return res.status(404).json({ error: 'Gasto no encontrado' });

    const { amount, date, category, description, paymentMethod } = req.body;
    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: {
        amount: amount ? parseFloat(amount) : existing.amount,
        date: date ? new Date(date) : existing.date,
        category: category || existing.category,
        description: description !== undefined ? description || null : existing.description,
        paymentMethod: paymentMethod !== undefined ? paymentMethod || null : existing.paymentMethod,
      },
    });
    res.json(expense);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al editar gasto' });
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.expense.findFirst({
      where: scopedWhere(req, { id: req.params.id }),
    });
    if (!existing) return res.status(404).json({ error: 'Gasto no encontrado' });

    await prisma.expense.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar gasto' });
  }
});

module.exports = router;
