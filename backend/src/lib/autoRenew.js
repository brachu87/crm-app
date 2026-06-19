const prisma = require('../prisma');
const { periodKey, addMonthToPeriod } = require('./period');

/**
 * Genera automáticamente cuotas pendientes para todas las inscripciones activas
 * cuya última cuota ya venció. Si debe varios meses, genera todas hasta el mes actual.
 *
 * Se llama al cargar Cobranza y Dashboard. Es idempotente (no duplica cuotas).
 *
 * @param {{ businessId: string }} scope
 * @returns {number} cantidad de cuotas nuevas creadas
 */
async function autoRenewCuotas({ businessId }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentPeriod = periodKey(today);

  // Todas las inscripciones activas del negocio con sus cuotas ordenadas desc
  const enrollments = await prisma.enrollment.findMany({
    where: {
      active: true,
      activity: { businessId },
    },
    include: {
      cuotas: { orderBy: { period: 'desc' } },
    },
  });

  let created = 0;

  for (const e of enrollments) {
    if (e.cuotas.length === 0) continue;

    // Obtener la cuota más reciente
    let latest = e.cuotas[0];

    // Mientras la última cuota sea de un período anterior al actual y su dueDate ya pasó
    // → generar la del mes siguiente
    while (latest.period < currentPeriod) {
      // Verificar que el dueDate de la última cuota ya llegó o pasó
      const due = latest.dueDate ? new Date(latest.dueDate) : null;
      if (due && due > today) break; // todavía no venció, no generar

      const nextPeriod = addMonthToPeriod(latest.period);
      const baseDue = due || today;
      const nextDue = new Date(
        baseDue.getFullYear(),
        baseDue.getMonth() + 1,
        baseDue.getDate()
      );

      try {
        const newCuota = await prisma.cuota.create({
          data: {
            enrollmentId: e.id,
            period: nextPeriod,
            amountDue: e.amountDue,
            discount: e.discount || 0,
            paymentStatus: 'pending',
            dueDate: nextDue,
          },
        });
        created++;
        latest = newCuota;
      } catch (err) {
        if (err.code === 'P2002') {
          // Ya existe esa cuota (unique constraint period+enrollmentId) → buscarla y seguir
          const existing = await prisma.cuota.findFirst({
            where: { enrollmentId: e.id, period: nextPeriod },
            orderBy: { period: 'desc' },
          });
          if (!existing) break;
          latest = existing;
        } else {
          throw err;
        }
      }
    }
  }

  return created;
}

module.exports = { autoRenewCuotas };
