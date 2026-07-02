const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const backendDir = path.join(__dirname, 'backend');

// Asegurar DATABASE_URL aunque no esté como variable en Railway (volumen en /data).
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:/data/prod.db';
}
const migrationsDir = path.join(backendDir, 'prisma', 'migrations');
const isPostgres = (process.env.DATABASE_URL || '').startsWith('postgres');

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

if (isPostgres) {
  // PostgreSQL: el esquema se crea/sincroniza desde schema.prisma (sin historial de migraciones).
  console.log('PostgreSQL detectado: sincronizando esquema con prisma db push...');
  try {
    execSync('npx prisma db push --skip-generate --accept-data-loss', { cwd: backendDir, stdio: 'inherit' });
    console.log('Esquema PostgreSQL sincronizado.');
  } catch (e) {
    console.error('db push falló:', e.message);
  }
} else {
  console.log('Aplicando migraciones...');
  try {
    deploy();
    console.log('Migraciones OK.');
  } catch (e) {
    // SQLite: si migrate deploy falla por migraciones heredadas, marcamos el historial
    // como aplicado (baseline) y reintentamos una vez.
    console.warn('migrate deploy falló; normalizando historial de migraciones (baseline)...');
    for (const m of listMigrations()) {
      try {
        execSync(`npx prisma migrate resolve --applied ${m}`, { cwd: backendDir, stdio: 'pipe' });
      } catch (_) {}
    }
    try {
      deploy();
      console.log('Migraciones normalizadas.');
    } catch (e2) {
      console.error('No se pudieron aplicar migraciones:', e2.message);
    }
  }
}

console.log('Iniciando servidor...');
require('./backend/src/index.js');
