/**
 * Cron diario de recordatorios automáticos por WhatsApp.
 * Corre a las 09:00 hora Argentina (UTC-3 → 12:00 UTC).
 * Para cada negocio con META_WA configurado, detecta cuotas
 * próximas a vencer (1, 3, 7 días) y cuotas ya vencidas,
 * y envía mensajes usando la plantilla configurada en Ajustes.
 */

const cron = require('node-cron');
const prisma = require('../prisma');
const { isConfigured, sendText, applyTemplate, normalizePhone } = require('./whatsappMeta');

const REMIND_DAYS = [1, 3, 7]; // días antes del vencimiento

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function getTemplate(businessId) {
  try {
    const biz = await prisma.$queryRawUnsafe(
      `SELECT "waTemplateExpiring", "waTemplateOverdue", name FROM "Business" WHERE id = ? LIMIT 1`,
      businessId
    );
    if (!biz?.length) return null;
    return biz[0];
  } catch {
    return null;
  }
}

async function runReminders() {
  console.log('[wa-cron] Iniciando barrido de recordatorios WhatsApp...');

  if (!isConfigured()) {
    console.log('[wa-cron] META_WA_TOKEN/META_WA_PHONE_ID no configurados — saltando.');
    return;
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let sent = 0, errors = 0;

  try {
    // Cuotas próximas a vencer en 1, 3 o 7 días
    for (const days of REMIND_DAYS) {
      const target = new Date(now);
      target.setDate(target.getDate() + days);
      const targetStr = target.toISOString().slice(0, 10);

      const cuotas = await prisma.$queryRawUnsafe(`
        SELECT
          c.id as cuotaId,
          c."dueDate", c.amount,
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
          await sendText(q.clientPhone, msg);
          sent++;
          console.log(`[wa-cron] ✓ Recordatorio enviado a ${q.clientName} (vence en ${days}d)`);
          // Pausa breve para no saturar la API
          await new Promise(r => setTimeout(r, 500));
        } catch (e) {
          errors++;
          console.error(`[wa-cron] ✗ Error enviando a ${q.clientName}:`, e.message);
        }
      }
    }

    // Cuotas ya vencidas (vencieron hoy o ayer, para no re-notificar infinitamente)
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
        'Hola {nombre}, tu cuota de {actividad} venció el {vencimiento}. Por favor acercate a regularizar tu situación. {negocio}';

      const msg = applyTemplate(templateText, {
        nombre:      q.clientName,
        actividad:   q.activityName,
        vencimiento: fmtDate(q.dueDate),
        monto:       q.amount ? `$${Number(q.amount).toLocaleString('es-AR')}` : '',
        negocio:     biz.name || q.businessName,
      });

      try {
        await sendText(q.clientPhone, msg);
        sent++;
        console.log(`[wa-cron] ✓ Aviso de vencido enviado a ${q.clientName}`);
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        errors++;
        console.error(`[wa-cron] ✗ Error enviando a ${q.clientName}:`, e.message);
      }
    }

    console.log(`[wa-cron] Barrido completado — enviados: ${sent}, errores: ${errors}`);
  } catch (err) {
    console.error('[wa-cron] Error general:', err.message);
  }
}

function startReminderCron() {
  // Todos los días a las 09:00 hora Argentina (UTC-3 = 12:00 UTC)
  cron.schedule('0 12 * * *', runReminders, { timezone: 'UTC' });
  console.log('[wa-cron] Cron de recordatorios WhatsApp programado (09:00 AR / 12:00 UTC)');
}

module.exports = { startReminderCron, runReminders };
