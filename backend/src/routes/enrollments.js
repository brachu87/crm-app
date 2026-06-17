const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// Helper: verifica que un client/activity pertenezcan al tenant actual
async function verifyOwnership(req, clientId, activityId) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, businessId: req.user.businessId },
  });
  const activity = await prisma.activity.findFirst({
    where: { id: activityId, businessId: req.user.businessId },
  });
  return client && activity;
}

// GET /api/enrollments?status=pending|paid|overdue
// Vista de cobranza: todas las inscripciones del negocio, filtrables por estado
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;

    const enrollments = await prisma.enrollment.findMany({
      where: {
        client: { businessId: req.user.businessId },
        ...(status ? { paymentStatus: status } : {}),
      },
      include: {
        client: true,
        activity: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    res.json(enrollments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener inscripciones' });
  }
});

// POST /api/enrollments - inscribir cliente a una actividad
router.post('/', async (req, res) => {
  try {
    const { clientId, activityId, amountDue, dueDate, paymentStatus, bonificada, bonificadaHasta } = req.body;

    if (!clientId || !activityId || amountDue === undefined) {
      return res.status(400).json({ error: 'clientId, activityId y amountDue son obligatorios' });
    }

    const ok = await verifyOwnership(req, clientId, activityId);
    if (!ok) return res.status(404).json({ error: 'Cliente o actividad no encontrados' });

    const enrollment = await prisma.enrollment.create({
      data: {
        clientId,
        activityId,
        amountDue,
        discount: req.body.discount ? parseFloat(req.body.discount) : 0,
        dueDate: dueDate ? new Date(dueDate) : null,
        paymentStatus: paymentStatus || 'pending',
        bonificada: bonificada || false,
        bonificadaHasta: bonificadaHasta ? new Date(bonificadaHasta) : null,
      },
      include: { client: true, activity: true },
    });

    res.status(201).json(enrollment);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'El cliente ya está inscripto en esta actividad' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al crear inscripción' });
  }
});

// PATCH /api/enrollments/:id - actualizar estado de pago, monto, vencimiento, activo
router.patch('/:id', async (req, res) => {
  try {
    const existing = await prisma.enrollment.findFirst({
      where: { id: req.params.id, client: { businessId: req.user.businessId } },
    });
    if (!existing) return res.status(404).json({ error: 'Inscripción no encontrada' });

    const { paymentStatus, amountDue, dueDate, active, discount, bonificada, bonificadaHasta } = req.body;

    const enrollment = await prisma.enrollment.update({
      where: { id: req.params.id },
      data: {
        ...(paymentStatus !== undefined ? { paymentStatus } : {}),
        ...(amountDue !== undefined ? { amountDue } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(active !== undefined ? { active } : {}),
        ...(discount !== undefined ? { discount: parseFloat(discount) } : {}),
        ...(bonificada !== undefined ? { bonificada } : {}),
        ...(bonificadaHasta !== undefined ? { bonificadaHasta: bonificadaHasta ? new Date(bonificadaHasta) : null } : {}),
      },
      include: { client: true, activity: true },
    });

    res.json(enrollment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar inscripción' });
  }
});

// POST /api/enrollments/:id/pay - registrar un pago y marcar como pagado
router.post('/:id/pay', async (req, res) => {
  try {
    const existing = await prisma.enrollment.findFirst({
      where: { id: req.params.id, client: { businessId: req.user.businessId } },
    });
    if (!existing) return res.status(404).json({ error: 'Inscripción no encontrada' });

    const { amount, method } = req.body;
    if (amount === undefined) return res.status(400).json({ error: 'amount es obligatorio' });

    const [payment, enrollment] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          enrollmentId: req.params.id,
          amount,
          method,
        },
      }),
      prisma.enrollment.update({
        where: { id: req.params.id },
        data: { paymentStatus: 'paid' },
        include: { client: true, activity: true },
      }),
    ]);

    res.status(201).json({ payment, enrollment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar pago' });
  }
});

// POST /api/enrollments/renew-month - renovar cuotas del mes siguiente
router.post('/renew-month', async (req, res) => {
  try {
    const bId = req.user.businessId;
    const now = new Date();

    // Auto-mark overdue first
    await prisma.enrollment.updateMany({
      where: { activity: { businessId: bId }, paymentStatus: 'pending', dueDate: { lt: now } },
      data: { paymentStatus: 'overdue' },
    });

    // Find all active paid enrollments
    const paid = await prisma.enrollment.findMany({
      where: { activity: { businessId: bId }, paymentStatus: 'paid', active: true },
      include: { client: true, activity: true },
    });

    if (paid.length === 0) return res.json({ renewed: 0, message: 'No hay inscripciones pagadas para renovar' });

    // Next month due date: same day next month
    const nextDue = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    // Update all to pending with new dueDate
    const ids = paid.map((e) => e.id);
    await prisma.enrollment.updateMany({
      where: { id: { in: ids } },
      data: { paymentStatus: 'pending', dueDate: nextDue },
    });

    res.json({ renewed: paid.length, newDueDate: nextDue, message: `${paid.length} cuotas renovadas para ${nextDue.toLocaleDateString('es-AR')}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al renovar cuotas' });
  }
});

// DELETE /api/enrollments/:id - dar de baja la inscripción
router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.enrollment.findFirst({
      where: { id: req.params.id, client: { businessId: req.user.businessId } },
    });
    if (!existing) return res.status(404).json({ error: 'Inscripción no encontrada' });

    await prisma.enrollment.delete({ where: { id: req.params.id } });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar inscripción' });
  }
});

module.exports = router;
