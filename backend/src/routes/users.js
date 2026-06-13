const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/users - list users of this business
router.get('/', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { businessId: req.user.businessId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// POST /api/users - create new user for this business (owner only)
router.post('/', async (req, res) => {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ error: 'Solo el owner puede crear usuarios' });
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: 'Ya existe un usuario con ese email' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role: role || 'staff',
        businessId: req.user.businessId,
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    res.status(201).json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PUT /api/users/:id - update role or name (owner only)
router.put('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ error: 'Sin permisos' });
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'No podés editar tu propio usuario desde acá' });

    const existing = await prisma.user.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId },
    });
    if (!existing) return res.status(404).json({ error: 'Usuario no encontrado' });

    const { name, role, password } = req.body;
    const data = {};
    if (name) data.name = name;
    if (role) data.role = role;
    if (password) data.password = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// DELETE /api/users/:id (owner only, can't delete self)
router.delete('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ error: 'Sin permisos' });
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'No podés eliminarte a vos mismo' });

    const existing = await prisma.user.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId },
    });
    if (!existing) return res.status(404).json({ error: 'Usuario no encontrado' });

    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

module.exports = router;
