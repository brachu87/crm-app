/**
 * Throttle para autoRenewCuotas y markOverdueCuotas.
 * Evita ejecutarlos en cada request — máximo 1 vez por negocio cada 5 minutos.
 * Vive en memoria del proceso (se resetea al reiniciar, lo cual está bien).
 */
const TTL_MS = 5 * 60 * 1000; // 5 minutos
const lastRun = new Map(); // businessId -> timestamp

function shouldRun(businessId) {
  const last = lastRun.get(businessId) || 0;
  return Date.now() - last > TTL_MS;
}

function markRan(businessId) {
  lastRun.set(businessId, Date.now());
}

module.exports = { shouldRun, markRan };
