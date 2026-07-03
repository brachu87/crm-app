const express = require('express');
const router = express.Router();
const validate = require('../lib/validate');
const schemas = require('../schemas');
const auth = require('../middleware/auth');
const prisma = require('../prisma');
const gcal = require('../lib/googleCalendar');

router.use(auth);

const INCLUDE = {
  client: { select: { id: true, name: true, phone: true } },
  employee: { select: { id: true, name: true } },
  service: { select: { id: true, name: true, duration: true } },
};

// GET /api/appointments
router.get('/', async (req, res) => {
  try {
    const { serviceId, clientId, from, to, status, paymentStatus, isQuickWork } = req.query;
    const where = { businessId: req.user.businessId };
    if (serviceId) where.serviceId = serviceId;
    if (clientId) where.clientId = clientId;
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (isQuickWork !== undefined) where.isQuickWork = isQuickWork === 'true';
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
router.post('/', validate(schemas.appointmentCreate), async (req, res) => {
  try {
    const {
      serviceId, clientId, employeeId, branchId,
      date, startTime, endTime, price, notes,
      description, isQuickWork,
    } = req.body;

    if (isQuickWork) {
      // Quick work: just needs client, description, price, date
      if (!clientId || !date)
        return res.status(400).json({ error: 'Faltan campos requeridos' });
      const a = await prisma.appointment.create({
        data: {
          businessId: req.user.businessId,
          clientId,
          employeeId: employeeId || null,
          branchId: branchId || null,
          description: description || null,
          date,
          startTime: startTime || '',
          endTime: endTime || '',
          price: parseFloat(price) || 0,
          notes: notes || null,
          isQuickWork: true,
          status: 'completed',
          paymentStatus: 'pending',
        },
        include: INCLUDE,
      });
      gcal.syncAppointment(req.user.businessId, a);
      return res.status(201).json(a);
    }

    // Regular appointment
    if (!serviceId || !clientId || !date || !startTime || !endTime)
      return res.status(400).json({ error: 'Faltan campos requeridos' });

    // Evitar que el cliente quede con turnos superpuestos el mismo día
    const overlap = await prisma.appointment.findFirst({
      where: {
        businessId: req.user.businessId,
        clientId, date,
        isQuickWork: false,
        status: { not: 'cancelled' },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });
    if (overlap)
      return res.status(409).json({ error: `El cliente ya tiene un turno de ${overlap.startTime} a ${overlap.endTime} ese día. Elegí otro horario.` });

    const a = await prisma.appointment.create({
      data: {
        businessId: req.user.businessId,
        serviceId, clientId,
        employeeId: employeeId || null,
        branchId: branchId || null,
        date, startTime, endTime,
        price: parseFloat(price) || 0,
        notes: notes || null,
        isQuickWork: false,
      },
      include: INCLUDE,
    });
    gcal.syncAppointment(req.user.businessId, a);
    res.status(201).json(a);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

// PUT /api/appointments/:id
router.put('/:id', async (req, res) => {
  try {
    const { status, paymentStatus, price, notes, employeeId, date, startTime, endTime, description } = req.body;
    const data = {};
    if (status !== undefined) data.status = status;
    if (paymentStatus !== undefined) {
      data.paymentStatus = paymentStatus;
      data.paidAt = paymentStatus === 'paid' ? new Date() : null;
    }
    if (price !== undefined) data.price = parseFloat(price);
    if (notes !== undefined) data.notes = notes || null;
    if (description !== undefined) data.description = description || null;
    if (employeeId !== undefined) data.employeeId = employeeId || null;
    if (date !== undefined) data.date = date;
    if (startTime !== undefined) data.startTime = startTime;
    if (endTime !== undefined) data.endTime = endTime;

    const a = await prisma.appointment.update({
      where: { id: req.params.id }, data, include: INCLUDE,
    });
    gcal.syncAppointment(req.user.businessId, a);
    res.json(a);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

// DELETE /api/appointments/:id
router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.appointment.findUnique({ where: { id: req.params.id } });
    await prisma.appointment.delete({ where: { id: req.params.id } });
    if (existing && existing.gcalEventId) gcal.removeEvent(req.user.businessId, existing.gcalEventId);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

module.exports = router;
