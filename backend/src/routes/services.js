const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const prisma = require('../prisma');

router.use(auth);

// GET /api/services
router.get('/', async (req, res) => {
  try {
    const services = await prisma.service.findMany({
      where: { businessId: req.user.businessId },
      include: { employee: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(services);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

// POST /api/services
router.post('/', async (req, res) => {
  try {
    const { name, description, duration, price, employeeId } = req.body;
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    const s = await prisma.service.create({
      data: {
        businessId: req.user.businessId,
        name, description: description || null,
        duration: parseInt(duration) || 60,
        price: parseFloat(price) || 0,
        employeeId: employeeId || null,
      },
      include: { employee: { select: { id: true, name: true } } },
    });
    res.status(201).json(s);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

// PUT /api/services/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, description, duration, price, employeeId, active } = req.body;
    const s = await prisma.service.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(duration !== undefined && { duration: parseInt(duration) }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(employeeId !== undefined && { employeeId: employeeId || null }),
        ...(active !== undefined && { active }),
      },
      include: { employee: { select: { id: true, name: true } } },
    });
    res.json(s);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

// DELETE /api/services/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.service.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

module.exports = router;
