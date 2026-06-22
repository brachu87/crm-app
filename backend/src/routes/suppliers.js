const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { scopedWhere } = require('../middleware/tenant');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const [suppliers, totals] = await Promise.all([
      prisma.supplier.findMany({ where: scopedWhere(req), orderBy: { name: 'asc' } }),
      prisma.expense.groupBy({
        by: ['supplierId'],
        where: { businessId: req.user.businessId, supplierId: { not: null } },
        _sum: { amount: true },
      }),
    ]);
    const totalsMap = Object.fromEntries(totals.map(t => [t.supplierId, t._sum.amount || 0]));
    const result = suppliers.map(s => ({ ...s, totalExpenses: totalsMap[s.id] || 0 }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener proveedores' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, contact, phone, email, cuit, dni, category, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const supplier = await prisma.supplier.create({
      data: {
        name,
        contact: contact || null,
        phone: phone || null,
        email: email || null,
        cuit: cuit || null,
        dni: dni || null,
        category: category || null,
        notes: notes || null,
        businessId: req.user.businessId,
      },
    });
    res.status(201).json(supplier);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear proveedor' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.supplier.findFirst({ where: scopedWhere(req, { id: req.params.id }) });
    if (!existing) return res.status(404).json({ error: 'Proveedor no encontrado' });
    const { name, contact, phone, email, cuit, category, notes } = req.body;
    const supplier = await prisma.supplier.update({
      where: { id: req.params.id },
      data: { name, contact: contact || null, phone: phone || null, email: email || null, cuit: cuit || null, dni: dni || null, category: category || null, notes: notes || null },
    });
    res.json(supplier);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al editar proveedor' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.supplier.findFirst({ where: scopedWhere(req, { id: req.params.id }) });
    if (!existing) return res.status(404).json({ error: 'Proveedor no encontrado' });
    await prisma.supplier.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar proveedor' });
  }
});

// GET /api/suppliers/:id — detalle del proveedor
router.get('/:id', async (req, res) => {
  try {
    const supplier = await prisma.supplier.findFirst({
      where: scopedWhere(req, { id: req.params.id }),
    });
    if (!supplier) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json(supplier);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/suppliers/:id/account — cuenta corriente del proveedor
router.get('/:id/account', async (req, res) => {
  try {
    const supplier = await prisma.supplier.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId },
    });
    if (!supplier) return res.status(404).json({ error: 'Proveedor no encontrado' });

    const where = { supplierId: req.params.id };
    if (req.query.from) where.date = { ...where.date, gte: new Date(req.query.from) };
    if (req.query.to)   where.date = { ...where.date, lte: new Date(req.query.to + 'T23:59:59') };

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    const total = expenses.reduce((s, e) => s + e.amount, 0);

    res.json({ supplier, expenses, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
