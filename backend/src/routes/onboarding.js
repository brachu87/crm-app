const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware);

function parseSeen(v) { try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } }

// GET /api/onboarding -> claves de onboarding ya vistas por este usuario
router.get('/', async (req, res) => {
  try {
    const u = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { onboardingSeen: true } });
    res.json({ seen: parseSeen(u && u.onboardingSeen) });
  } catch (e) { res.json({ seen: [] }); }
});

// POST /api/onboarding { key } -> marca una sección como vista (persistente por usuario)
router.post('/', async (req, res) => {
  try {
    const key = String((req.body && req.body.key) || '').trim();
    if (!key) return res.status(400).json({ error: 'key requerido' });
    const u = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { onboardingSeen: true } });
    const seen = parseSeen(u && u.onboardingSeen);
    if (!seen.includes(key)) seen.push(key);
    await prisma.user.update({ where: { id: req.user.userId }, data: { onboardingSeen: JSON.stringify(seen) } });
    res.json({ ok: true, seen });
  } catch (e) { res.status(500).json({ error: 'Error al guardar onboarding' }); }
});

module.exports = router;
