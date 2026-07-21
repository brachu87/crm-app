// Vinculación de cuentas de Gestumio con Telegram.
// - Códigos de un solo uso, en memoria, con TTL de 10 minutos.
// - Token de larga duración (JWT) para que el bot opere en nombre del usuario.
const jwt = require('jsonwebtoken');

const CODE_TTL_MS = 10 * 60 * 1000;
const _codes = new Map(); // code -> { businessId, userId, exp }

function _rand(n) {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I para evitar confusión
  let s = '';
  for (let i = 0; i < n; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

// Genera un código de vinculación para (negocio, usuario).
function generarCodigo(businessId, userId) {
  // limpiar vencidos
  const now = Date.now();
  for (const [k, v] of _codes) if (v.exp < now) _codes.delete(k);
  let code;
  do { code = _rand(6); } while (_codes.has(code));
  _codes.set(code, { businessId, userId, exp: now + CODE_TTL_MS });
  return { code, expiresInMin: CODE_TTL_MS / 60000 };
}

// Consume un código (un solo uso). Devuelve { businessId, userId } o null.
function consumirCodigo(code) {
  const key = String(code || '').trim().toUpperCase();
  const v = _codes.get(key);
  if (!v) return null;
  _codes.delete(key);
  if (v.exp < Date.now()) return null;
  return { businessId: v.businessId, userId: v.userId };
}

// Firma el token del bot (larga duración). Incluye tgId para poder revocar.
function firmarTokenBot({ userId, businessId, role, telegramUserId }) {
  return jwt.sign(
    { userId, businessId, role, tg: String(telegramUserId), via: 'telegram' },
    process.env.JWT_SECRET,
    { expiresIn: '180d' }
  );
}

module.exports = { generarCodigo, consumirCodigo, firmarTokenBot };
