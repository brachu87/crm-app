const { execSync } = require('child_process');
const path = require('path');

const backendDir = path.join(__dirname, 'backend');

// Estas migraciones quedan reflejadas en la base por las funciones ensure*() del arranque
// (agregan las columnas permissions, lastAccessAt, bonificado de forma idempotente).
// Las marcamos como YA APLICADAS para que `prisma migrate deploy` no intente re-ejecutar
// SQL que rompe en SQLite (ALTER COLUMN) ni columnas que ya existen ("duplicate column").
const baseline = [
  '20260619500000_google_auth',
  '20260620200000_add_user_permissions',
  '20260621010000_add_last_access_bonificado',
];

console.log('Normalizando estado de migraciones...');
for (const m of baseline) {
  try {
    execSync(`npx prisma migrate resolve --applied ${m}`, { cwd: backendDir, stdio: 'pipe' });
  } catch (_) {
    // Ya estaba aplicada o no está pendiente: se ignora.
  }
}

console.log('Ejecutando migraciones...');
try {
  execSync('npx prisma migrate deploy', { cwd: backendDir, stdio: 'inherit' });
} catch (e) {
  console.error('Error en migraciones:', e.message);
}

console.log('Iniciando servidor...');
require('./backend/src/index.js');
