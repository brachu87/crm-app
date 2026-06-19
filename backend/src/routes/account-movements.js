const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { scopedWhere } = require('../middleware/tenant');

const router = express.Router({ mergeParams: true });
router.use(authMiddleware);

// GET /api/clients/:id/account — saldo + movimientos
router.get('/', async (req, res) => {
  try {
    const [client, appointments] = await Promise.all([
      prisma.client.findFirst({
        where: scopedWhere(req, { id: req.params.id }),
        include: {
          enrollments: { include: { cuotas: { include: { payments: true } } } },
          accountMovements: { orderBy: { date: 'desc' } },
        },
      }),
      prisma.appointment.findMany({
        where: { clientId: req.params.id, businessId: req.user.businessId, status: 'completed' },
        include: { service: { select: { name: true } }, employee: { select: { name: true } } },
        // isQuickWork and description are scalar fields, always returned
        orderBy: { date: 'desc' },
      }),
    ]);
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

    const allCuotas = client.enrollments.flatMap((e) => e.cuotas);
    const totalCharged = allCuotas.reduce((s, c) => s + Math.max(0, c.amountDue - (c.discount || 0)), 0);
    const totalPaid    = allCuotas.reduce((s, c) => s + c.payments.reduce((p, pay) => p + pay.amount, 0), 0);
    const manualCargos = client.accountMovements.filter(m => m.type === 'cargo').reduce((s, m) => s + m.amount, 0);
    const manualAbonos = client.accountMovements.filter(m => m.type === 'abono').reduce((s, m) => s + m.amount, 0);

    // Appointments: completed = cargo; paid = also abono (cancels it)
    const apptCharged = appointments.reduce((s, a) => s + (a.price || 0), 0);
    const apptPaid    = appointments.filter(a => a.paymentStatus === 'paid').reduce((s, a) => s + (a.price || 0), 0);

    const balance = totalCharged + manualCargos + apptCharged - totalPaid - manualAbonos - apptPaid;

    // Build appointment movements for display
    const appointmentMovements = appointments.map(a => ({
      id: a.id,
      type: a.paymentStatus === 'paid' ? 'paid' : 'pending',
      amount: a.price || 0,
      description: a.isQuickWork ? `${a.description || 'Trabajo realizado'}${a.employee ? ' · ' + a.employee.name : ''}` : `Turno: ${a.service?.name || 'Servicio'}${a.employee ? ' · ' + a.employee.name : ''}${a.startTime ? ' — ' + a.startTime + '–' + a.endTime : ''}`,
      date: a.date + 'T12:00:00.000Z',
      paymentStatus: a.paymentStatus,
      isAppointment: true,
    }));

    res.json({
      totalCharged,
      totalPaid,
      manualCargos,
      manualAbonos,
      apptCharged,
      apptPaid,
      balance,
      movements: client.accountMovements,
      appointmentMovements,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al obtener cuenta corriente' }); }
});

// POST /api/clients/:id/account — agregar movimiento manual
router.post('/', async (req, res) => {
  try {
    const client = await prisma.client.findFirst({ where: scopedWhere(req, { id: req.params.id }) });
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
    const { type, amount, description, date } = req.body;
    if (!['cargo', 'abono'].includes(type)) return res.status(400).json({ error: 'Tipo inválido' });
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Monto inválido' });
    const movement = await prisma.accountMovement.create({
      data: {
        clientId: req.params.id,
        businessId: req.user.businessId,
        type,
        amount: Number(amount),
        description: description || null,
        date: date ? new Date(date) : new Date(),
      },
    });
    res.status(201).json(movement);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al crear movimiento' }); }
});

// DELETE /api/clients/:id/account/:movId
router.delete('/:movId', async (req, res) => {
  try {
    const client = await prisma.client.findFirst({ where: scopedWhere(req, { id: req.params.id }) });
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
    // Validar que el movimiento pertenezca a este cliente y negocio antes de borrar
    const movement = await prisma.accountMovement.findFirst({
      where: { id: req.params.movId, clientId: req.params.id, businessId: req.user.businessId },
    });
    if (!movement) return res.status(404).json({ error: 'Movimiento no encontrado' });
    await prisma.accountMovement.delete({ where: { id: req.params.movId } });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al eliminar movimiento' }); }
});

module.exports = router;
