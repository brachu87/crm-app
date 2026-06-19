const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const prisma = require('../prisma');

// GET all branches
router.get('/', auth, async (req, res) => {
  try {
    const branches = await prisma.branch.findMany({
      where: { businessId: req.user.businessId },
      include: {
        _count: { select: { employees: true, activities: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.json(branches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create branch
router.post('/', auth, async (req, res) => {
  const { name, address, phone } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const branch = await prisma.branch.create({
      data: { name, address: address || null, phone: phone || null, businessId: req.user.businessId }
    });
    res.status(201).json(branch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update branch
router.put('/:id', auth, async (req, res) => {
  const { name, address, phone, active } = req.body;
  try {
    const existing = await prisma.branch.findFirst({ where: { id: req.params.id, businessId: req.user.businessId } });
    if (!existing) return res.status(404).json({ error: 'Sede no encontrada' });
    const branch = await prisma.branch.update({
      where: { id: req.params.id },
      data: {
        name: name !== undefined ? name : existing.name,
        address: address !== undefined ? (address || null) : existing.address,
        phone: phone !== undefined ? (phone || null) : existing.phone,
        active: active !== undefined ? active : existing.active
      }
    });
    res.json(branch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE branch
router.delete('/:id', auth, async (req, res) => {
  try {
    const existing = await prisma.branch.findFirst({ where: { id: req.params.id, businessId: req.user.businessId } });
    if (!existing) return res.status(404).json({ error: 'Sede no encontrada' });
    // unlink employees and activities from this branch before deleting
    await prisma.employee.updateMany({ where: { branchId: req.params.id }, data: { branchId: null } });
    await prisma.activity.updateMany({ where: { branchId: req.params.id }, data: { branchId: null } });
    await prisma.classSchedule.deleteMany({ where: { branchId: req.params.id } });
    await prisma.branch.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
