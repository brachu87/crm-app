const express  = require('express');
const router   = express.Router();
const authMiddleware = require('../middleware/auth');
const { getState, getQR, sendMessage, logout, initWhatsApp } = require('../lib/whatsappBaileys');
const prisma = require('../prisma');
const { runReminders } = require('../lib/reminderCron');

router.use(authMiddleware);

// GET /api/whatsapp/status
router.get('/status', (req, res) => {
  res.json(getState());
});

// GET /api/whatsapp/qr  — devuelve el QR como data:image/png;base64
router.get('/qr', (req, res) => {
  const qr = getQR();
  if (!qr) return res.status(404).json({ error: 'No hay QR disponible' });
  res.json({ qr });
});

// POST /api/whatsapp/connect  — iniciar conexión (genera QR)
router.post('/connect', async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Solo el propietario puede conectar WhatsApp' });
  const { state } = getState();
  if (state === 'connected') return res.json({ ok: true, message: 'Ya conectado' });
  // initWhatsApp no bloquea — el QR aparece via polling de /status + /qr
  initWhatsApp().catch(e => console.error('[wa-connect]', e.message));
  res.json({ ok: true, message: 'Iniciando conexión...' });
});

// POST /api/whatsapp/logout  — cerrar sesión
router.post('/logout', async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Solo el propietario puede desconectar' });
  await logout();
  res.json({ ok: true });
});

// POST /api/whatsapp/test  — enviar mensaje de prueba
router.post('/test', async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Solo el propietario puede usar esta función' });
  const { state } = getState();
  if (state !== 'connected') return res.status(400).json({ error: 'WhatsApp no conectado. Escanear el QR primero.' });

  const { phone, message } = req.body;
  if (!phone || !message) return res.status(400).json({ error: 'phone y message son requeridos' });

  try {
    const result = await sendMessage(phone, message);
    res.json({ ok: true, to: result.to });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/run-reminders  — disparar cron manualmente
router.post('/run-reminders', async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Solo el propietario puede usar esta función' });
  const { state } = getState();
  if (state !== 'connected') return res.status(400).json({ error: 'WhatsApp no conectado' });
  res.json({ ok: true, message: 'Barrido iniciado en background' });
  runReminders().catch(e => console.error('[manual-reminder]', e.message));
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
