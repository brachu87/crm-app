const express  = require('express');
const router   = express.Router();
const authMiddleware = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const evo = require('../lib/whatsappEvolution');
const { generateReceiptPdf, generatePayrollPdf } = require('../lib/receiptPdf');
const PHOTOS_DIR = process.env.PHOTOS_DIR
  || (fs.existsSync('/data') ? '/data/photos' : path.join(__dirname, '../../../data/photos'));
const prisma = require('../prisma');
const { runReminders } = require('../lib/reminderCron');

// ── Webhook de Evolution (mensajes entrantes) — PÚBLICO, sin auth ──────────
// Confirma/rechaza turnos pendientes cuando el negocio responde "SI <code>" / "NO <code>".
const gcal = require('../lib/googleCalendar');

function stripAccents(x) { return String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

function extractText(msg) {
  if (!msg) return '';
  return msg.conversation
    || msg.extendedTextMessage?.text
    || msg.ephemeralMessage?.message?.extendedTextMessage?.text
    || msg.ephemeralMessage?.message?.conversation
    || '';
}

router.post('/webhook', async (req, res) => {
  // Siempre responder 200 para que Evolution no reintente.
  try {
    const body = req.body || {};
    const instance = body.instance || body.instanceName || body.sender || '';
    const businessId = String(instance).replace(/^gestumio_/, '');
    if (!businessId) return res.json({ ok: true });

    // data puede ser objeto o array
    const items = Array.isArray(body.data) ? body.data : [body.data].filter(Boolean);
    for (const it of items) {
      const text = extractText(it?.message);
      if (!text) continue;
      const norm = stripAccents(text).trim().toUpperCase();
      const m = norm.match(/^(SI|NO)\b\s*#?\s*(\d{3,6})?/);
      if (!m) continue;
      const decision = m[1];
      const code = m[2] || null;

      const where = { businessId, status: 'pending', isQuickWork: false };
      if (code) where.confirmCode = code;
      const appt = await prisma.appointment.findFirst({
        where,
        orderBy: { createdAt: 'desc' },
        include: { service: { select: { name: true } }, client: { select: { phone: true, name: true } } },
      });
      if (!appt) continue;

      const nuevoEstado = decision === 'SI' ? 'scheduled' : 'cancelled';
      const updated = await prisma.appointment.update({
        where: { id: appt.id },
        data: { status: nuevoEstado, confirmCode: null },
      });

      // Sincronizar con Google Calendar si se confirmó
      if (nuevoEstado === 'scheduled' && gcal && gcal.syncAppointment) {
        try { gcal.syncAppointment(businessId, updated); } catch (_) {}
      }

      // Avisar al socio
      try {
        const svc = appt.service?.name || 'tu turno';
        const fecha = (() => { const [y, mo, d] = String(appt.date).split('-'); return d ? `${d}/${mo}` : appt.date; })();
        if (appt.client?.phone && evo.isConfigured()) {
          const txt = nuevoEstado === 'scheduled'
            ? `✅ Tu turno de ${svc} para el ${fecha} a las ${appt.startTime} fue *confirmado*. ¡Te esperamos!`
            : `❌ Lamentablemente tu turno de ${svc} para el ${fecha} a las ${appt.startTime} no pudo confirmarse. Escribinos para reprogramar.`;
          evo.sendText(businessId, appt.client.phone, txt).catch(() => {});
        }
      } catch (_) {}

      // Confirmación al negocio (mismo chat)
      try {
        const biz = await prisma.business.findUnique({ where: { id: businessId }, select: { phone: true } });
        if (biz?.phone && evo.isConfigured()) {
          const ack = nuevoEstado === 'scheduled' ? 'Turno confirmado ✅' : 'Turno rechazado ❌';
          evo.sendText(businessId, biz.phone, ack).catch(() => {});
        }
      } catch (_) {}
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[wa-webhook]', e.message);
    res.json({ ok: true });
  }
});

router.use(authMiddleware);

// GET /api/whatsapp/status
router.get('/status', async (req, res) => {
  try {
    if (!evo.isConfigured()) return res.json({ provider: 'evolution', configured: false, state: 'disconnected' });
    const { state } = await evo.getState(req.user.businessId);
    res.json({ provider: 'evolution', configured: true, state, connected: state === 'connected' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/whatsapp/connect — crea la instancia y devuelve el QR
router.post('/connect', async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Solo el propietario puede conectar WhatsApp' });
  if (!evo.isConfigured()) return res.status(400).json({ error: 'WhatsApp no está configurado en el servidor.' });
  try {
    const r = await evo.connect(req.user.businessId);
    res.json({ ok: true, qr: r.qr || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/whatsapp/qr — trae el QR actual
router.get('/qr', async (req, res) => {
  try {
    const r = await evo.getQR(req.user.businessId);
    if (!r.qr) return res.status(404).json({ error: 'No hay QR disponible' });
    res.json({ qr: r.qr });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/whatsapp/logout
router.post('/logout', async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Solo el propietario puede desconectar' });
  try { await evo.logout(req.user.businessId); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/whatsapp/test
router.post('/test', async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Solo el propietario puede usar esta función' });
  const { phone, message } = req.body;
  if (!phone || !message) return res.status(400).json({ error: 'phone y message son requeridos' });
  try {
    const { state } = await evo.getState(req.user.businessId);
    if (state !== 'connected') return res.status(400).json({ error: 'WhatsApp no conectado. Escaneá el QR primero.' });
    await evo.sendText(req.user.businessId, phone, message);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/whatsapp/send
router.post('/send', async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) return res.status(400).json({ error: 'phone y message son requeridos' });
  try {
    const { state } = await evo.getState(req.user.businessId);
    if (state !== 'connected') return res.status(409).json({ error: 'WhatsApp no conectado', code: 'NOT_CONNECTED' });
    await evo.sendText(req.user.businessId, phone, message);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/whatsapp/send-receipt — genera el PDF del recibo y lo envía como documento
router.post('/send-receipt', async (req, res) => {
  const { phone, receipt, caption } = req.body;
  if (!phone || !receipt) return res.status(400).json({ error: 'phone y receipt son requeridos' });
  try {
    const { state } = await evo.getState(req.user.businessId);
    if (state !== 'connected') return res.status(409).json({ error: 'WhatsApp no conectado', code: 'NOT_CONNECTED' });
    const logoPath = path.join(PHOTOS_DIR, `business-${req.user.businessId}.jpg`);
    const pdf = await generateReceiptPdf({ ...receipt, logoPath });
    const safeNro = String(receipt.nroRecibo || 'pago').replace(/[^\w-]/g, '');
    await evo.sendDocument(req.user.businessId, phone, pdf, `Recibo-${safeNro}.pdf`, caption || `Recibo de pago N° ${receipt.nroRecibo || ''}`);
    res.json({ ok: true });
  } catch (err) { console.error('[send-receipt]', err.message); res.status(500).json({ error: err.message }); }
});

// POST /api/whatsapp/send-payroll — genera el recibo de haberes y lo envía
router.post('/send-payroll', async (req, res) => {
  const { phone, payroll, caption } = req.body;
  if (!phone || !payroll) return res.status(400).json({ error: 'phone y payroll son requeridos' });
  try {
    const { state } = await evo.getState(req.user.businessId);
    if (state !== 'connected') return res.status(409).json({ error: 'WhatsApp no conectado', code: 'NOT_CONNECTED' });
    const logoPath = path.join(PHOTOS_DIR, `business-${req.user.businessId}.jpg`);
    const pdf = await generatePayrollPdf({ ...payroll, logoPath });
    const safe = String(payroll.employeeName || 'empleado').replace(/[^\w-]/g, '').slice(0, 30) || 'haberes';
    await evo.sendDocument(req.user.businessId, phone, pdf, `Recibo-haberes-${safe}.pdf`, caption || `Recibo de haberes — ${payroll.employeeName || ''}`);
    res.json({ ok: true });
  } catch (err) { console.error('[send-payroll]', err.message); res.status(500).json({ error: err.message }); }
});

// POST /api/whatsapp/run-reminders — dispara el barrido manualmente
router.post('/run-reminders', async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Solo el propietario puede usar esta función' });
  try {
    const { state } = await evo.getState(req.user.businessId);
    if (state !== 'connected') return res.status(400).json({ error: 'WhatsApp no conectado' });
  } catch (_) {}
  res.json({ ok: true, message: 'Barrido iniciado en background' });
  runReminders(req.user.businessId).catch(e => console.error('[manual-reminder]', e.message));
});

// GET /api/whatsapp/templates — plantillas de texto del negocio
router.get('/templates', async (req, res) => {
  try {
    const biz = await prisma.business.findUnique({
      where: { id: req.user.businessId },
      select: { waTemplateExpiring: true, waTemplateOverdue: true, waTemplateAppointment: true },
    });
    res.json({
      expiring:    biz?.waTemplateExpiring    || '',
      overdue:     biz?.waTemplateOverdue     || '',
      appointment: biz?.waTemplateAppointment || '',
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/whatsapp/templates — guardar plantillas
router.put('/templates', async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Solo el propietario puede editar plantillas' });
  const { expiring, overdue, appointment } = req.body;
  try {
    await prisma.business.update({
      where: { id: req.user.businessId },
      data: {
        waTemplateExpiring:    expiring    || null,
        waTemplateOverdue:     overdue     || null,
        waTemplateAppointment: appointment || null,
      },
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/whatsapp/reminder-config — config de recordatorios automáticos
router.get('/reminder-config', async (req, res) => {
  try {
    const biz = await prisma.business.findUnique({
      where: { id: req.user.businessId },
      select: { waAutoReminders: true, waReminderHour: true },
    });
    res.json({ autoReminders: !!biz?.waAutoReminders, reminderHour: biz?.waReminderHour ?? 9 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/whatsapp/reminder-config — activar/desactivar y elegir hora
router.put('/reminder-config', async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Solo el propietario puede cambiar esto' });
  try {
    const auto = !!req.body.autoReminders;
    let hour = parseInt(req.body.reminderHour, 10);
    if (isNaN(hour) || hour < 0 || hour > 23) hour = 9;
    await prisma.business.update({
      where: { id: req.user.businessId },
      data: { waAutoReminders: auto, waReminderHour: hour },
    });
    res.json({ ok: true, autoReminders: auto, reminderHour: hour });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
