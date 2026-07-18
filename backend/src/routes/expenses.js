const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { scopedWhere } = require('../middleware/tenant');

const router = express.Router();
const validate = require('../lib/validate');
const schemas = require('../schemas');
const multer = require('multer');
const { PDFParse } = require('pdf-parse');
const invoiceScan = require('../lib/invoiceScan');
const scanUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

function _normFecha(v) {
  const s = String(v || '').trim(); if (!s) return null;
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) { let [, d, mo, y] = m; if (y.length === 2) y = '20' + y; return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`; }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0];
  return null;
}
function _num(v) {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/[^0-9.,-]/g, '').replace(/\.(?=.*\.)/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}
router.use(authMiddleware);

function parseExpDate(s) {
  s = String(s || '').trim();
  if (!s) return new Date();
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) { let [, d, mo, y] = m; if (y.length === 2) y = '20' + y; const dt = new Date(Number(y), Number(mo) - 1, Number(d)); return isNaN(dt) ? new Date() : dt; }
  const dt = new Date(s);
  return isNaN(dt) ? new Date() : dt;
}

// POST /api/expenses/import  — alta masiva desde Excel/CSV
router.post('/import', async (req, res) => {
  try {
    const { expenses } = req.body;
    if (!Array.isArray(expenses) || expenses.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de gastos' });
    }
    const created = [];
    const errors = [];
    for (const e of expenses) {
      if (!e.category) { errors.push({ row: e, error: 'Sin categoría' }); continue; }
      const amount = parseFloat(String(e.amount).replace(/[^0-9.,-]/g, '').replace(/\.(?=.*\.)/g, '').replace(',', '.'));
      if (!amount || isNaN(amount)) { errors.push({ row: e, error: 'Monto inválido' }); continue; }
      try {
        let supplierId = null;
        if (e.supplier && String(e.supplier).trim()) {
          const sup = await prisma.supplier.findFirst({
            where: { businessId: req.user.businessId, name: { equals: String(e.supplier).trim(), mode: 'insensitive' } },
            select: { id: true },
          });
          if (sup) supplierId = sup.id;
        }
        const exp = await prisma.expense.create({
          data: {
            amount,
            category: e.category,
            description: e.description || null,
            paymentMethod: e.paymentMethod || null,
            date: parseExpDate(e.date),
            supplierId,
            businessId: req.user.businessId,
          },
        });
        created.push(exp);
      } catch (er) {
        errors.push({ row: e, error: er.message });
      }
    }
    res.status(201).json({ created: created.length, errors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al importar gastos' });
  }
});

// GET /api/expenses
router.get('/', async (req, res) => {
  try {
    const where = scopedWhere(req);
    if (req.query.supplierId) where.supplierId = req.query.supplierId;
    if (req.query.from || req.query.to) {
      where.date = {};
      if (req.query.from) where.date.gte = new Date(req.query.from);
      if (req.query.to)   where.date.lte = new Date(req.query.to + 'T23:59:59');
    }
    const expenses = await prisma.expense.findMany({
      where,
      include: { supplier: { select: { id: true, name: true } } },
      orderBy: { date: 'desc' },
    });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener gastos' });
  }
});

// POST /api/expenses
router.post('/', validate(schemas.expenseCreate), async (req, res) => {
  try {
    const { amount, date, category, description, paymentMethod, supplierId } = req.body;
    if (!amount) return res.status(400).json({ error: 'El monto es obligatorio' });
    const _amt = parseFloat(amount);
    if (isNaN(_amt) || _amt <= 0) return res.status(400).json({ error: 'El monto debe ser un número mayor a 0' });
    if (!category) return res.status(400).json({ error: 'La categoría es obligatoria' });

    // Verify supplier belongs to this business
    if (supplierId) {
      const sup = await prisma.supplier.findFirst({ where: { id: supplierId, businessId: req.user.businessId } });
      if (!sup) return res.status(400).json({ error: 'Proveedor no encontrado' });
    }

    const expense = await prisma.expense.create({
      data: {
        amount: _amt,
        date: date ? new Date(date) : new Date(),
        category,
        description: description || null,
        paymentMethod: paymentMethod || null,
        supplierId: supplierId || null,
        businessId: req.user.businessId,
      },
      include: { supplier: { select: { id: true, name: true } } },
    });
    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear gasto' });
  }
});

// PUT /api/expenses/:id
// POST /api/expenses/scan — lee una factura de compra (foto o PDF) con IA y devuelve los datos
router.post('/scan', scanUpload.single('file'), async (req, res) => {
  try {
    if (!process.env.GROQ_API_KEY) return res.status(400).json({ error: 'El escaneo con IA no está configurado.' });
    const f = req.file;
    if (!f) return res.status(400).json({ error: 'Subí una imagen o PDF de la factura.' });
    const mt = f.mimetype || '';
    let data;
    if (mt.startsWith('image/')) {
      const dataUrl = `data:${mt};base64,` + f.buffer.toString('base64');
      data = await invoiceScan.extractFromImage(dataUrl);
    } else if (mt === 'application/pdf' || (f.originalname || '').toLowerCase().endsWith('.pdf')) {
      let text = '';
      try { const parser = new PDFParse({ data: f.buffer }); const r = await parser.getText(); text = (r.text || '').trim(); } catch (e) { text = ''; }
      if (text.length < 25) return res.status(422).json({ error: 'Este PDF parece escaneado (sin texto). Subí una foto de la factura.' });
      data = await invoiceScan.extractFromText(text);
    } else {
      return res.status(400).json({ error: 'Formato no soportado. Subí una imagen (JPG/PNG) o un PDF.' });
    }

    const cuit = String(data.cuit || '').replace(/\D/g, '');
    const out = {
      proveedor: data.proveedor || null,
      cuit: cuit || null,
      fecha: _normFecha(data.fecha),
      tipo: data.tipo || null,
      numero: data.numero || null,
      neto: _num(data.neto),
      iva: _num(data.iva),
      total: _num(data.total),
      categoria: data.categoria || null,
    };

    let supplier = null;
    if (cuit) supplier = await prisma.supplier.findFirst({ where: { businessId: req.user.businessId, cuit }, select: { id: true, name: true } });
    if (!supplier && out.proveedor) supplier = await prisma.supplier.findFirst({ where: { businessId: req.user.businessId, name: { equals: out.proveedor, mode: 'insensitive' } }, select: { id: true, name: true } });
    out.supplierId = supplier ? supplier.id : null;
    out.supplierName = supplier ? supplier.name : null;

    res.json(out);
  } catch (e) {
    console.error('[expenses/scan]', e.message);
    res.status(500).json({ error: 'No se pudieron leer los datos de la factura. Probá con una foto más nítida o cargala a mano.' });
  }
});

router.put('/:id', validate(schemas.expenseUpdate), async (req, res) => {
  try {
    const existing = await prisma.expense.findFirst({ where: scopedWhere(req, { id: req.params.id }) });
    if (!existing) return res.status(404).json({ error: 'Gasto no encontrado' });

    const { amount, date, category, description, paymentMethod, supplierId } = req.body;

    if (amount !== undefined) {
      const _amt = parseFloat(amount);
      if (isNaN(_amt) || _amt <= 0) return res.status(400).json({ error: 'El monto debe ser un número mayor a 0' });
    }

    if (supplierId) {
      const sup = await prisma.supplier.findFirst({ where: { id: supplierId, businessId: req.user.businessId } });
      if (!sup) return res.status(400).json({ error: 'Proveedor no encontrado' });
    }

    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: {
        amount:        amount        !== undefined ? parseFloat(amount)       : existing.amount,
        date:          date          !== undefined ? new Date(date)           : existing.date,
        category:      category      !== undefined ? category                 : existing.category,
        description:   description   !== undefined ? description || null      : existing.description,
        paymentMethod: paymentMethod !== undefined ? paymentMethod || null    : existing.paymentMethod,
        supplierId:    supplierId    !== undefined ? supplierId || null       : existing.supplierId,
      },
      include: { supplier: { select: { id: true, name: true } } },
    });
    res.json(expense);
  } catch (err) {
    res.status(500).json({ error: 'Error al editar gasto' });
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.expense.findFirst({ where: scopedWhere(req, { id: req.params.id }) });
    if (!existing) return res.status(404).json({ error: 'Gasto no encontrado' });
    await prisma.expense.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar gasto' });
  }
});

module.exports = router;
