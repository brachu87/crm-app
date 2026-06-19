const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const prisma = require('../prisma');

// GET all schedules
router.get('/', auth, async (req, res) => {
  try {
    const { branchId, activityId, employeeId } = req.query;
    const where = { businessId: req.user.businessId, active: true };
    if (branchId) where.branchId = branchId;
    if (activityId) where.activityId = activityId;
    if (employeeId) where.employeeId = employeeId;
    const schedules = await prisma.classSchedule.findMany({
      where,
      include: {
        activity: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } }
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }]
    });
    res.json(schedules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create schedule
router.post('/', auth, async (req, res) => {
  const { activityId, employeeId, branchId, dayOfWeek, startTime, endTime, maxCapacity } = req.body;
  if (!activityId || dayOfWeek === undefined || !startTime || !endTime) {
    return res.status(400).json({ error: 'activityId, dayOfWeek, startTime y endTime son requeridos' });
  }
  try {
    const schedule = await prisma.classSchedule.create({
      data: {
        businessId: req.user.businessId,
        activityId,
        employeeId: employeeId || null,
        branchId: branchId || null,
        dayOfWeek: Number(dayOfWeek),
        startTime,
        endTime,
        maxCapacity: maxCapacity ? Number(maxCapacity) : null
      },
      include: {
        activity: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } }
      }
    });
    res.status(201).json(schedule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update schedule
router.put('/:id', auth, async (req, res) => {
  const { activityId, employeeId, branchId, dayOfWeek, startTime, endTime, maxCapacity, active } = req.body;
  try {
    const existing = await prisma.classSchedule.findFirst({ where: { id: req.params.id, businessId: req.user.businessId } });
    if (!existing) return res.status(404).json({ error: 'Horario no encontrado' });
    const schedule = await prisma.classSchedule.update({
      where: { id: req.params.id },
      data: {
        activityId: activityId || existing.activityId,
        employeeId: employeeId !== undefined ? (employeeId || null) : existing.employeeId,
        branchId: branchId !== undefined ? (branchId || null) : existing.branchId,
        dayOfWeek: dayOfWeek !== undefined ? Number(dayOfWeek) : existing.dayOfWeek,
        startTime: startTime || existing.startTime,
        endTime: endTime || existing.endTime,
        maxCapacity: maxCapacity !== undefined ? (maxCapacity ? Number(maxCapacity) : null) : existing.maxCapacity,
        active: active !== undefined ? active : existing.active
      },
      include: {
        activity: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } }
      }
    });
    res.json(schedule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE schedule
router.delete('/:id', auth, async (req, res) => {
  try {
    const existing = await prisma.classSchedule.findFirst({ where: { id: req.params.id, businessId: req.user.businessId } });
    if (!existing) return res.status(404).json({ error: 'Horario no encontrado' });
    await prisma.classSchedule.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
