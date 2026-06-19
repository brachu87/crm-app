const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { scopedWhere } = require('../middleware/tenant');

const router = express.Router();
router.use(authMiddleware);

// GET /api/payroll?employeeId=&status=
router.get('/', async (req, res) => {
  try {
    const { employeeId, status } = req.query;
    const where = scopedWhere(req);
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;
    const records = await prisma.payrollRecord.findMany({
      where,
      include: { employee: { select: { id: true, name: true, role: true } } },
      orderBy: { periodStart: 'desc' },
    });
    res.json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener liquidaciones' });
  }
});

// POST /api/payroll/preview — calculate totals without saving
router.post('/preview', async (req, res) => {
  try {
    const { employeeId, periodStart, periodEnd } = req.body;
    if (!employeeId || !periodStart || !periodEnd) return res.status(400).json({ error: 'Faltan datos' });

    const emp = await prisma.employee.findFirst({ where: scopedWhere(req, { id: employeeId }) });
    if (!emp) return res.status(404).json({ error: 'Empleado no encontrado' });

    const attendances = await prisma.attendance.findMany({
      where: {
        businessId: req.user.businessId,
        employeeId,
        date: { gte: new Date(periodStart), lte: new Date(periodEnd) },
      },
      orderBy: { date: 'asc' },
    });

    const totalHours = attendances.reduce((s, a) => s + (a.status !== 'absent' ? a.hoursWorked : 0), 0);
    const presentDays = attendances.filter(a => a.status !== 'absent').length;
    const absentDays = attendances.filter(a => a.status === 'absent').length;
    const rate = emp.salary || 0;
    let totalAmount = 0;
    if (emp.payType === 'hourly') {
      totalAmount = totalHours * rate;
    } else {
      // fixed: prorate if needed — just return the full fixed amount for now
      totalAmount = rate;
    }

    res.json({
      employee: { id: emp.id, name: emp.name, payType: emp.payType, payFrequency: emp.payFrequency, salary: emp.salary },
      periodStart,
      periodEnd,
      totalHours,
      presentDays,
      absentDays,
      payRate: rate,
      payType: emp.payType,
      totalAmount,
      attendances,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al calcular liquidación' });
  }
});

// POST /api/payroll — create payroll record
router.post('/', async (req, res) => {
  try {
    const { employeeId, periodStart, periodEnd, totalHours, payRate, payType, totalAmount, notes } = req.body;
    if (!employeeId || !periodStart || !periodEnd) return res.status(400).json({ error: 'Faltan datos' });

    const emp = await prisma.employee.findFirst({ where: scopedWhere(req, { id: employeeId }) });
    if (!emp) return res.status(404).json({ error: 'Empleado no encontrado' });

    const record = await prisma.payrollRecord.create({
      data: {
        businessId: req.user.businessId,
        employeeId,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        totalHours: parseFloat(totalHours) || 0,
        payRate: parseFloat(payRate) || 0,
        payType: payType || emp.payType,
        totalAmount: parseFloat(totalAmount) || 0,
        notes: notes || null,
        status: 'pending',
      },
      include: { employee: { select: { id: true, name: true, role: true } } },
    });
    res.status(201).json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear liquidación' });
  }
});

// PUT /api/payroll/:id — mark paid or edit
router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.payrollRecord.findFirst({ where: scopedWhere(req, { id: req.params.id }) });
    if (!existing) return res.status(404).json({ error: 'Liquidación no encontrada' });
    const { status, notes, totalAmount } = req.body;
    const record = await prisma.payrollRecord.update({
      where: { id: req.params.id },
      data: {
        status: status !== undefined ? status : existing.status,
        paidAt: status === 'paid' && existing.status !== 'paid' ? new Date() : existing.paidAt,
        notes: notes !== undefined ? notes : existing.notes,
        totalAmount: totalAmount !== undefined ? parseFloat(totalAmount) : existing.totalAmount,
      },
      include: { employee: { select: { id: true, name: true, role: true } } },
    });
    res.json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar liquidación' });
  }
});

// DELETE /api/payroll/:id
router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.payrollRecord.findFirst({ where: scopedWhere(req, { id: req.params.id }) });
    if (!existing) return res.status(404).json({ error: 'Liquidación no encontrada' });
    await prisma.payrollRecord.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar liquidación' });
  }
});

module.exports = router;
