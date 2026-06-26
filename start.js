const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const backendDir = path.join(__dirname, 'backend');

// Asegurar DATABASE_URL aunque no esté como variable en Railway (volumen en /data).
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:/data/prod.db';
}
const migrationsDir = path.join(backendDir, 'prisma', 'migrations');

function deploy() {
  execSync('npx prisma migrate deploy', { cwd: backendDir, stdio: 'inherit' });
}

function listMigrations() {
  try {
    return fs.readdirSync(migrationsDir)
      .filter((d) => fs.existsSync(path.join(migrationsDir, d, 'migration.sql')))
      .sort();
  } catch (_) {
    return [];
  }
}

console.log('Aplicando migraciones...');
try {
  deploy();
  console.log('Migraciones OK.');
} catch (e) {
  // La base de producción ya tiene el esquema completo: lo mantienen las funciones
  // ensure*() que corren en cada arranque (agregan columnas/tablas de forma idempotente).
  // Si `migrate deploy` falla por migraciones heredadas incompatibles con SQLite
  // (ALTER COLUMN de Postgres) o por columnas que ya existen ("duplicate column"),
  // marcamos TODO el historial como aplicado (baseline) y reintentamos una vez.
  console.warn('migrate deploy falló; normalizando historial de migraciones (baseline)...');
  for (const m of listMigrations()) {
    try {
      execSync(`npx prisma migrate resolve --applied ${m}`, { cwd: backendDir, stdio: 'pipe' });
    } catch (_) {
      // ya estaba aplicada
    }
  }
  try {
    deploy();
    console.log('Migraciones normalizadas.');
  } catch (e2) {
    console.error('No se pudieron aplicar migraciones (la app sigue con el esquema actual):', e2.message);
  }
}

console.log('Iniciando servidor...');
require('./backend/src/index.js');
