// Notas tipo "sucesos con historial" para clientes, proveedores y órdenes de trabajo.
const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { logAudit } = require('../lib/audit');

const router = express.Router();
router.use(authMiddleware);

const TIPOS = ['nota', 'llamado', 'visita', 'reclamo', 'pago', 'otro'];
const ENTIDADES = ['client', 'supplier', 'workorder'];

// Verifica que la entidad exista y sea del negocio del usuario
async function pertenece(entityType, entityId, businessId) {
  if (!ENTIDADES.includes(entityType) || !entityId) return false;
  const where = { id: entityId, businessId };
  if (entityType === 'client')   return !!(await prisma.client.findFirst({ where, select: { id: true } }));
  if (entityType === 'supplier') return !!(await prisma.supplier.findFirst({ where, select: { id: true } }));
  if (entityType === 'workorder')return !!(await prisma.workOrder.findFirst({ where, select: { id: true } }));
  return false;
}

// GET /api/entity-notes?entityType=client&entityId=xxx
router.get('/', async (req, res) => {
  try {
    const { entityType, entityId } = req.query;
    if (!(await pertenece(entityType, entityId, req.user.businessId))) return res.status(404).json({ error: 'No encontrado' });
    // Migración idempotente de las notas viejas de cliente (ClientNote) al nuevo historial
    if (entityType === 'client') {
      try {
        const legacy = await prisma.clientNote.findMany({ where: { clientId: entityId } });
        for (const l of legacy) {
          await prisma.entityNote.upsert({
            where: { id: 'cn_' + l.id },
            create: { id: 'cn_' + l.id, businessId: req.user.businessId, entityType: 'client', entityId, tipo: 'nota', texto: l.content, createdAt: l.createdAt },
            update: {},
          });
        }
      } catch (_) {}
    }
    const rows = await prisma.entityNote.findMany({
      where: { businessId: req.user.businessId, entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows);
  } catch (e) { console.error('[entity-notes] list', e.message); res.status(500).json({ error: 'Error al listar notas' }); }
});

// POST /api/entity-notes  { entityType, entityId, tipo, texto }
router.post('/', async (req, res) => {
  try {
    const { entityType, entityId, tipo, texto } = req.body || {};
    if (!(await pertenece(entityType, entityId, req.user.businessId))) return res.status(404).json({ error: 'No encontrado' });
    const t = String(texto || '').trim();
    if (!t) return res.status(400).json({ error: 'Escribí el texto de la nota' });
    let userName = null;
    try { const u = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { name: true } }); userName = u?.name || null; } catch {}
    const note = await prisma.entityNote.create({
      data: {
        businessId: req.user.businessId,
        entityType, entityId,
        tipo: TIPOS.includes(tipo) ? tipo : 'nota',
        texto: t.slice(0, 2000),
        userId: req.user.userId || null,
        userName,
      },
    });
    res.status(201).json(note);
  } catch (e) { console.error('[entity-notes] create', e.message); res.status(500).json({ error: 'No se pudo guardar la nota' }); }
});

// DELETE /api/entity-notes/:id
router.delete('/:id', async (req, res) => {
  try {
    const n = await prisma.entityNote.findFirst({ where: { id: req.params.id, businessId: req.user.businessId } });
    if (!n) return res.status(404).json({ error: 'Nota no encontrada' });
    await prisma.entityNote.delete({ where: { id: n.id } });
    res.json({ ok: true });
  } catch (e) { console.error('[entity-notes] delete', e.message); res.status(500).json({ error: 'No se pudo eliminar' }); }
});

module.exports = router;
