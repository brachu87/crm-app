const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/auth');
const prisma = require('../prisma');
const { scopedWhere } = require('../middleware/tenant');

const router = express.Router();
router.use(authMiddleware);

const PHOTOS_DIR = process.env.PHOTOS_DIR ||
  (require('fs').existsSync('/data') ? '/data/photos' : path.join(__dirname, '../../../data/photos'));

// Ensure directory exists
if (!fs.existsSync(PHOTOS_DIR)) {
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PHOTOS_DIR),
  filename: (req, file, cb) => { const safeId = req.params.id.replace(/[^a-zA-Z0-9_-]/g, ''); cb(null, `${safeId}.jpg`); },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Solo se permiten imágenes'));
    }
    cb(null, true);
  },
});

// POST /api/clients/:id/photo
router.post('/:id/photo', upload.single('photo'), async (req, res) => {
  try {
    const client = await prisma.client.findFirst({
      where: scopedWhere(req, { id: req.params.id }),
    });
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
    res.json({ ok: true, url: `/api/clients/${req.params.id}/photo` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al subir foto' });
  }
});

// GET /api/clients/:id/photo
router.get('/:id/photo', async (req, res) => {
  try {
    const client = await prisma.client.findFirst({
      where: scopedWhere(req, { id: req.params.id }),
    });
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

    // Sanitize ID to prevent path traversal
    const safeId = req.params.id.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeId || safeId !== req.params.id) return res.status(400).json({ error: 'ID inválido' });
    const filePath = path.join(PHOTOS_DIR, `${safeId}.jpg`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Sin foto' });
    }
    res.sendFile(filePath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener foto' });
  }
});

module.exports = router;
