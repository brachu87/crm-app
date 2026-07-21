// Verifica que el request venga de un Telegram vinculado y NO revocado.
// Se usa DESPUÉS del authMiddleware global (que ya validó el JWT y seteó req.user).
const prisma = require('../prisma');

async function botLinkCheck(req, res, next) {
  try {
    if (!req.user || req.user.via !== 'telegram' || !req.user.tg) {
      return res.status(401).json({ error: 'Token de bot inválido' });
    }
    const link = await prisma.telegramLink.findUnique({ where: { telegramUserId: String(req.user.tg) } });
    if (!link || link.revoked) {
      return res.status(401).json({ error: 'La vinculación con Telegram fue revocada. Volvé a vincular desde Gestumio.' });
    }
    if (link.businessId !== req.user.businessId) {
      return res.status(401).json({ error: 'Vinculación inconsistente' });
    }
    const biz = await prisma.business.findUnique({ where: { id: link.businessId }, select: { telegramBotEnabled: true } });
    if (!biz || biz.telegramBotEnabled !== true) {
      return res.status(403).json({ error: 'El bot de Telegram está deshabilitado para este negocio.' });
    }
    // marcar uso (sin bloquear la respuesta)
    prisma.telegramLink.update({ where: { telegramUserId: String(req.user.tg) }, data: { lastUsedAt: new Date() } }).catch(() => {});
    req.botLink = link;
    next();
  } catch (e) {
    console.error('[botAuth]', e.message);
    res.status(500).json({ error: 'Error de autenticación del bot' });
  }
}

module.exports = { botLinkCheck };
