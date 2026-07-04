const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/auth');
const prisma = require('../prisma');
const { buildBusinessZip } = require('../lib/exportBusiness');

const router = express.Router();
router.use(authMiddleware);

const PHOTOS_DIR = process.env.PHOTOS_DIR ||
  (fs.existsSync('/data') ? '/data/photos' : path.join(__dirname, '../../../data/photos'));
if (!fs.existsSync(PHOTOS_DIR)) fs.mkdirSync(PHOTOS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PHOTOS_DIR),
  filename: (req, file, cb) => cb(null, `business-${req.user.businessId}.jpg`),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Solo imágenes'));
    cb(null, true);
  },
});

// POST /api/business/logo
router.post('/logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
    res.json({ ok: true, url: `/api/business/logo` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al subir logo' });
  }
});

// GET /api/business/logo
router.get('/logo', async (req, res) => {
  try {
    const filePath = path.join(PHOTOS_DIR, `business-${req.user.businessId}.jpg`);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Sin logo' });
    res.sendFile(filePath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener logo' });
  }
});

// DELETE /api/business/logo
router.delete('/logo', async (req, res) => {
  try {
    const filePath = path.join(PHOTOS_DIR, `business-${req.user.businessId}.jpg`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar logo' });
  }
});


// GET /api/business/info
router.get('/info', async (req, res) => {
  try {
    const biz = await prisma.business.findUnique({ where: { id: req.user.businessId } });
    if (!biz) return res.status(404).json({ error: 'Negocio no encontrado' });
    res.json({
      id: biz.id,
      name: biz.name,
      category: biz.category,
      phone: biz.phone || '',
      cuit: biz.cuit || '',
      address: biz.address || '',
      email: biz.email || '',
      website: biz.website || '',
      instagram: biz.instagram || '',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener negocio' });
  }
});

// PUT /api/business
router.put('/', async (req, res) => {
  try {
    const { name, category, phone, cuit, address, email, website, instagram } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    const clean = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim());
    const data = { name: name.trim() };
    if (category) data.category = category;
    if (phone !== undefined)     data.phone = clean(phone);
    if (cuit !== undefined)      data.cuit = clean(cuit);
    if (address !== undefined)   data.address = clean(address);
    if (email !== undefined)     data.email = clean(email);
    if (website !== undefined)   data.website = clean(website);
    if (instagram !== undefined) data.instagram = clean(instagram);
    const biz = await prisma.business.update({
      where: { id: req.user.businessId },
      data,
    });
    res.json({
      id: biz.id,
      name: biz.name,
      category: biz.category,
      phone: biz.phone || '',
      cuit: biz.cuit || '',
      address: biz.address || '',
      email: biz.email || '',
      website: biz.website || '',
      instagram: biz.instagram || '',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar negocio' });
  }
});

// PUT /api/business/modules — guardar módulos habilitados (owner only)
router.put('/modules', authMiddleware, async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Solo el propietario puede cambiar esto' });
  const { enabledModules } = req.body; // array de strings
  if (!Array.isArray(enabledModules)) return res.status(400).json({ error: 'enabledModules debe ser un array' });
  try {
    const json = JSON.stringify(enabledModules);
    await prisma.$executeRawUnsafe(
      `UPDATE "Business" SET "enabledModules" = ? WHERE id = ?`,
      json, req.user.businessId
    );
    res.json({ ok: true, enabledModules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/business/modules
router.get('/modules', authMiddleware, async (req, res) => {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT "enabledModules" FROM "Business" WHERE id = ? LIMIT 1`,
      req.user.businessId
    );
    const raw = rows?.[0]?.enabledModules;
    const modules = raw ? JSON.parse(raw) : null;
    res.json({ enabledModules: modules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/business/export — descarga TODOS los datos del negocio en un ZIP (CSV por tabla)
router.get('/export', async (req, res) => {
  try {
    const buf = await buildBusinessZip(req.user.businessId);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="gestumio-datos.zip"');
    res.send(buf);
  } catch (e) { console.error('[business-export]', e.message); res.status(500).json({ error: 'No se pudo exportar' }); }
});

module.exports = router;


