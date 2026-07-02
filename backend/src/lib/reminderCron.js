/**
 * Cron diario de recordatorios por WhatsApp — vía Evolution API.
 * 09:00 AR (12:00 UTC). Cuotas por vencer (1/3/7 días), vencidas y turnos de mañana.
 * Usa texto libre con las plantillas configuradas por el negocio (sin aprobación de Meta).
 */

const cron = require('node-cron');
const prisma = require('../prisma');
const evo = require('./whatsappEvolution');

const REMIND_DAYS = [1, 3, 7];

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function applyTemplate(t, v) {
  return String(t || '')
    .replace(/\{nombre\}/gi,      v.nombre      || '')
    .replace(/\{actividad\}/gi,   v.actividad   || '')
    .replace(/\{vencimiento\}/gi, v.vencimiento || '')
    .replace(/\{monto\}/gi,       v.monto       || '')
    .replace(/\{servicio\}/gi,    v.servicio    || '')
    .replace(/\{hora\}/gi,        v.hora        || '')
    .replace(/\{fecha\}/gi,       v.fecha       || '')
    .replace(/\{negocio\}/gi,     v.negocio     || '');
}

const DEFAULTS = {
  expiring:    'Hola {nombre}, te recordamos que tu cuota de {actividad} vence el {vencimiento}. ¡Muchas gracias! {negocio}',
  overdue:     'Hola {nombre}, tu cuota de {actividad} venció el {vencimiento}. Por favor regularizá tu situación. {negocio}',
  appointment: 'Hola {nombre}, te recordamos que tenés un turno de {servicio} mañana a las {hora}. ¡Te esperamos! {negocio}',
};

function dayRange(date) {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return { gte: start, lt: end };
}

async function runReminders(onlyBusinessId = null) {
  console.log('[wa-cron] Barrido de recordatorios (Evolution)' + (onlyBusinessId ? ` — negocio ${onlyBusinessId}` : ' — todos'));
  if (!evo.isConfigured()) { console.log('[wa-cron] Evolution no configurada — omitido'); return { sent: 0, errors: 0 }; }

  const now = new Date(); now.setHours(0, 0, 0, 0);
  let sent = 0, errors = 0;
  const stateCache = new Map();

  async function connected(bid) {
    if (onlyBusinessId && bid !== onlyBusinessId) return false;
    if (!stateCache.has(bid)) {
      try { stateCache.set(bid, (await evo.getState(bid)).state === 'connected'); }
      catch { stateCache.set(bid, false); }
    }
    return stateCache.get(bid);
  }

  async function send(business, phone, tplText, vars, label) {
    if (!business || !phone) return;
    if (!(await connected(business.id))) return;
    try {
      await evo.sendText(business.id, phone, applyTemplate(tplText, vars));
      sent++;
      console.log(`[wa-cron] ✓ ${label}`);
      await new Promise(r => setTimeout(r, 900));
    } catch (e) { errors++; console.error(`[wa-cron] ✗ ${label}:`, e.message); }
  }

  try {
    // Cuotas por vencer
    for (const days of REMIND_DAYS) {
      const target = new Date(now); target.setDate(target.getDate() + days);
      const cuotas = await prisma.cuota.findMany({
        where: { paymentStatus: 'pending', dueDate: dayRange(target) },
        include: { enrollment: { include: { client: true, activity: { include: { business: true } } } } },
      });
      for (const c of cuotas) {
        const cl = c.enrollment?.client, act = c.enrollment?.activity, biz = act?.business;
        if (!cl?.phone || !biz) continue;
        await send(biz, cl.phone, biz.waTemplateExpiring || DEFAULTS.expiring, {
          nombre: cl.name, actividad: act?.name || '', vencimiento: fmtDate(c.dueDate),
          monto: c.amountDue != null ? `$${Number(c.amountDue).toLocaleString('es-AR')}` : '', negocio: biz.name || '',
        }, `Por vencer → ${cl.name} (${days}d)`);
      }
    }

    // Cuotas vencidas ayer
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    const overdue = await prisma.cuota.findMany({
      where: { paymentStatus: 'overdue', dueDate: dayRange(yesterday) },
      include: { enrollment: { include: { client: true, activity: { include: { business: true } } } } },
    });
    for (const c of overdue) {
      const cl = c.enrollment?.client, act = c.enrollment?.activity, biz = act?.business;
      if (!cl?.phone || !biz) continue;
      await send(biz, cl.phone, biz.waTemplateOverdue || DEFAULTS.overdue, {
        nombre: cl.name, actividad: act?.name || '', vencimiento: fmtDate(c.dueDate),
        monto: c.amountDue != null ? `$${Number(c.amountDue).toLocaleString('es-AR')}` : '', negocio: biz.name || '',
      }, `Vencida → ${cl.name}`);
    }

    // Turnos de mañana
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    const appts = await prisma.appointment.findMany({
      where: { date: tomorrowStr, status: 'scheduled' },
      include: { client: true, service: true, business: true },
    });
    for (const appt of appts) {
      const cl = appt.client, biz = appt.business;
      if (!cl?.phone || !biz) continue;
      const hora = appt.startTime ? appt.startTime + (appt.endTime ? ` - ${appt.endTime}` : '') : 'horario a confirmar';
      await send(biz, cl.phone, biz.waTemplateAppointment || DEFAULTS.appointment, {
        nombre: cl.name, servicio: appt.service?.name || 'turno',
        fecha: tomorrowStr.split('-').reverse().join('/'), hora, negocio: biz.name || '',
      }, `Turno → ${cl.name} (${tomorrowStr})`);
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
