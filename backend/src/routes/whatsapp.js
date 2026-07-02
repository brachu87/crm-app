const express  = require('express');
const router   = express.Router();
const authMiddleware = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const meta = require('../lib/whatsappMeta');
const { generateReceiptPdf, generatePayrollPdf } = require('../lib/receiptPdf');
const PHOTOS_DIR = process.env.PHOTOS_DIR
  || (fs.existsSync('/data') ? '/data/photos' : path.join(__dirname, '../../../data/photos'));
const prisma = require('../prisma');
const { runReminders } = require('../lib/reminderCron');

router.use(authMiddleware);

// Devuelve el phone_number_id del negocio (o null)
async function getBiz(businessId) {
  return prisma.business.findUnique({
    where: { id: businessId },
    select: { waPhoneId: true, waPhoneNumber: true, waWabaId: true, waToken: true },
  });
}

// GET /api/whatsapp/status
router.get('/status', async (req, res) => {
  try {
    const biz = await getBiz(req.user.businessId);
    const hasToken = !!(biz?.waToken) || meta.isConfigured();
    const connected = hasToken && !!biz?.waPhoneId;
    res.json({
      provider: 'meta',
      configured: hasToken,
      connected,                          // este negocio tiene número conectado
      state: connected ? 'connected' : 'disconnected',
      phone: biz?.waPhoneNumber || null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/whatsapp/test — mensaje de texto de prueba
router.post('/test', async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Solo el propietario puede usar esta función' });
  const biz = await getBiz(req.user.businessId);
  if (!biz?.waPhoneId) return res.status(400).json({ error: 'Tu negocio todavía no tiene WhatsApp conectado.' });

  const { phone, message } = req.body;
  if (!phone || !message) return res.status(400).json({ error: 'phone y message son requeridos' });
  try {
    await meta.sendText(biz.waPhoneId, phone, message, biz.waToken);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/send — texto libre (ventana 24hs)
router.post('/send', async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) return res.status(400).json({ error: 'phone y message son requeridos' });
  const biz = await getBiz(req.user.businessId);
  if (!biz?.waPhoneId) return res.status(409).json({ error: 'WhatsApp no configurado para este negocio', code: 'NOT_CONNECTED' });
  try {
    await meta.sendText(biz.waPhoneId, phone, message, biz.waToken);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/send-receipt — genera el PDF del recibo y lo envía como documento
router.post('/send-receipt', async (req, res) => {
  const { phone, receipt, caption } = req.body;
  if (!phone || !receipt) return res.status(400).json({ error: 'phone y receipt son requeridos' });
  const biz = await getBiz(req.user.businessId);
  if (!biz?.waPhoneId) return res.status(409).json({ error: 'WhatsApp no configurado para este negocio', code: 'NOT_CONNECTED' });
  try {
    const logoPath = path.join(PHOTOS_DIR, `business-${req.user.businessId}.jpg`);
    const pdf = await generateReceiptPdf({ ...receipt, logoPath });
    const safeNro = String(receipt.nroRecibo || 'pago').replace(/[^\w-]/g, '');
    await meta.sendDocument(biz.waPhoneId, phone, pdf, `Recibo-${safeNro}.pdf`, caption || `Recibo de pago N° ${receipt.nroRecibo || ''}`, biz.waToken);
    res.json({ ok: true });
  } catch (err) {
    console.error('[send-receipt]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/send-payroll — genera el PDF del recibo de haberes y lo envía
router.post('/send-payroll', async (req, res) => {
  const { phone, payroll, caption } = req.body;
  if (!phone || !payroll) return res.status(400).json({ error: 'phone y payroll son requeridos' });
  const biz = await getBiz(req.user.businessId);
  if (!biz?.waPhoneId) return res.status(409).json({ error: 'WhatsApp no configurado para este negocio', code: 'NOT_CONNECTED' });
  try {
    const logoPath = path.join(PHOTOS_DIR, `business-${req.user.businessId}.jpg`);
    const pdf = await generatePayrollPdf({ ...payroll, logoPath });
    const safe = String(payroll.employeeName || 'empleado').replace(/[^\w-]/g, '').slice(0, 30) || 'haberes';
    await meta.sendDocument(biz.waPhoneId, phone, pdf, `Recibo-haberes-${safe}.pdf`, caption || `Recibo de haberes — ${payroll.employeeName || ''}`, biz.waToken);
    res.json({ ok: true });
  } catch (err) {
    console.error('[send-payroll]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/run-reminders — disparar el barrido manualmente
router.post('/run-reminders', async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Solo el propietario puede usar esta función' });
  const biz = await getBiz(req.user.businessId);
  if (!biz?.waPhoneId) return res.status(400).json({ error: 'WhatsApp no configurado para este negocio' });
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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/whatsapp/embedded-config — datos públicos para iniciar el Embedded Signup
router.get('/embedded-config', async (req, res) => {
  res.json({
    appId: process.env.META_APP_ID || null,
    configId: process.env.META_CONFIG_ID || null,
    graphVersion: process.env.META_WA_VERSION || 'v19.0',
    ready: !!(process.env.META_APP_ID && process.env.META_CONFIG_ID && process.env.META_APP_SECRET),
  });
});

// POST /api/whatsapp/embedded-signup — recibe el code + IDs del Embedded Signup
// Body: { code, phoneNumberId, wabaId }
router.post('/embedded-signup', async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Solo el propietario puede conectar WhatsApp' });
  const { code, phoneNumberId, wabaId } = req.body || {};
  if (!code || !phoneNumberId || !wabaId) {
    return res.status(400).json({ error: 'Faltan datos del registro (code, phoneNumberId, wabaId)' });
  }
  try {
    // 1) Intercambiar el code por un token de acceso del negocio
    const accessToken = await meta.exchangeCode(code);
    // 2) Suscribir la app a los webhooks de la WABA
    try { await meta.subscribeApp(wabaId, accessToken); } catch (e) { console.warn('[es] subscribeApp:', e.message); }
    // 3) Registrar el número (coexistence). Best-effort.
    try { await meta.registerPhone(phoneNumberId, accessToken); } catch (e) { console.warn('[es] register:', e.message); }
    // 4) Leer el número visible
    let display = null;
    try { const info = await meta.getPhoneInfo(phoneNumberId, accessToken); display = info?.display_phone_number || null; } catch (e) { console.warn('[es] phoneInfo:', e.message); }
    // 5) Guardar en el negocio
    await prisma.business.update({
      where: { id: req.user.businessId },
      data: { waPhoneId: phoneNumberId, waWabaId: wabaId, waToken: accessToken, waPhoneNumber: display },
    });
    res.json({ ok: true, phone: display });
  } catch (err) {
    console.error('[embedded-signup]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/disconnect — desvincular el WhatsApp del negocio
router.post('/disconnect', async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Solo el propietario puede desconectar' });
  try {
    await prisma.business.update({
      where: { id: req.user.businessId },
      data: { waPhoneId: null, waWabaId: null, waToken: null, waPhoneNumber: null },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
