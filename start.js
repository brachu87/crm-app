const { execSync } = require('child_process');
const path = require('path');

const backendDir = path.join(__dirname, 'backend');

// Resolver migraciones fallidas antes de hacer deploy
// (evita el error P3009 por migraciones interrumpidas)
console.log('Resolviendo migraciones fallidas (si las hay)...');
try {
  execSync('npx prisma migrate resolve --rolled-back 20260619500000_google_auth', {
    cwd: backendDir,
    stdio: 'inherit',
  });
} catch (_) {
  // Ignorar si ya estaba resuelta o no existe
}

console.log('Ejecutando migraciones...');
try {
  execSync('npx prisma migrate deploy', {
    cwd: backendDir,
    stdio: 'inherit',
  });
} catch (e) {
  console.error('Error en migraciones:', e.message);
}

console.log('Iniciando servidor...');
require('./backend/src/index.js');
