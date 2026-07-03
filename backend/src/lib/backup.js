// Backup automático de la base (snapshot lógico en JSON de todas las tablas).
// Defensa contra pérdida de datos por borrados accidentales o por el
// `prisma db push --accept-data-loss` que corre en cada deploy.
// Se guarda en el volumen persistente (/data/backups) con rotación.
//
// NOTA: esto es una red de seguridad LÓGICA (restaurable). Para protección ante
// pérdida del volumen, conviene además activar los backups gestionados de Railway.
const fs = require('fs');
const path = require('path');
const prisma = require('../prisma');
let Prisma = null;
try { ({ Prisma } = require('@prisma/client')); } catch (_) {}

const BACKUP_DIR = process.env.BACKUP_DIR || '/data/backups';
const KEEP = Number(process.env.BACKUP_KEEP || 14);
const PREFIX = 'gestumio-backup-';

function modelNames() {
  try {
    return (Prisma && Prisma.dmmf && Prisma.dmmf.datamodel.models || []).map((m) => m.name);
  } catch (_) { return []; }
}

async function runBackup(reason = 'scheduled') {
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const names = modelNames();
    if (!names.length) { console.warn('[backup] No se pudo leer el modelo de datos; se omite.'); return null; }

    const data = {};
    let totalRows = 0;
    for (const name of names) {
      const key = name.charAt(0).toLowerCase() + name.slice(1);
      const delegate = prisma[key];
      if (delegate && typeof delegate.findMany === 'function') {
        try {
          const rows = await delegate.findMany();
          data[name] = rows;
          totalRows += rows.length;
        } catch (e) {
          console.warn(`[backup] No se pudo exportar ${name}:`, e.message);
        }
      }
    }

    const stamp = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '').slice(0, 16);
    const file = path.join(BACKUP_DIR, `${PREFIX}${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify({ createdAt: new Date().toISOString(), reason, tables: Object.keys(data).length, rows: totalRows, data }));
    rotate();
    console.log(`[backup] ✓ Backup creado (${reason}): ${file} — ${Object.keys(data).length} tablas, ${totalRows} filas.`);
    return file;
  } catch (e) {
    console.error('[backup] Falló el backup (se continúa):', e.message);
    return null;
  }
}

function rotate() {
  try {
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith(PREFIX)).sort();
    while (files.length > KEEP) {
      const f = files.shift();
      try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch (_) {}
    }
  } catch (_) {}
}

function backupExistsToday() {
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return fs.readdirSync(BACKUP_DIR).some((f) => f.startsWith(PREFIX) && f.includes(today));
  } catch (_) { return false; }
}

module.exports = { runBackup, backupExistsToday, BACKUP_DIR };
