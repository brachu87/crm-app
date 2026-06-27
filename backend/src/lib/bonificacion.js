const { periodKey } = require('./period');

/**
 * ¿La beca (bonificación total) cubre el período dado? period: "YYYY-MM".
 * - bonificada sin fecha límite -> cubre siempre.
 * - bonificada con bonificadaHasta -> cubre hasta (incluido) el mes de esa fecha.
 */
function becaCubrePeriodo(enrollment, period) {
  if (!enrollment || !enrollment.bonificada) return false;
  if (!enrollment.bonificadaHasta) return true;
  return period <= periodKey(new Date(enrollment.bonificadaHasta));
}

/**
 * Descuento efectivo de una cuota:
 * - Si la beca cubre el período -> descuenta TODO el monto (la cuota queda en $0).
 * - Si la beca venció (o no hay beca) -> el descuento base de la inscripción.
 * Importante: NO se pisa amountDue, así se conserva el precio para cuando la beca termina.
 */
function discountForCuota(enrollment, period) {
  if (becaCubrePeriodo(enrollment, period)) return enrollment.amountDue || 0;
  return enrollment.discount || 0;
}

module.exports = { becaCubrePeriodo, discountForCuota };
