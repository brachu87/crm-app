/**
 * Cron diario de recordatorios por WhatsApp — vía Meta Cloud API.
 * Corre 09:00 AR (12:00 UTC). Detecta cuotas por vencer (1/3/7 días),
 * cuotas vencidas y turnos de mañana, y envía PLANTILLAS aprobadas por Meta.
 *
 * Los mensajes iniciados por el negocio requieren plantillas aprobadas.
 * Nombres de plantilla (configurables por env):
 *   META_TPL_EXPIRING     (default: cuota_por_vencer)   params: nombre, actividad, vencimiento, negocio
 *   META_TPL_OVERDUE      (default: cuota_vencida)       params: nombre, actividad, vencimiento, negocio
 *   META_TPL_APPOINTMENT  (default: turno_recordatorio)  params: nombre, servicio, fecha, hora, negocio
 *   META_TPL_LANG         (default: es_AR)
 */

const cron   = require('node-cron');
const prisma = require('../prisma');
const meta   = require('./whatsappMeta');

const REMIND_DAYS = [1, 3, 7];
const TPL = {
  expiring:    process.env.META_TPL_EXPIRING    || 'cuota_por_vencer',
  overdue:     process.env.META_TPL_OVERDUE     || 'cuota_vencida',
  appointment: process.env.META_TPL_APPOINTMENT || 'turno_recordatorio',
};
const TPL_LANG = process.env.META_TPL_LANG || 'es_AR';

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Rango [00:00, +1 día) de una fecha (para comparar solo el día en un DateTime)
function dayRange(date) {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return { gte: start, lt: end };
}

async function runReminders(onlyBusinessId = null) {
  console.log('[wa-cron] Barrido de recordatorios (Meta)' + (onlyBusinessId ? ` — negocio ${onlyBusinessId}` : ' — todos'));
  if (!meta.isConfigured()) {
    console.log('[wa-cron] META_WA_TOKEN no configurado — barrido omitido');
    return { sent: 0, errors: 0 };
  }

  const now = new Date(); now.setHours(0, 0, 0, 0);
  let sent = 0, errors = 0;

  // Envía una plantilla, respetando filtros de negocio y config
  async function send(business, phone, templateName, params, label) {
    if (!business) return;
    if (onlyBusinessId && business.id !== onlyBusinessId) return;
    if (!business.waPhoneId) return;                 // negocio sin número asignado
    if (!phone) return;
    try {
      await meta.sendTemplate(business.waPhoneId, phone, templateName, TPL_LANG, meta.bodyParams(params), business.waToken);
      sent++;
      console.log(`[wa-cron] ✓ ${label}`);
      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      errors++;
      console.error(`[wa-cron] ✗ ${label}:`, e.message);
    }
  }

  try {
    // ── Cuotas próximas a vencer ─────────────────────────────────────────────
    for (const days of REMIND_DAYS) {
      const target = new Date(now); target.setDate(target.getDate() + days);
      const cuotas = await prisma.cuota.findMany({
        where: { paymentStatus: 'pending', dueDate: dayRange(target) },
        include: { enrollment: { include: { client: true, activity: { include: { business: true } } } } },
      });
      for (const c of cuotas) {
        const cl = c.enrollment?.client;
        const act = c.enrollment?.activity;
        const biz = act?.business;
        if (!cl?.phone) continue;
        await send(biz, cl.phone, TPL.expiring,
          [cl.name, act?.name || '', fmtDate(c.dueDate), biz?.name || ''],
          `Por vencer → ${cl.name} (${days}d)`);
      }
    }

    // ── Cuotas vencidas ayer ─────────────────────────────────────────────────
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    const overdue = await prisma.cuota.findMany({
      where: { paymentStatus: 'overdue', dueDate: dayRange(yesterday) },
      include: { enrollment: { include: { client: true, activity: { include: { business: true } } } } },
    });
    for (const c of overdue) {
      const cl = c.enrollment?.client;
      const act = c.enrollment?.activity;
      const biz = act?.business;
      if (!cl?.phone) continue;
      await send(biz, cl.phone, TPL.overdue,
        [cl.name, act?.name || '', fmtDate(c.dueDate), biz?.name || ''],
        `Vencida → ${cl.name}`);
    }

    // ── Turnos de mañana ─────────────────────────────────────────────────────
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const appts = await prisma.appointment.findMany({
      where: { date: tomorrowStr, status: 'scheduled' },
      include: { client: true, service: true, business: true },
    });
    for (const appt of appts) {
      const cl = appt.client;
      if (!cl?.phone) continue;
      const hora = appt.startTime
        ? appt.startTime + (appt.endTime ? ` - ${appt.endTime}` : '')
        : 'horario a confirmar';
      await send(appt.business, cl.phone, TPL.appointment,
        [cl.name, appt.service?.name || 'turno', tomorrowStr.split('-').reverse().join('/'), hora, appt.business?.name || ''],
        `Turno → ${cl.name} (${tomorrowStr})`);
    }

    console.log(`[wa-cron] Completado — enviados: ${sent}, errores: ${errors}`);
  } catch (err) {
    console.error('[wa-cron] Error general:', err.message);
  }
  return { sent, errors };
}

function startReminderCron() {
  cron.schedule('0 12 * * *', () => runReminders(), { timezone: 'UTC' });
  console.log('[wa-cron] Cron programado — 09:00 AR / 12:00 UTC');
}

module.exports = { startReminderCron, runReminders };
