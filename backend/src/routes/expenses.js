const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { scopedWhere } = require('../middleware/tenant');

const router = express.Router();
router.use(authMiddleware);

// GET /api/expenses
router.get('/', async (req, res) => {
  try {
    const where = scopedWhere(req);
    if (req.query.supplierId) where.supplierId = req.query.supplierId;
    if (req.query.from || req.query.to) {
      where.date = {};
      if (req.query.from) where.date.gte = new Date(req.query.from);
      if (req.query.to)   where.date.lte = new Date(req.query.to + 'T23:59:59');
    }
    const expenses = await prisma.expense.findMany({
      where,
      include: { supplier: { select: { id: true, name: true } } },
      orderBy: { date: 'desc' },
    });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener gastos' });
  }
});

// POST /api/expenses
router.post('/', async (req, res) => {
  try {
    const { amount, date, category, description, paymentMethod, supplierId } = req.body;
    if (!amount) return res.status(400).json({ error: 'El monto es obligatorio' });
    if (!category) return res.status(400).json({ error: 'La categoría es obligatoria' });

    // Verify supplier belongs to this business
    if (supplierId) {
      const sup = await prisma.supplier.findFirst({ where: { id: supplierId, businessId: req.user.businessId } });
      if (!sup) return res.status(400).json({ error: 'Proveedor no encontrado' });
    }

    const expense = await prisma.expense.create({
      data: {
        amount: parseFloat(amount),
        date: date ? new Date(date) : new Date(),
        category,
        description: description || null,
        paymentMethod: paymentMethod || null,
        supplierId: supplierId || null,
        businessId: req.user.businessId,
      },
      include: { supplier: { select: { id: true, name: true } } },
    });
    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear gasto' });
  }
});

// PUT /api/expenses/:id
router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.expense.findFirst({ where: scopedWhere(req, { id: req.params.id }) });
    if (!existing) return res.status(404).json({ error: 'Gasto no encontrado' });

    const { amount, date, category, description, paymentMethod, supplierId } = req.body;

    if (supplierId) {
      const sup = await prisma.supplier.findFirst({ where: { id: supplierId, businessId: req.user.businessId } });
      if (!sup) return res.status(400).json({ error: 'Proveedor no encontrado' });
    }

    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: {
        amount:        amount        !== undefined ? parseFloat(amount)       : existing.amount,
        date:          date          !== undefined ? new Date(date)           : existing.date,
        category:      category      !== undefined ? category                 : existing.category,
        description:   description   !== undefined ? description || null      : existing.description,
        paymentMethod: paymentMethod !== undefined ? paymentMethod || null    : existing.paymentMethod,
        supplierId:    supplierId    !== undefined ? supplierId || null       : existing.supplierId,
      },
      include: { supplier: { select: { id: true, name: true } } },
    });
    res.json(expense);
  } catch (err) {
    res.status(500).json({ error: 'Error al editar gasto' });
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.expense.findFirst({ where: scopedWhere(req, { id: req.params.id }) });
    if (!existing) return res.status(404).json({ error: 'Gasto no encontrado' });
    await prisma.expense.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar gasto' });
  }
});

module.exports = router;
