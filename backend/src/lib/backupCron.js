// Backup diario de clientes por email. Cada negocio elige si lo activa, a qué hora
// y a qué mail. Corre cada hora en punto (igual que los recordatorios).
const cron = require('node-cron');
const prisma = require('../prisma');
const { sendBackupEmail } = require('./mailer');
const { buildBusinessSql } = require('./exportBusiness');

function hoyAR() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

// Ejecuta el backup de un negocio. force=true ignora el "ya enviado hoy" (para el botón Enviar ahora).
async function runBackupForBusiness(businessId, { force = false } = {}) {
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, dailyBackupEnabled: true, dailyBackupEmail: true, dailyBackupLastSent: true },
  });
  if (!biz) throw new Error('Negocio no encontrado');
  if (!force && !biz.dailyBackupEnabled) return { skipped: 'deshabilitado' };
  const hoy = hoyAR();
  if (!force && biz.dailyBackupLastSent === hoy) return { skipped: 'ya enviado hoy' };

  // Destinatario: el mail configurado, o el del propietario
  let to = (biz.dailyBackupEmail || '').trim();
  if (!to) {
    const owner = await prisma.user.findFirst({ where: { businessId, role: 'owner' }, select: { email: true } })
      || await prisma.user.findFirst({ where: { businessId }, select: { email: true } });
    to = owner?.email || '';
  }
  if (!to) throw new Error('No hay email de destino configurado');

  const { sql, resumen } = await buildBusinessSql(businessId);
  const contentBase64 = Buffer.from(sql, 'utf8').toString('base64');
  const slug = biz.name ? biz.name.replace(/[^\w.-]+/g, '_') : 'gestumio';
  const filename = `backup-${slug}-${hoy}.sql`;

  await sendBackupEmail({ toEmail: to, businessName: biz.name, contentBase64, filename, fecha: hoy, resumen });
  await prisma.business.update({ where: { id: businessId }, data: { dailyBackupLastSent: hoy } });
  return { ok: true, to, tablas: resumen.length };
}

async function runScheduledBackups() {
  const arHour = (new Date().getUTCHours() + 21) % 24; // UTC-3
  let businesses = [];
  try {
    businesses = await prisma.business.findMany({
      where: { dailyBackupEnabled: true, dailyBackupHour: arHour },
      select: { id: true },
    });
  } catch (e) { console.error('[backup-cron] no se pudo listar negocios:', e.message); return; }
  if (!businesses.length) return;
  console.log(`[backup-cron] ${arHour}:00 AR — ${businesses.length} negocio(s) con backup diario`);
  for (const b of businesses) {
    try {
      const r = await runBackupForBusiness(b.id);
      if (r.ok) console.log(`[backup-cron] enviado a ${r.to} (${r.count} clientes)`);
    } catch (e) { console.error('[backup-cron] negocio ' + b.id, e.message); }
  }
}

function startBackupCron() {
  cron.schedule('0 * * * *', () => runScheduledBackups(), { timezone: 'UTC' });
  console.log('[backup-cron] Cron horario de backups programado');
}

module.exports = { startBackupCron, runBackupForBusiness };
