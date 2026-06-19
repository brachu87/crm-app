// Helpers de período mensual para las cuotas (formato "YYYY-MM").

function periodKey(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Suma un mes a un período "YYYY-MM" y devuelve el período resultante.
function addMonthToPeriod(period) {
  const [y, m] = period.split('-').map(Number);
  return periodKey(new Date(y, m, 1)); // m (1-based) como índice 0-based = mes siguiente
}

module.exports = { periodKey, addMonthToPeriod };
