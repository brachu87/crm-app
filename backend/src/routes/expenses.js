const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { scopedWhere } = require('../middleware/tenant');

const router = express.Router();
const validate = require('../lib/validate');
const schemas = require('../schemas');
router.use(authMiddleware);

function parseExpDate(s) {
  s = String(s || '').trim();
  if (!s) return new Date();
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) { let [, d, mo, y] = m; if (y.length === 2) y = '20' + y; const dt = new Date(Number(y), Number(mo) - 1, Number(d)); return isNaN(dt) ? new Date() : dt; }
  const dt = new Date(s);
  return isNaN(dt) ? new Date() : dt;
}

// POST /api/expenses/import  — alta masiva desde Excel/CSV
router.post('/import', async (req, res) => {
  try {
    const { expenses } = req.body;
    if (!Array.isArray(expenses) || expenses.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de gastos' });
    }
    const created = [];
    const errors = [];
    for (const e of expenses) {
      if (!e.category) { errors.push({ row: e, error: 'Sin categoría' }); continue; }
      const amount = parseFloat(String(e.amount).replace(/[^0-9.,-]/g, '').replace(/\.(?=.*\.)/g, '').replace(',', '.'));
      if (!amount || isNaN(amount)) { errors.push({ row: e, error: 'Monto inválido' }); continue; }
      try {
        const exp = await prisma.expense.create({
          data: {
            amount,
            category: e.category,
            description: e.description || null,
            paymentMethod: e.paymentMethod || null,
            date: parseExpDate(e.date),
            businessId: req.user.businessId,
          },
        });
        created.push(exp);
      } catch (er) {
        errors.push({ row: e, error: er.message });
      }
    }
    res.status(201).json({ created: created.length, errors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al importar gastos' });
  }
});

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
router.post('/', validate(schemas.expenseCreate), async (req, res) => {
  try {
    const { amount, date, category, description, paymentMethod, supplierId } = req.body;
    if (!amount) return res.status(400).json({ error: 'El monto es obligatorio' });
    const _amt = parseFloat(amount);
    if (isNaN(_amt) || _amt <= 0) return res.status(400).json({ error: 'El monto debe ser un número mayor a 0' });
    if (!category) return res.status(400).json({ error: 'La categoría es obligatoria' });

    // Verify supplier belongs to this business
    if (supplierId) {
      const sup = await prisma.supplier.findFirst({ where: { id: supplierId, businessId: req.user.businessId } });
      if (!sup) return res.status(400).json({ error: 'Proveedor no encontrado' });
    }

    const expense = await prisma.expense.create({
      data: {
        amount: _amt,
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
router.put('/:id', validate(schemas.expenseUpdate), async (req, res) => {
  try {
    const existing = await prisma.expense.findFirst({ where: scopedWhere(req, { id: req.params.id }) });
    if (!existing) return res.status(404).json({ error: 'Gasto no encontrado' });

    const { amount, date, category, description, paymentMethod, supplierId } = req.body;

    if (amount !== undefined) {
      const _amt = parseFloat(amount);
      if (isNaN(_amt) || _amt <= 0) return res.status(400).json({ error: 'El monto debe ser un número mayor a 0' });
    }

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
