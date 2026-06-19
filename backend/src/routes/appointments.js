const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const prisma = require('../prisma');

router.use(auth);

const INCLUDE = {
  client: { select: { id: true, name: true, phone: true } },
  employee: { select: { id: true, name: true } },
  service: { select: { id: true, name: true, duration: true } },
};

// GET /api/appointments?serviceId=&clientId=&date=&from=&to=
router.get('/', async (req, res) => {
  try {
    const { serviceId, clientId, from, to, status, paymentStatus } = req.query;
    const where = { businessId: req.user.businessId };
    if (serviceId) where.serviceId = serviceId;
    if (clientId) where.clientId = clientId;
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = from;
      if (to) where.date.lte = to;
    }
    const appts = await prisma.appointment.findMany({
      where, include: INCLUDE,
      orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
    });
    res.json(appts);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

// POST /api/appointments
router.post('/', async (req, res) => {
  try {
    const { serviceId, clientId, employeeId, branchId, date, startTime, endTime, price, notes } = req.body;
    if (!serviceId || !clientId || !date || !startTime || !endTime)
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    const a = await prisma.appointment.create({
      data: {
        businessId: req.user.businessId,
        serviceId, clientId,
        employeeId: employeeId || null,
        branchId: branchId || null,
        date, startTime, endTime,
        price: parseFloat(price) || 0,
        notes: notes || null,
      },
      include: INCLUDE,
    });
    res.status(201).json(a);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

// PUT /api/appointments/:id
router.put('/:id', async (req, res) => {
  try {
    const { status, paymentStatus, price, notes, employeeId, date, startTime, endTime } = req.body;
    const data = {};
    if (status !== undefined) {
      data.status = status;
    }
    if (paymentStatus !== undefined) {
      data.paymentStatus = paymentStatus;
      data.paidAt = paymentStatus === 'paid' ? new Date() : null;
    }
    if (price !== undefined) data.price = parseFloat(price);
    if (notes !== undefined) data.notes = notes || null;
    if (employeeId !== undefined) data.employeeId = employeeId || null;
    if (date !== undefined) data.date = date;
    if (startTime !== undefined) data.startTime = startTime;
    if (endTime !== undefined) data.endTime = endTime;

    const a = await prisma.appointment.update({
      where: { id: req.params.id }, data, include: INCLUDE,
    });
    res.json(a);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

// DELETE /api/appointments/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.appointment.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

module.exports = router;
