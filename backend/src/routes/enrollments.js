const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { periodKey, addMonthToPeriod } = require('../lib/period');
const { markOverdueCuotas } = require('../lib/overdue');
const { autoRenewCuotas } = require('../lib/autoRenew');

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
    const bId = req.user.businessId;
    const baseWhere = { enrollment: { client: { businessId: bId, active: true }, active: true } };

    // Auto-generar cuotas vencidas antes de devolver datos
    await markOverdueCuotas({ businessId: bId });
    await autoRenewCuotas({ businessId: bId });

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
      // El saldo se compara contra el monto NETO (monto - descuento), que es lo que se cobra.
      const withBalance = all.filter((c) => {
        const totalPaid = c.payments.reduce((s, p) => s + p.amount, 0);
        const net = Math.max(0, c.amountDue - (c.discount || 0));
        return totalPaid < net;
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

    // Se compara contra el monto NETO (monto - descuento), que es lo que realmente se cobra.
    const net = Math.max(0, existing.amountDue - (existing.discount || 0));
    // Un pago parcial no debe "limpiar" una cuota vencida: si todavía debe y estaba
    // vencida (o su vencimiento ya pasó), se mantiene en 'overdue'.
    const isOverdue = existing.paymentStatus === 'overdue' || (existing.dueDate && new Date(existing.dueDate) < new Date());
    const newStatus = totalPaid >= net ? 'paid' : (isOverdue ? 'overdue' : 'pending');

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

// POST /api/enrollments/renew-month - genera la cuota del mes siguiente
// Crea una cuota NUEVA por cada inscripción cuya última cuota esté pagada,
// dejando la cuota pagada intacta como histórico (no reusa la fila ni los pagos).
router.post('/renew-month', async (req, res) => {
  try {
    const bId = req.user.businessId;
    const now = new Date();

    // Marcar vencidas primero (helper compartido)
    await markOverdueCuotas({ businessId: bId });

    // Inscripciones activas cuya última cuota está pagada
    const enrollments = await prisma.enrollment.findMany({
      where: { activity: { businessId: bId }, active: true },
      include: { cuotas: { orderBy: { period: 'desc' }, take: 1 } },
    });
    const toRenew = enrollments.filter((e) => e.cuotas[0]?.paymentStatus === 'paid');

    if (toRenew.length === 0) return res.json({ renewed: 0, message: 'No hay inscripciones pagadas para renovar' });

    let renewed = 0;
    let lastDue = null;
    for (const e of toRenew) {
      const last = e.cuotas[0];
      const nextPeriod = addMonthToPeriod(last.period);
      // Vencimiento del mes siguiente: a partir del vencimiento anterior (o de hoy si no tenía)
      const baseDue = last.dueDate ? new Date(last.dueDate) : now;
      const nextDue = new Date(baseDue.getFullYear(), baseDue.getMonth() + 1, baseDue.getDate());
      try {
        await prisma.cuota.create({
          data: {
            enrollmentId: e.id,
            period: nextPeriod,
            amountDue: e.amountDue, // monto/descuento base mensual de la membresía
            discount: e.discount,
            paymentStatus: 'pending',
            dueDate: nextDue,
          },
        });
        renewed++;
        lastDue = nextDue;
      } catch (err) {
        if (err.code === 'P2002') continue; // ya existe la cuota de ese período: no duplicar
        throw err;
      }
    }

    res.json({ renewed, newDueDate: lastDue, message: `${renewed} cuotas generadas para el mes siguiente` });
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
