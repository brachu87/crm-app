const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { isConfigured, sendText, normalizePhone } = require('../lib/whatsappMeta');
const { runReminders } = require('../lib/reminderCron');

router.use(authMiddleware);

// GET /api/whatsapp/status
router.get('/status', (req, res) => {
  res.json({
    configured: isConfigured(),
    phoneId: process.env.META_WA_PHONE_ID ? '****' + process.env.META_WA_PHONE_ID.slice(-4) : null,
  });
});

// POST /api/whatsapp/test — enviar mensaje de prueba
router.post('/test', async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Solo el propietario puede usar esta función' });
  if (!isConfigured()) return res.status(400).json({ error: 'WhatsApp no configurado. Agregá META_WA_TOKEN y META_WA_PHONE_ID en Railway.' });

  const { phone, message } = req.body;
  if (!phone || !message) return res.status(400).json({ error: 'phone y message son requeridos' });

  const normalized = normalizePhone(phone);
  if (!normalized) return res.status(400).json({ error: 'Número de teléfono inválido' });

  try {
    const result = await sendText(phone, message);
    res.json({ ok: true, to: normalized, messageId: result?.messages?.[0]?.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/run-reminders — disparar el cron manualmente (owner only)
router.post('/run-reminders', async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Solo el propietario puede usar esta función' });
  if (!isConfigured()) return res.status(400).json({ error: 'WhatsApp no configurado' });
  res.json({ ok: true, message: 'Barrido iniciado en background' });
  runReminders().catch(e => console.error('[manual-reminder]', e.message));
});

module.exports = router;
