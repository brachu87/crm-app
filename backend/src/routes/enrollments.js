const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { periodKey } = require('../lib/period');

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

// Aplana una cuota + su membresía en la forma que consume Cobranza.
// El `id` expuesto es el de la CUOTA (es la unidad que se cobra/edita).
function shapeCuota(c) {
  const { enrollment, ...cuota } = c;
  return {
    ...cuota, // id, enrollmentId, period, amountDue, discount, paymentStatus, dueDate, createdAt, payments
    cuotaId: c.id,
    clientId: enrollment.clientId,
    startDate: enrollment.startDate,
    active: enrollment.active,
    bonificada: enrollment.bonificada,
    client: enrollment.client,
    activity: enrollment.activity,
  };
}

// GET /api/enrollments?status=pending|paid|overdue   o   ?partial=true
// Devuelve CUOTAS (de inscripciones activas) con la membresía embebida.
router.get('/', async (req, res) => {
  try {
    const { status, partial } = req.query;
    const baseWhere = { enrollment: { client: { businessId: req.user.businessId }, active: true } };

    // Caso especial: cuotas con saldo pendiente (pago parcial o sin pagos)
    if (partial === 'true') {
      const all = await prisma.cuota.findMany({
        where: baseWhere,
        include: {
          enrollment: { include: { client: true, activity: true } },
          payments: { select: { amount: true } },
        },
        orderBy: { dueDate: 'asc' },
      });
      // NOTA: comparación contra el monto BRUTO (ignora descuento) — bug a corregir en paso #2.
      const withBalance = all.filter((c) => {
        const totalPaid = c.payments.reduce((s, p) => s + p.amount, 0);
        return totalPaid < c.amountDue;
      });
      return res.json(withBalance.map(shapeCuota));
    }

    const cuotas = await prisma.cuota.findMany({
      where: { ...baseWhere, ...(status ? { paymentStatus: status } : {}) },
      include: {
        enrollment: { include: { client: true, activity: true } },
        payments: { orderBy: { date: 'desc' } },
      },
      orderBy: { dueDate: 'asc' },
    });

    res.json(cuotas.map(shapeCuota));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener inscripciones' });
  }
});

// POST /api/enrollments - inscribir cliente a una actividad (crea membresía + primera cuota)
router.post('/', async (req, res) => {
  try {
    const { clientId, activityId, amountDue, dueDate, startDate, paymentStatus, bonificada, bonificadaHasta } = req.body;

    if (!clientId || !activityId || amountDue === undefined) {
      return res.status(400).json({ error: 'clientId, activityId y amountDue son obligatorios' });
    }

    const ok = await verifyOwnership(req, clientId, activityId);
    if (!ok) return res.status(404).json({ error: 'Cliente o actividad no encontrados' });

    const start = startDate ? new Date(startDate) : new Date();
    const discount = req.body.discount ? parseFloat(req.body.discount) : 0;

    const enrollment = await prisma.enrollment.create({
      data: {
        clientId,
        activityId,
        amountDue,
        discount,
        startDate: start,
        bonificada: bonificada || false,
        bonificadaHasta: bonificadaHasta ? new Date(bonificadaHasta) : null,
        // Primera cuota del período de alta
        cuotas: {
          create: {
            period: periodKey(start),
            amountDue,
            discount,
            paymentStatus: paymentStatus || 'pending',
            dueDate: dueDate ? new Date(dueDate) : null,
          },
        },
      },
      include: { client: true, activity: true, cuotas: true },
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

// PATCH /api/enrollments/cuotas/:cuotaId - actualizar una cuota puntual
router.patch('/cuotas/:cuotaId', async (req, res) => {
  try {
    const existing = await prisma.cuota.findFirst({
      where: { id: req.params.cuotaId, enrollment: { client: { businessId: req.user.businessId } } },
    });
    if (!existing) return res.status(404).json({ error: 'Cuota no encontrada' });

    const { paymentStatus, amountDue, dueDate, discount, startDate } = req.body;

    const cuota = await prisma.cuota.update({
      where: { id: req.params.cuotaId },
      data: {
        ...(paymentStatus !== undefined ? { paymentStatus } : {}),
        ...(amountDue !== undefined ? { amountDue: parseFloat(amountDue) } : {}),
        ...(discount !== undefined ? { discount: parseFloat(discount) } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      },
      include: { enrollment: { include: { client: true, activity: true } }, payments: true },
    });

    // startDate pertenece a la membresía
    if (startDate !== undefined) {
      await prisma.enrollment.update({
        where: { id: existing.enrollmentId },
        data: { startDate: startDate ? new Date(startDate) : null },
      });
    }

    res.json(shapeCuota(cuota));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar cuota' });
  }
});

// PATCH /api/enrollments/:id - actualizar la membresía (estado activo, beca, monto base)
router.patch('/:id', async (req, res) => {
  try {
    const existing = await prisma.enrollment.findFirst({
      where: { id: req.params.id, client: { businessId: req.user.businessId } },
    });
    if (!existing) return res.status(404).json({ error: 'Inscripción no encontrada' });

    const { amountDue, startDate, active, discount, bonificada, bonificadaHasta } = req.body;

    const enrollment = await prisma.enrollment.update({
      where: { id: req.params.id },
      data: {
        ...(amountDue !== undefined ? { amountDue: parseFloat(amountDue) } : {}),
        ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
        ...(active !== undefined ? { active } : {}),
        ...(discount !== undefined ? { discount: parseFloat(discount) } : {}),
        ...(bonificada !== undefined ? { bonificada } : {}),
        ...(bonificadaHasta !== undefined ? { bonificadaHasta: bonificadaHasta ? new Date(bonificadaHasta) : null } : {}),
      },
      include: { client: true, activity: true },
    });

    // Si cambió el monto/descuento base, reflejarlo en la última cuota no pagada (display de cobranza)
    if (amountDue !== undefined || discount !== undefined) {
      const lastOpen = await prisma.cuota.findFirst({
        where: { enrollmentId: enrollment.id, paymentStatus: { not: 'paid' } },
        orderBy: { period: 'desc' },
      });
      if (lastOpen) {
        await prisma.cuota.update({
          where: { id: lastOpen.id },
          data: {
            ...(amountDue !== undefined ? { amountDue: parseFloat(amountDue) } : {}),
            ...(discount !== undefined ? { discount: parseFloat(discount) } : {}),
          },
        });
      }
    }

    res.json(enrollment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar inscripción' });
  }
});

// POST /api/enrollments/cuotas/:cuotaId/pay - registrar un pago y recalcular estado
router.post('/cuotas/:cuotaId/pay', async (req, res) => {
  try {
    const existing = await prisma.cuota.findFirst({
      where: { id: req.params.cuotaId, enrollment: { client: { businessId: req.user.businessId } } },
    });
    if (!existing) return res.status(404).json({ error: 'Cuota no encontrada' });

    const { amount, method } = req.body;
    if (amount === undefined) return res.status(400).json({ error: 'amount es obligatorio' });

    const payment = await prisma.payment.create({
      data: { cuotaId: req.params.cuotaId, amount: parseFloat(amount), method },
    });

    const agg = await prisma.payment.aggregate({
      where: { cuotaId: req.params.cuotaId },
      _sum: { amount: true },
    });
    const totalPaid = agg._sum.amount || 0;

    // NOTA: compara contra el monto BRUTO (ignora descuento) — bug a corregir en paso #2.
    const newStatus = totalPaid >= existing.amountDue ? 'paid' : 'pending';

    const cuota = await prisma.cuota.update({
      where: { id: req.params.cuotaId },
      data: { paymentStatus: newStatus },
      include: { enrollment: { include: { client: true, activity: true } }, payments: true },
    });

    res.status(201).json({ payment, cuota: shapeCuota(cuota) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar pago' });
  }
});

// POST /api/enrollments/renew-month - renovar cuotas del mes siguiente
// NOTA paso #1: porteo fiel del comportamiento actual (reusa la misma cuota, no crea una nueva
// ni limpia los pagos). Se reescribe correctamente en el paso #3.
router.post('/renew-month', async (req, res) => {
  try {
    const bId = req.user.businessId;
    const now = new Date();

    // Auto-marcar vencidas primero
    await prisma.cuota.updateMany({
      where: { enrollment: { activity: { businessId: bId } }, paymentStatus: 'pending', dueDate: { lt: now } },
      data: { paymentStatus: 'overdue' },
    });

    // Inscripciones activas cuya última cuota está pagada
    const enrollments = await prisma.enrollment.findMany({
      where: { activity: { businessId: bId }, active: true },
      include: { client: true, activity: true, cuotas: { orderBy: { period: 'desc' }, take: 1 } },
    });
    const toRenew = enrollments.filter((e) => e.cuotas[0]?.paymentStatus === 'paid');

    if (toRenew.length === 0) return res.json({ renewed: 0, message: 'No hay inscripciones pagadas para renovar' });

    const nextDue = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    for (const e of toRenew) {
      await prisma.cuota.update({
        where: { id: e.cuotas[0].id },
        data: { paymentStatus: 'pending', dueDate: nextDue },
      });
    }

    res.json({ renewed: toRenew.length, newDueDate: nextDue, message: `${toRenew.length} cuotas renovadas para ${nextDue.toLocaleDateString('es-AR')}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al renovar cuotas' });
  }
});

// DELETE /api/enrollments/:id - dar de baja la inscripción (cuotas y pagos caen en cascada)
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
