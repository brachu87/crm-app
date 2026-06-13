const { execSync } = require('child_process');
const path = require('path');

const backendDir = path.join(__dirname, 'backend');

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
