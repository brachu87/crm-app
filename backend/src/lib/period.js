// Helpers de período mensual para las cuotas (formato "YYYY-MM").

function periodKey(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

module.exports = { periodKey };
