// Caché en memoria con TTL (por proceso; Railway corre un solo nodo).
// Sirve para respuestas costosas que se piden seguido (dashboard, reportes).
const store = new Map();

function get(key) {
  const e = store.get(key);
  if (!e) return null;
  if (e.exp < Date.now()) { store.delete(key); return null; }
  return e.val;
}
function set(key, val, ttlMs) {
  store.set(key, { val, exp: Date.now() + ttlMs });
  // limpieza oportunista para que el Map no crezca indefinidamente
  if (store.size > 500) {
    const now = Date.now();
    for (const [k, v] of store) if (v.exp < now) store.delete(k);
  }
}
function del(key) { store.delete(key); }
// Borra todas las claves que empiezan con un prefijo (ej: invalidar un negocio)
function clearPrefix(prefix) {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}

module.exports = { get, set, del, clearPrefix };
