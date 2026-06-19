const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { scopedWhere } = require('../middleware/tenant');

const router = express.Router();
router.use(authMiddleware);

// GET /api/attendance?employeeId=&from=&to=
router.get('/', async (req, res) => {
  try {
    const { employeeId, from, to } = req.query;
    const where = scopedWhere(req);
    if (employeeId) where.employeeId = employeeId;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }
    const records = await prisma.attendance.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, payType: true, payFrequency: true, salary: true } },
        classSchedule: { select: { id: true, startTime: true, endTime: true, dayOfWeek: true, activity: { select: { name: true } } } },
      },
      orderBy: { date: 'desc' },
    });
    res.json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener asistencias' });
  }
});

// POST /api/attendance
router.post('/', async (req, res) => {
  try {
    const { employeeId, date, status, hoursWorked, notes, classScheduleId } = req.body;
    if (!employeeId || !date) return res.status(400).json({ error: 'employeeId y date son obligatorios' });

    // Verify employee belongs to business
    const emp = await prisma.employee.findFirst({ where: scopedWhere(req, { id: employeeId }) });
    if (!emp) return res.status(404).json({ error: 'Empleado no encontrado' });

    // Upsert: one record per employee per date (or per classSchedule if provided)
    const uniqueWhere = classScheduleId
      ? { businessId: req.user.businessId, employeeId, date: new Date(date), classScheduleId }
      : { businessId: req.user.businessId, employeeId, date: new Date(date), classScheduleId: null };

    const existing = await prisma.attendance.findFirst({ where: uniqueWhere });

    let record;
    if (existing) {
      record = await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          status: status || 'present',
          hoursWorked: hoursWorked !== undefined ? parseFloat(hoursWorked) : existing.hoursWorked,
          notes: notes !== undefined ? notes : existing.notes,
        },
        include: { employee: { select: { id: true, name: true } } },
      });
    } else {
      record = await prisma.attendance.create({
        data: {
          businessId: req.user.businessId,
          employeeId,
          date: new Date(date),
          status: status || 'present',
          hoursWorked: hoursWorked !== undefined ? parseFloat(hoursWorked) : 0,
          notes: notes || null,
          classScheduleId: classScheduleId || null,
        },
        include: { employee: { select: { id: true, name: true } } },
      });
    }
    res.status(201).json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar asistencia' });
  }
});

// PUT /api/attendance/:id
router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.attendance.findFirst({ where: scopedWhere(req, { id: req.params.id }) });
    if (!existing) return res.status(404).json({ error: 'Registro no encontrado' });
    const { status, hoursWorked, notes } = req.body;
    const record = await prisma.attendance.update({
      where: { id: req.params.id },
      data: {
        status: status !== undefined ? status : existing.status,
        hoursWorked: hoursWorked !== undefined ? parseFloat(hoursWorked) : existing.hoursWorked,
        notes: notes !== undefined ? notes : existing.notes,
      },
    });
    res.json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar asistencia' });
  }
});

// DELETE /api/attendance/:id
router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.attendance.findFirst({ where: scopedWhere(req, { id: req.params.id }) });
    if (!existing) return res.status(404).json({ error: 'Registro no encontrado' });
    await prisma.attendance.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar registro' });
  }
});

module.exports = router;
