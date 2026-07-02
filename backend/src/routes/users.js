const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const USER_SELECT = { id: true, name: true, email: true, role: true, permissions: true, createdAt: true };

function parsePerms(u) {
  try { return { ...u, permissions: u.permissions ? JSON.parse(u.permissions) : null }; }
  catch { return { ...u, permissions: null }; }
}

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { businessId: req.user.businessId },
      select: USER_SELECT,
      orderBy: { createdAt: 'asc' },
    });
    res.json(users.map(parsePerms));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// POST /api/users - owner only, max 3 usuarios por negocio
router.post('/', async (req, res) => {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ error: 'Solo el owner puede crear usuarios' });

    const biz = await prisma.business.findUnique({ where: { id: req.user.businessId }, select: { extraUsers: true } });
    const limit = 3 + (biz?.extraUsers || 0);
    const count = await prisma.user.count({ where: { businessId: req.user.businessId } });
    if (count >= limit) return res.status(400).json({ error: `Límite alcanzado: máximo ${limit} usuario(s). Escribinos para habilitar más usuarios (+$20.000/mes c/u).` });

    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: 'Ya existe un usuario con ese email' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashed, role: role || 'staff', businessId: req.user.businessId },
      select: USER_SELECT,
    });
    res.status(201).json(parsePerms(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PUT /api/users/:id - owner o admin pueden editar
router.put('/:id', async (req, res) => {
  try {
    const canEdit = req.user.role === 'owner' || req.user.role === 'admin';
    if (!canEdit) return res.status(403).json({ error: 'Sin permisos' });
    if (req.params.id === req.user.id && req.body.role) return res.status(400).json({ error: 'No podés cambiar tu propio rol' });

    const existing = await prisma.user.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId },
    });
    if (!existing) return res.status(404).json({ error: 'Usuario no encontrado' });

    const { name, role, password, permissions } = req.body;
    const data = {};
    if (name) data.name = name;
    if (role && req.user.role === 'owner') data.role = role;
    if (password) data.password = await bcrypt.hash(password, 10);
    // permissions: array | null
    if (permissions !== undefined) {
      data.permissions = permissions === null ? null : JSON.stringify(permissions);
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: USER_SELECT,
    });
    res.json(parsePerms(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// DELETE /api/users/:id (owner only)
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
