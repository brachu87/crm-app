const prisma = require('../prisma');

// Marca como 'overdue' las cuotas pendientes cuyo vencimiento ya pasó.
// scope opcional: { businessId } para limitar a un negocio (si no, barre todos).
async function markOverdueCuotas(scope = {}) {
  const where = { paymentStatus: 'pending', dueDate: { lt: new Date() } };
  if (scope.businessId) {
    where.enrollment = { activity: { businessId: scope.businessId } };
  }
  const result = await prisma.cuota.updateMany({ where, data: { paymentStatus: 'overdue' } });
  return result.count;
}

module.exports = { markOverdueCuotas };
