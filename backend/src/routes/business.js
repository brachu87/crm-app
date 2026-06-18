const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/auth');
const prisma = require('../prisma');

const router = express.Router();
router.use(authMiddleware);

const PHOTOS_DIR = process.env.PHOTOS_DIR || path.join(__dirname, '../../../data/photos');
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

module.exports = router;
