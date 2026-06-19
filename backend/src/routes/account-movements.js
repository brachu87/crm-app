const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { scopedWhere } = require('../middleware/tenant');

const router = express.Router({ mergeParams: true });
router.use(authMiddleware);

// GET /api/clients/:id/account — saldo + movimientos
router.get('/', async (req, res) => {
  try {
    const client = await prisma.client.findFirst({
      where: scopedWhere(req, { id: req.params.id }),
      include: {
        enrollments: { include: { cuotas: { include: { payments: true } } } },
        accountMovements: { orderBy: { date: 'desc' } },
      },
    });
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

    // Compute balance from cuotas (cargo por período) + payments + manual movements.
    // Se suma el neto de CADA cuota, de modo que los cargos mensuales acompañen a los pagos.
    const allCuotas = client.enrollments.flatMap((e) => e.cuotas);
    const totalCharged = allCuotas.reduce((s, c) => s + Math.max(0, c.amountDue - (c.discount || 0)), 0);
    const totalPaid = allCuotas.reduce((s, c) => s + c.payments.reduce((p, pay) => p + pay.amount, 0), 0);
    const manualCargos = client.accountMovements.filter(m => m.type === 'cargo').reduce((s, m) => s + m.amount, 0);
    const manualAbonos = client.accountMovements.filter(m => m.type === 'abono').reduce((s, m) => s + m.amount, 0);
    const balance = totalCharged + manualCargos - totalPaid - manualAbonos;

    res.json({
      totalCharged,
      totalPaid,
      manualCargos,
      manualAbonos,
      balance,
      movements: client.accountMovements,
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
