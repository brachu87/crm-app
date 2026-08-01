// Órdenes de trabajo. CRUD + crear desde un presupuesto + estado/asignación.
const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { logAudit } = require('../lib/audit');

const router = express.Router();
router.use(authMiddleware);

const ESTADOS = ['pendiente', 'en_curso', 'terminada', 'cancelada'];
const calcTotal = (items) => Array.isArray(items) ? items.reduce((s, it) => s + (Number(it.cantidad) || 0) * (Number(it.precio) || 0), 0) : 0;
const normItems = (items) => Array.isArray(items)
  ? items.map(it => ({ descripcion: String(it.descripcion || '').slice(0, 300), cantidad: Number(it.cantidad) || 1, precio: Number(it.precio) || 0 })).filter(it => it.descripcion)
  : [];

async function nextNumero(businessId) {
  const max = await prisma.workOrder.aggregate({ where: { businessId }, _max: { numero: true } });
  return (max._max.numero || 0) + 1;
}
function parse(row) { let items = []; try { items = JSON.parse(row.itemsJson || '[]'); } catch {} return { ...row, items }; }

// GET /api/work-orders
router.get('/', async (req, res) => {
  try {
    const rows = await prisma.workOrder.findMany({ where: { businessId: req.user.businessId }, orderBy: { numero: 'desc' } });
    const emps = await prisma.employee.findMany({ where: { businessId: req.user.businessId }, select: { id: true, name: true } });
    const nameOf = Object.fromEntries(emps.map(e => [e.id, e.name]));
    res.json(rows.map(r => ({ ...parse(r), employeeName: r.employeeId ? (nameOf[r.employeeId] || null) : null })));
  } catch (e) { console.error('[wo] list', e.message); res.status(500).json({ error: 'Error al listar órdenes' }); }
});

// POST /api/work-orders  (manual)
router.post('/', async (req, res) => {
  try {
    const { clientId, clienteNombre, titulo, employeeId, items, scheduledDate, notas, status } = req.body || {};
    const its = normItems(items);
    let nombre = (clienteNombre || '').trim(); let cid = clientId || null;
    if (cid) { const c = await prisma.client.findFirst({ where: { id: cid, businessId: req.user.businessId }, select: { name: true } }); if (!c) return res.status(400).json({ error: 'Cliente no encontrado' }); if (!nombre) nombre = c.name; }
    let eid = employeeId || null;
    if (eid) { const e = await prisma.employee.findFirst({ where: { id: eid, businessId: req.user.businessId }, select: { id: true } }); if (!e) return res.status(400).json({ error: 'Empleado no encontrado' }); }
    const wo = await prisma.workOrder.create({ data: {
      businessId: req.user.businessId, clientId: cid, clienteNombre: nombre || null, titulo: (titulo || '').trim() || null,
      employeeId: eid, numero: await nextNumero(req.user.businessId), itemsJson: JSON.stringify(its), total: calcTotal(its),
      status: ESTADOS.includes(status) ? status : 'pendiente', scheduledDate: (scheduledDate || '').trim() || null, notas: (notas || '').trim() || null,
    } });
    logAudit(req, { action: 'creo_orden_trabajo', entity: 'orden_trabajo', entityId: wo.id, detail: `#${wo.numero} · ${nombre || 's/cliente'}` });
    res.status(201).json(parse(wo));
  } catch (e) { console.error('[wo] create', e.message); res.status(500).json({ error: 'No se pudo crear la orden' }); }
});

// POST /api/work-orders/from-budget/:budgetId
router.post('/from-budget/:budgetId', async (req, res) => {
  try {
    const b = await prisma.budget.findFirst({ where: { id: req.params.budgetId, businessId: req.user.businessId } });
    if (!b) return res.status(404).json({ error: 'Presupuesto no encontrado' });
    const wo = await prisma.workOrder.create({ data: {
      businessId: req.user.businessId, budgetId: b.id, clientId: b.clientId, clienteNombre: b.clienteNombre,
      titulo: `Presupuesto N° ${String(b.numero).padStart(6, '0')}`, numero: await nextNumero(req.user.businessId),
      itemsJson: b.itemsJson, total: b.total, status: 'pendiente',
    } });
    logAudit(req, { action: 'convirtio_presupuesto_ot', entity: 'orden_trabajo', entityId: wo.id, detail: `#${wo.numero} desde presupuesto #${b.numero}` });
    res.status(201).json(parse(wo));
  } catch (e) { console.error('[wo] from-budget', e.message); res.status(500).json({ error: 'No se pudo crear la orden desde el presupuesto' }); }
});

// PUT /api/work-orders/:id
router.put('/:id', async (req, res) => {
  try {
    const own = await prisma.workOrder.findFirst({ where: { id: req.params.id, businessId: req.user.businessId } });
    if (!own) return res.status(404).json({ error: 'Orden no encontrada' });
    const { clienteNombre, titulo, employeeId, items, scheduledDate, notas, status } = req.body || {};
    const data = {};
    if (clienteNombre !== undefined) data.clienteNombre = (clienteNombre || '').trim() || null;
    if (titulo !== undefined) data.titulo = (titulo || '').trim() || null;
    if (notas !== undefined) data.notas = (notas || '').trim() || null;
    if (scheduledDate !== undefined) data.scheduledDate = (scheduledDate || '').trim() || null;
    if (employeeId !== undefined) {
      const eid = employeeId || null;
      if (eid) { const e = await prisma.employee.findFirst({ where: { id: eid, businessId: req.user.businessId }, select: { id: true } }); if (!e) return res.status(400).json({ error: 'Empleado no encontrado' }); }
      data.employeeId = eid;
    }
    if (items !== undefined) { const its = normItems(items); data.itemsJson = JSON.stringify(its); data.total = calcTotal(its); }
    if (status !== undefined) {
      if (!ESTADOS.includes(status)) return res.status(400).json({ error: 'Estado inválido' });
      data.status = status;
      data.completedAt = status === 'terminada' ? (own.completedAt || new Date()) : null;
    }
    const wo = await prisma.workOrder.update({ where: { id: own.id }, data });
    const detalleEstado = (status !== undefined && status !== own.status) ? ` · estado: ${status}` : '';
    logAudit(req, { action: 'edito_orden_trabajo', entity: 'orden_trabajo', entityId: wo.id, detail: `#${wo.numero}${detalleEstado}` });
    res.json(parse(wo));
  } catch (e) { console.error('[wo] update', e.message); res.status(500).json({ error: 'No se pudo actualizar' }); }
});

// POST /api/work-orders/:id/cobrar  -> registra un ingreso por el total de la OT
router.post('/:id/cobrar', async (req, res) => {
  try {
    const own = await prisma.workOrder.findFirst({ where: { id: req.params.id, businessId: req.user.businessId } });
    if (!own) return res.status(404).json({ error: 'Orden no encontrada' });
    if (own.status !== 'terminada') return res.status(400).json({ error: 'Solo se pueden cobrar órdenes terminadas' });
    if (own.cobrada) return res.status(400).json({ error: 'Esta orden ya fue cobrada' });
    if (!(own.total > 0)) return res.status(400).json({ error: 'La orden no tiene un total a cobrar' });
    const hoy = new Date().toISOString().slice(0, 10);
    const desc = `OT N° ${String(own.numero).padStart(6, '0')}${own.titulo ? ' · ' + own.titulo : (own.clienteNombre ? ' · ' + own.clienteNombre : '')}`;
    const inc = await prisma.manualIncome.create({ data: {
      businessId: req.user.businessId, clientId: own.clientId || null,
      amount: own.total, description: desc.slice(0, 240), category: 'Orden de trabajo', date: hoy,
    } });
    const wo = await prisma.workOrder.update({ where: { id: own.id }, data: { cobrada: true, manualIncomeId: inc.id } });
    logAudit(req, { action: 'cobro_orden_trabajo', entity: 'orden_trabajo', entityId: wo.id, detail: `#${wo.numero} · $${own.total}` });
    res.json(parse(wo));
  } catch (e) { console.error('[wo] cobrar', e.message); res.status(500).json({ error: 'No se pudo registrar el cobro' }); }
});

// POST /api/work-orders/:id/marcar-facturada  -> se llama luego de emitir la factura desde la OT
router.post('/:id/marcar-facturada', async (req, res) => {
  try {
    const own = await prisma.workOrder.findFirst({ where: { id: req.params.id, businessId: req.user.businessId } });
    if (!own) return res.status(404).json({ error: 'Orden no encontrada' });
    const { invoiceId } = req.body || {};
    const wo = await prisma.workOrder.update({ where: { id: own.id }, data: { facturada: true, invoiceId: invoiceId || own.invoiceId || null } });
    logAudit(req, { action: 'facturo_orden_trabajo', entity: 'orden_trabajo', entityId: wo.id, detail: `#${wo.numero}` });
    res.json(parse(wo));
  } catch (e) { console.error('[wo] marcar-facturada', e.message); res.status(500).json({ error: 'No se pudo marcar como facturada' }); }
});

// DELETE /api/work-orders/:id
router.delete('/:id', async (req, res) => {
  try {
    const own = await prisma.workOrder.findFirst({ where: { id: req.params.id, businessId: req.user.businessId } });
    if (!own) return res.status(404).json({ error: 'Orden no encontrada' });
    await prisma.workOrder.delete({ where: { id: own.id } });
    logAudit(req, { action: 'elimino_orden_trabajo', entity: 'orden_trabajo', entityId: own.id, detail: `#${own.numero}` });
    res.json({ ok: true });
  } catch (e) { console.error('[wo] delete', e.message); res.status(500).json({ error: 'No se pudo eliminar' }); }
});

module.exports = router;
