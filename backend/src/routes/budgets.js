// Presupuestos (documentos no fiscales). CRUD + PDF + envío por WhatsApp.
const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const budgetPdf = require('../lib/budgetPdf');
const evo = require('../lib/whatsappEvolution');
const { logAudit } = require('../lib/audit');
const path = require('path');
const fs = require('fs');

const router = express.Router();
router.use(authMiddleware);

const PHOTOS_DIR = process.env.PHOTOS_DIR || (fs.existsSync('/data') ? '/data/photos' : path.join(__dirname, '../../../data/photos'));
const ESTADOS = ['borrador', 'enviado', 'aceptado', 'rechazado'];

function calcTotal(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((s, it) => s + (Number(it.cantidad) || 0) * (Number(it.precio) || 0), 0);
}
function normItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map(it => ({ descripcion: String(it.descripcion || '').slice(0, 300), cantidad: Number(it.cantidad) || 1, precio: Number(it.precio) || 0 }))
    .filter(it => it.descripcion);
}

// GET /api/budgets
router.get('/', async (req, res) => {
  try {
    const rows = await prisma.budget.findMany({
      where: { businessId: req.user.businessId },
      orderBy: { numero: 'desc' },
    });
    // Presupuestos que ya se convirtieron en orden de trabajo
    const ots = await prisma.workOrder.findMany({ where: { businessId: req.user.businessId, budgetId: { not: null } }, select: { budgetId: true } });
    const conOT = new Set(ots.map(o => o.budgetId));
    res.json(rows.map(r => ({ ...r, tieneOT: conOT.has(r.id), items: (() => { try { return JSON.parse(r.itemsJson || '[]'); } catch { return []; } })() })));
  } catch (e) { console.error('[budgets] list', e.message); res.status(500).json({ error: 'Error al listar presupuestos' }); }
});

// POST /api/budgets
router.post('/', async (req, res) => {
  try {
    const { clientId, clienteNombre, clienteDoc, items, validezDias, notas, status } = req.body || {};
    const its = normItems(items);
    if (!its.length) return res.status(400).json({ error: 'Agregá al menos un ítem al presupuesto.' });

    let nombre = (clienteNombre || '').trim();
    let doc = (clienteDoc || '').trim() || null;
    let cid = clientId || null;
    if (cid) {
      const c = await prisma.client.findFirst({ where: { id: cid, businessId: req.user.businessId }, select: { id: true, name: true, dni: true, cuit: true } });
      if (!c) return res.status(400).json({ error: 'Cliente no encontrado' });
      if (!nombre) nombre = c.name;
      if (!doc) doc = c.cuit || c.dni || null;
    }

    const max = await prisma.budget.aggregate({ where: { businessId: req.user.businessId }, _max: { numero: true } });
    const numero = (max._max.numero || 0) + 1;
    const dias = (validezDias === '' || validezDias == null) ? 15 : parseInt(validezDias, 10);
    const validoHasta = dias > 0 ? new Date(Date.now() + dias * 86400000) : null;

    const b = await prisma.budget.create({
      data: {
        businessId: req.user.businessId, clientId: cid, clienteNombre: nombre || null, clienteDoc: doc,
        numero, status: ESTADOS.includes(status) ? status : 'borrador',
        itemsJson: JSON.stringify(its), total: calcTotal(its),
        validezDias: dias || null, validoHasta, notas: (notas || '').trim() || null,
      },
    });
    logAudit(req, { action: 'creo_presupuesto', entity: 'presupuesto', entityId: b.id, detail: `#${numero} · ${nombre || 's/cliente'} · $${b.total}` });
    res.status(201).json(b);
  } catch (e) { console.error('[budgets] create', e.message); res.status(500).json({ error: 'No se pudo crear el presupuesto' }); }
});

// PUT /api/budgets/:id  (editar datos y/o estado)
router.put('/:id', async (req, res) => {
  try {
    const own = await prisma.budget.findFirst({ where: { id: req.params.id, businessId: req.user.businessId } });
    if (!own) return res.status(404).json({ error: 'Presupuesto no encontrado' });
    const { clienteNombre, clienteDoc, items, validezDias, notas, status } = req.body || {};
    const data = {};
    if (clienteNombre !== undefined) data.clienteNombre = (clienteNombre || '').trim() || null;
    if (clienteDoc !== undefined) data.clienteDoc = (clienteDoc || '').trim() || null;
    if (notas !== undefined) data.notas = (notas || '').trim() || null;
    if (status !== undefined) { if (!ESTADOS.includes(status)) return res.status(400).json({ error: 'Estado inválido' }); data.status = status; }
    if (items !== undefined) { const its = normItems(items); data.itemsJson = JSON.stringify(its); data.total = calcTotal(its); }
    if (validezDias !== undefined) {
      const dias = (validezDias === '' || validezDias == null) ? null : parseInt(validezDias, 10);
      data.validezDias = dias; data.validoHasta = dias > 0 ? new Date((own.createdAt ? new Date(own.createdAt).getTime() : Date.now()) + dias * 86400000) : null;
    }
    const b = await prisma.budget.update({ where: { id: own.id }, data });
    const detalleEstado = (status !== undefined && status !== own.status) ? ` · estado: ${status}` : '';
    logAudit(req, { action: 'edito_presupuesto', entity: 'presupuesto', entityId: b.id, detail: `#${b.numero}${detalleEstado}` });
    res.json(b);
  } catch (e) { console.error('[budgets] update', e.message); res.status(500).json({ error: 'No se pudo actualizar' }); }
});

// DELETE /api/budgets/:id
router.delete('/:id', async (req, res) => {
  try {
    const own = await prisma.budget.findFirst({ where: { id: req.params.id, businessId: req.user.businessId } });
    if (!own) return res.status(404).json({ error: 'Presupuesto no encontrado' });
    await prisma.budget.delete({ where: { id: own.id } });
    logAudit(req, { action: 'elimino_presupuesto', entity: 'presupuesto', entityId: own.id, detail: `#${own.numero}` });
    res.json({ ok: true });
  } catch (e) { console.error('[budgets] delete', e.message); res.status(500).json({ error: 'No se pudo eliminar' }); }
});

// GET /api/budgets/:id/pdf
router.get('/:id/pdf', async (req, res) => {
  try {
    const b = await prisma.budget.findFirst({ where: { id: req.params.id, businessId: req.user.businessId } });
    if (!b) return res.status(404).json({ error: 'Presupuesto no encontrado' });
    const biz = await prisma.business.findUnique({ where: { id: req.user.businessId } });
    const logoPath = path.join(PHOTOS_DIR, `business-${req.user.businessId}.jpg`);
    const pdf = await budgetPdf.generateBudgetPdf(b, biz, { logoPath: fs.existsSync(logoPath) ? logoPath : null });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="presupuesto-${String(b.numero).padStart(6, '0')}.pdf"`);
    res.send(pdf);
  } catch (e) { console.error('[budgets] pdf', e.message); res.status(500).json({ error: 'Error al generar el PDF' }); }
});

// POST /api/budgets/:id/whatsapp
router.post('/:id/whatsapp', async (req, res) => {
  try {
    const b = await prisma.budget.findFirst({ where: { id: req.params.id, businessId: req.user.businessId } });
    if (!b) return res.status(404).json({ error: 'Presupuesto no encontrado' });
    if (!evo.isConfigured()) return res.status(400).json({ error: 'WhatsApp no está configurado en el sistema.' });
    let phone = String((req.body && req.body.phone) || '').replace(/\D/g, '');
    if (!phone && b.clientId) {
      const c = await prisma.client.findFirst({ where: { id: b.clientId, businessId: req.user.businessId }, select: { phone: true } });
      phone = String((c && c.phone) || '').replace(/\D/g, '');
    }
    if (!phone) return res.status(400).json({ error: 'No hay teléfono para enviar. Ingresá un número.' });
    const biz = await prisma.business.findUnique({ where: { id: req.user.businessId } });
    const logoPath = path.join(PHOTOS_DIR, `business-${req.user.businessId}.jpg`);
    const pdf = await budgetPdf.generateBudgetPdf(b, biz, { logoPath: fs.existsSync(logoPath) ? logoPath : null });
    const nombre = biz.fiscalRazonSocial || biz.name || 'Gestumio';
    const caption = `Presupuesto N° ${String(b.numero).padStart(6, '0')}\n${nombre}`;
    const filename = `presupuesto-${String(b.numero).padStart(6, '0')}.pdf`;
    await evo.sendDocument(req.user.businessId, phone, pdf, filename, caption);
    // al enviar, si estaba en borrador pasa a "enviado"
    if (b.status === 'borrador') await prisma.budget.update({ where: { id: b.id }, data: { status: 'enviado' } });
    logAudit(req, { action: 'envio_presupuesto', entity: 'presupuesto', entityId: b.id, detail: `#${String(b.numero).padStart(6, '0')} → ${phone}` });
    res.json({ ok: true });
  } catch (e) { console.error('[budgets] whatsapp', e.message); res.status(502).json({ error: 'No se pudo enviar por WhatsApp: ' + (e.message || 'error') }); }
});

module.exports = router;
