const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { scopedWhere } = require('../middleware/tenant');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: scopedWhere(req),
      orderBy: { name: 'asc' },
    });
    res.json(suppliers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener proveedores' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, contact, phone, email, cuit, category, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const supplier = await prisma.supplier.create({
      data: {
        name,
        contact: contact || null,
        phone: phone || null,
        email: email || null,
        cuit: cuit || null,
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
      data: { name, contact: contact || null, phone: phone || null, email: email || null, cuit: cuit || null, category: category || null, notes: notes || null },
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

module.exports = router;
