const prisma = require('../prisma');

// Registra una acción para trazabilidad. Nunca lanza (no rompe el flujo principal).
async function logAudit(req, { action, entity, entityId, detail }) {
  try {
    let userName = null;
    const uid = req.user && req.user.userId;
    if (uid) {
      const u = await prisma.user.findUnique({ where: { id: uid }, select: { name: true } }).catch(() => null);
      userName = u && u.name || null;
    }
    await prisma.auditLog.create({
      data: {
        businessId: req.user.businessId,
        userId: uid || null,
        userName,
        action,
        entity: entity || null,
        entityId: entityId || null,
        detail: detail || null,
      },
    });
  } catch (e) { console.error('[audit]', e.message); }
}

module.exports = { logAudit };
