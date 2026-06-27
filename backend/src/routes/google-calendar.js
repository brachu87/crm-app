const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const auth = require('../middleware/auth');
const prisma = require('../prisma');
const gcal = require('../lib/googleCalendar');

// GET /status — estado de conexión + toggles (requiere auth)
router.get('/status', auth, async (req, res) => {
  try {
    const biz = await prisma.business.findUnique({ where: { id: req.user.businessId } });
    res.json({
      configured: gcal.isConfigured(),
      connected: !!(biz && biz.googleCalendarToken),
      syncTurnos: !!(biz && biz.gcalSyncTurnos),
      syncAgenda: !!(biz && biz.gcalSyncAgenda),
      syncClases: !!(biz && biz.gcalSyncClases),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /connect — devuelve la URL de consentimiento de Google
router.get('/connect', auth, (req, res) => {
  if (!gcal.isConfigured()) {
    return res.status(400).json({ error: 'Falta configurar GOOGLE_CLIENT_SECRET en el servidor' });
  }
  const state = jwt.sign({ businessId: req.user.businessId, k: 'gcal' }, process.env.JWT_SECRET, { expiresIn: '15m' });
  res.json({ url: gcal.authUrl(state) });
});

// GET /callback — redirección del navegador desde Google (PÚBLICA)
router.get('/callback', async (req, res) => {
  const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
  const back = (q) => res.redirect(`${appUrl}/ajustes?gcal=${q}`);
  try {
    const { code, state } = req.query;
    if (!code || !state) return back('error');
    const payload = jwt.verify(state, process.env.JWT_SECRET);
    if (payload.k !== 'gcal') return back('error');
    const tokens = await gcal.exchangeCode(code);
    const biz = await prisma.business.findUnique({ where: { id: payload.businessId } });
    let merged = tokens;
    if (!tokens.refresh_token && biz && biz.googleCalendarToken) {
      const old = JSON.parse(biz.googleCalendarToken);
      merged = { ...tokens, refresh_token: old.refresh_token };
    }
    await prisma.business.update({
      where: { id: payload.businessId },
      data: { googleCalendarToken: JSON.stringify(merged), gcalSyncTurnos: true, gcalSyncAgenda: true, gcalSyncClases: true },
    });
    await gcal.ensureCalendar(payload.businessId); // crea el calendario "Gestumio"
    back('ok');
  } catch (e) {
    console.error('[gcal callback]', e.message);
    back('error');
  }
});

// POST /settings — actualizar toggles
router.post('/settings', auth, async (req, res) => {
  try {
    const { syncTurnos, syncAgenda, syncClases } = req.body;
    const data = {};
    if (syncTurnos !== undefined) data.gcalSyncTurnos = !!syncTurnos;
    if (syncAgenda !== undefined) data.gcalSyncAgenda = !!syncAgenda;
    if (syncClases !== undefined) data.gcalSyncClases = !!syncClases;
    await prisma.business.update({ where: { id: req.user.businessId }, data });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /disconnect
router.post('/disconnect', auth, async (req, res) => {
  try {
    await prisma.business.update({
      where: { id: req.user.businessId },
      data: { googleCalendarToken: null, googleCalendarId: null, gcalSyncTurnos: false, gcalSyncAgenda: false, gcalSyncClases: false },
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
