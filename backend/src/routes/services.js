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
      include: {
        employee: { select: { id: true, name: true } },
        schedules: { where: { active: true }, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
      },
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
    const own = await prisma.service.findFirst({ where: { id: req.params.id, businessId: req.user.businessId } });
    if (!own) return res.status(404).json({ error: 'Servicio no encontrado' });
    const { name, description, duration, price, employeeId, active, onlineBooking } = req.body;
    const s = await prisma.service.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(duration !== undefined && { duration: parseInt(duration) }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(employeeId !== undefined && { employeeId: employeeId || null }),
        ...(active !== undefined && { active }),
        ...(onlineBooking !== undefined && { onlineBooking: !!onlineBooking }),
      },
      include: { employee: { select: { id: true, name: true } } },
    });
    res.json(s);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

// DELETE /api/services/:id
router.delete('/:id', async (req, res) => {
  try {
    const own = await prisma.service.findFirst({ where: { id: req.params.id, businessId: req.user.businessId } });
    if (!own) return res.status(404).json({ error: 'Servicio no encontrado' });
    await prisma.service.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});


// ── Horarios de atención por servicio ──────────────────────────────
function validHHMM(t) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || '')); }

// GET /api/services/:id/schedules
router.get('/:id/schedules', async (req, res) => {
  try {
    const svc = await prisma.service.findFirst({ where: { id: req.params.id, businessId: req.user.businessId } });
    if (!svc) return res.status(404).json({ error: 'Servicio no encontrado' });
    const schedules = await prisma.serviceSchedule.findMany({
      where: { serviceId: svc.id, active: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    res.json(schedules);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

// PUT /api/services/:id/schedules — reemplaza todo el set de horarios del servicio
// body: { schedules: [{ dayOfWeek, startTime, endTime }] }
router.put('/:id/schedules', async (req, res) => {
  try {
    const svc = await prisma.service.findFirst({ where: { id: req.params.id, businessId: req.user.businessId } });
    if (!svc) return res.status(404).json({ error: 'Servicio no encontrado' });
    const list = Array.isArray(req.body.schedules) ? req.body.schedules : [];
    // Validar
    const clean = [];
    for (const it of list) {
      const day = Number(it.dayOfWeek);
      if (!(day >= 0 && day <= 6)) return res.status(400).json({ error: 'Día inválido' });
      if (!validHHMM(it.startTime) || !validHHMM(it.endTime)) return res.status(400).json({ error: 'Horario inválido (usá HH:MM)' });
      if (it.startTime >= it.endTime) return res.status(400).json({ error: 'La hora de inicio debe ser menor a la de fin' });
      clean.push({ businessId: req.user.businessId, serviceId: svc.id, dayOfWeek: day, startTime: it.startTime, endTime: it.endTime });
    }
    await prisma.$transaction([
      prisma.serviceSchedule.deleteMany({ where: { serviceId: svc.id } }),
      ...(clean.length ? [prisma.serviceSchedule.createMany({ data: clean })] : []),
    ]);
    const schedules = await prisma.serviceSchedule.findMany({
      where: { serviceId: svc.id, active: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    res.json(schedules);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al guardar horarios' }); }
});

module.exports = router;
