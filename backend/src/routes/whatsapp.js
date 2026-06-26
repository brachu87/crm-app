const express  = require('express');
const router   = express.Router();
const authMiddleware = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const { getState, getQR, sendMessage, sendDocument, logout, initWhatsApp } = require('../lib/whatsappBaileys');
const { generateReceiptPdf, generatePayrollPdf } = require('../lib/receiptPdf');
const PHOTOS_DIR = process.env.PHOTOS_DIR
  || (fs.existsSync('/data') ? '/data/photos' : path.join(__dirname, '../../../data/photos'));
const prisma = require('../prisma');
const { runReminders } = require('../lib/reminderCron');

router.use(authMiddleware);

// GET /api/whatsapp/status
router.get('/status', (req, res) => {
  res.json(getState(req.user.businessId));
});

// GET /api/whatsapp/qr  — devuelve el QR como data:image/png;base64
router.get('/qr', (req, res) => {
  const qr = getQR(req.user.businessId);
  if (!qr) return res.status(404).json({ error: 'No hay QR disponible' });
  res.json({ qr });
});

// POST /api/whatsapp/connect  — iniciar conexión (genera QR)
router.post('/connect', async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Solo el propietario puede conectar WhatsApp' });
  const { state } = getState(req.user.businessId);
  if (state === 'connected') return res.json({ ok: true, message: 'Ya conectado' });
  // initWhatsApp no bloquea — el QR aparece via polling de /status + /qr
  initWhatsApp(req.user.businessId).catch(e => console.error('[wa-connect]', e.message));
  res.json({ ok: true, message: 'Iniciando conexión...' });
});

// POST /api/whatsapp/logout  — cerrar sesión
router.post('/logout', async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Solo el propietario puede desconectar' });
  await logout(req.user.businessId);
  res.json({ ok: true });
});

// POST /api/whatsapp/test  — enviar mensaje de prueba
router.post('/test', async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Solo el propietario puede usar esta función' });
  const { state } = getState(req.user.businessId);
  if (state !== 'connected') return res.status(400).json({ error: 'WhatsApp no conectado. Escanear el QR primero.' });

  const { phone, message } = req.body;
  if (!phone || !message) return res.status(400).json({ error: 'phone y message son requeridos' });

  try {
    const result = await sendMessage(req.user.businessId, phone, message);
    res.json({ ok: true, to: result.to });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/send  — envío directo de un mensaje (con código para fallback a wa.me)
router.post('/send', async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) return res.status(400).json({ error: 'phone y message son requeridos' });
  const { state } = getState(req.user.businessId);
  if (state !== 'connected') return res.status(409).json({ error: 'WhatsApp no conectado', code: 'NOT_CONNECTED' });
  try {
    const result = await sendMessage(req.user.businessId, phone, message);
    res.json({ ok: true, to: result.to });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/send-receipt — genera el PDF del recibo y lo envía como documento
router.post('/send-receipt', async (req, res) => {
  const { phone, receipt, caption } = req.body;
  if (!phone || !receipt) return res.status(400).json({ error: 'phone y receipt son requeridos' });
  const { state } = getState(req.user.businessId);
  if (state !== 'connected') return res.status(409).json({ error: 'WhatsApp no conectado', code: 'NOT_CONNECTED' });
  try {
    const logoPath = path.join(PHOTOS_DIR, `business-${req.user.businessId}.jpg`);
    const pdf = await generateReceiptPdf({ ...receipt, logoPath });
    const safeNro = String(receipt.nroRecibo || 'pago').replace(/[^\w-]/g, '');
    const result = await sendDocument(req.user.businessId, phone, pdf, `Recibo-${safeNro}.pdf`, caption || `Recibo de pago N° ${receipt.nroRecibo || ''}`);
    res.json({ ok: true, to: result.to });
  } catch (err) {
    console.error('[send-receipt]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/send-payroll — genera el PDF del recibo de haberes y lo envía
router.post('/send-payroll', async (req, res) => {
  const { phone, payroll, caption } = req.body;
  if (!phone || !payroll) return res.status(400).json({ error: 'phone y payroll son requeridos' });
  const { state } = getState(req.user.businessId);
  if (state !== 'connected') return res.status(409).json({ error: 'WhatsApp no conectado', code: 'NOT_CONNECTED' });
  try {
    const logoPath = path.join(PHOTOS_DIR, `business-${req.user.businessId}.jpg`);
    const pdf = await generatePayrollPdf({ ...payroll, logoPath });
    const safe = String(payroll.employeeName || 'empleado').replace(/[^\w-]/g, '').slice(0, 30) || 'haberes';
    const result = await sendDocument(req.user.businessId, phone, pdf, `Recibo-haberes-${safe}.pdf`, caption || `Recibo de haberes — ${payroll.employeeName || ''}`);
    res.json({ ok: true, to: result.to });
  } catch (err) {
    console.error('[send-payroll]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/run-reminders  — disparar cron manualmente
router.post('/run-reminders', async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Solo el propietario puede usar esta función' });
  const { state } = getState(req.user.businessId);
  if (state !== 'connected') return res.status(400).json({ error: 'WhatsApp no conectado' });
  res.json({ ok: true, message: 'Barrido iniciado en background' });
  runReminders(req.user.businessId).catch(e => console.error('[manual-reminder]', e.message));
});

// GET /api/whatsapp/templates — leer plantillas auto del negocio
router.get('/templates', async (req, res) => {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT "waTemplateExpiring", "waTemplateOverdue", "waTemplateAppointment" FROM "Business" WHERE id = ? LIMIT 1`,
      req.user.businessId
    );
    const row = rows?.[0] || {};
    res.json({
      expiring:    row.waTemplateExpiring    || '',
      overdue:     row.waTemplateOverdue     || '',
      appointment: row.waTemplateAppointment || '',
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
    await prisma.$executeRawUnsafe(
      `UPDATE "Business" SET "waTemplateExpiring" = ?, "waTemplateOverdue" = ?, "waTemplateAppointment" = ? WHERE id = ?`,
      expiring || null, overdue || null, appointment || null, req.user.businessId
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
