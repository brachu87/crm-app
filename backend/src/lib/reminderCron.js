/**
 * Cron diario de recordatorios automáticos por WhatsApp (via Baileys).
 * Corre a las 09:00 hora Argentina (UTC-3 → 12:00 UTC).
 * Detecta cuotas próximas a vencer (1, 3, 7 días) y cuotas vencidas,
 * y envía mensajes usando la plantilla configurada en Ajustes.
 */

const cron   = require('node-cron');
const prisma  = require('../prisma');
const { getState, sendMessage } = require('./whatsappBaileys');

const REMIND_DAYS = [1, 3, 7];

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function applyTemplate(template, vars) {
  return template
    .replace(/\{nombre\}/gi,      vars.nombre      || '')
    .replace(/\{actividad\}/gi,   vars.actividad   || '')
    .replace(/\{vencimiento\}/gi, vars.vencimiento || '')
    .replace(/\{monto\}/gi,       vars.monto       || '')
    .replace(/\{negocio\}/gi,     vars.negocio     || '');
}

async function getTemplate(businessId) {
  try {
    const biz = await prisma.$queryRawUnsafe(
      `SELECT "waTemplateExpiring", "waTemplateOverdue", name FROM "Business" WHERE id = ? LIMIT 1`,
      businessId
    );
    return biz?.[0] || null;
  } catch {
    return null;
  }
}

async function runReminders() {
  console.log('[wa-cron] Iniciando barrido de recordatorios WhatsApp...');

  const { state } = getState();
  if (state !== 'connected') {
    console.log('[wa-cron] WhatsApp no conectado (estado: ' + state + ') — saltando.');
    return;
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let sent = 0, errors = 0;

  try {
    // ── Cuotas próximas a vencer ─────────────────────────────────────────────
    for (const days of REMIND_DAYS) {
      const target = new Date(now);
      target.setDate(target.getDate() + days);
      const targetStr = target.toISOString().slice(0, 10);

      const cuotas = await prisma.$queryRawUnsafe(`
        SELECT
          c.id as cuotaId, c."dueDate", c.amount,
          cl.name as clientName, cl.phone as clientPhone,
          a.name as activityName,
          e."businessId",
          b.name as businessName
        FROM "Cuota" c
        JOIN "Enrollment" e ON c."enrollmentId" = e.id
        JOIN "Client" cl ON e."clientId" = cl.id
        JOIN "Activity" a ON e."activityId" = a.id
        JOIN "Business" b ON b.id = e."businessId"
        WHERE c."paymentStatus" = 'pending'
          AND date(c."dueDate") = date(?)
          AND cl.phone IS NOT NULL AND cl.phone != ''
      `, targetStr);

      for (const q of cuotas) {
        const biz = await getTemplate(q.businessId);
        if (!biz) continue;

        const templateText = biz.waTemplateExpiring ||
          'Hola {nombre}, te recordamos que tu cuota de {actividad} vence el {vencimiento}. ¡Muchas gracias! {negocio}';

        const msg = applyTemplate(templateText, {
          nombre:      q.clientName,
          actividad:   q.activityName,
          vencimiento: fmtDate(q.dueDate),
          monto:       q.amount ? `$${Number(q.amount).toLocaleString('es-AR')}` : '',
          negocio:     biz.name || q.businessName,
        });

        try {
          await sendMessage(q.clientPhone, msg);
          sent++;
          console.log(`[wa-cron] ✓ Recordatorio → ${q.clientName} (vence en ${days}d)`);
          await new Promise(r => setTimeout(r, 800));
        } catch (e) {
          errors++;
          console.error(`[wa-cron] ✗ Error → ${q.clientName}:`, e.message);
        }
      }
    }

    // ── Cuotas ya vencidas ayer ──────────────────────────────────────────────
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    const overdue = await prisma.$queryRawUnsafe(`
      SELECT
        c.id as cuotaId, c."dueDate", c.amount,
        cl.name as clientName, cl.phone as clientPhone,
        a.name as activityName,
        e."businessId",
        b.name as businessName
      FROM "Cuota" c
      JOIN "Enrollment" e ON c."enrollmentId" = e.id
      JOIN "Client" cl ON e."clientId" = cl.id
      JOIN "Activity" a ON e."activityId" = a.id
      JOIN "Business" b ON b.id = e."businessId"
      WHERE c."paymentStatus" = 'overdue'
        AND date(c."dueDate") = date(?)
        AND cl.phone IS NOT NULL AND cl.phone != ''
    `, yesterday.toISOString().slice(0, 10));

    for (const q of overdue) {
      const biz = await getTemplate(q.businessId);
      if (!biz) continue;

      const templateText = biz.waTemplateOverdue ||
        'Hola {nombre}, tu cuota de {actividad} venció el {vencimiento}. Por favor regularizá tu situación. {negocio}';

      const msg = applyTemplate(templateText, {
        nombre:      q.clientName,
        actividad:   q.activityName,
        vencimiento: fmtDate(q.dueDate),
        monto:       q.amount ? `$${Number(q.amount).toLocaleString('es-AR')}` : '',
        negocio:     biz.name || q.businessName,
      });

      try {
        await sendMessage(q.clientPhone, msg);
        sent++;
        console.log(`[wa-cron] ✓ Vencido → ${q.clientName}`);
        await new Promise(r => setTimeout(r, 800));
      } catch (e) {
        errors++;
        console.error(`[wa-cron] ✗ Error → ${q.clientName}:`, e.message);
      }
    }

    console.log(`[wa-cron] Barrido completado — enviados: ${sent}, errores: ${errors}`);
  } catch (err) {
    console.error('[wa-cron] Error general:', err.message);
  }
}

function startReminderCron() {
  cron.schedule('0 12 * * *', runReminders, { timezone: 'UTC' });
  console.log('[wa-cron] Cron programado — 09:00 AR / 12:00 UTC');
}

module.exports = { startReminderCron, runReminders };
