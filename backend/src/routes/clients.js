const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { scopedWhere } = require('../middleware/tenant');

const router = express.Router();

router.use(authMiddleware);

// GET /api/clients - lista todos los clientes del negocio
router.get('/', async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const clients = await prisma.client.findMany({
      where: scopedWhere(req, includeInactive ? {} : { active: true }),
      orderBy: { name: 'asc' },
    });
    res.json(clients);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

// GET /api/clients/:id - ficha de cliente con sus inscripciones y pagos
router.get('/:id', async (req, res) => {
  try {
    const client = await prisma.client.findFirst({
      where: scopedWhere(req, { id: req.params.id }),
      include: {
        enrollments: {
          include: {
            activity: true,
            payments: { orderBy: { date: 'desc' } },
          },
        },
      },
    });

    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

    res.json(client);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener cliente' });
  }
});

// POST /api/clients - crear cliente
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, notes, birthday, emergencyContact, emergencyPhone, medicalNotes, active } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const client = await prisma.client.create({
      data: {
        name,
        phone: phone || null,
        email: email || null,
        notes: notes || null,
        birthday: birthday ? new Date(birthday) : null,
        emergencyContact: emergencyContact || null,
        emergencyPhone: emergencyPhone || null,
        medicalNotes: medicalNotes || null,
        businessId: req.user.businessId,
      },
    });
    res.status(201).json(client);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear cliente' });
  }
});

// POST /api/clients/import
router.post('/import', async (req, res) => {
  try {
    const { clients } = req.body;
    if (!Array.isArray(clients) || clients.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de clientes' });
    }
    const created = [];
    const errors = [];
    for (const c of clients) {
      if (!c.name) { errors.push({ row: c, error: 'Sin nombre' }); continue; }
      try {
        const client = await prisma.client.create({
          data: { name: c.name, phone: c.phone || null, email: c.email || null, notes: c.notes || null, businessId: req.user.businessId },
        });
        created.push(client);
      } catch (e) {
        errors.push({ row: c, error: e.message });
      }
    }
    res.status(201).json({ created: created.length, errors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al importar clientes' });
  }
});

// PUT /api/clients/:id - editar cliente
router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.client.findFirst({
      where: scopedWhere(req, { id: req.params.id }),
    });
    if (!existing) return res.status(404).json({ error: 'Cliente no encontrado' });
    const { name, phone, email, notes, birthday, emergencyContact, emergencyPhone, medicalNotes, active } = req.body;
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: {
        name,
        phone: phone || null,
        email: email || null,
        notes: notes || null,
        birthday: birthday !== undefined ? (birthday ? new Date(birthday) : null) : existing.birthday,
        emergencyContact: emergencyContact !== undefined ? emergencyContact || null : existing.emergencyContact,
        emergencyPhone: emergencyPhone !== undefined ? emergencyPhone || null : existing.emergencyPhone,
        medicalNotes: medicalNotes !== undefined ? medicalNotes || null : existing.medicalNotes,
      },
    });
    res.json(client);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al editar cliente' });
  }
});

// DELETE /api/clients/:id
router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.client.findFirst({
      where: scopedWhere(req, { id: req.params.id }),
    });
    if (!existing) return res.status(404).json({ error: 'Cliente no encontrado' });

    await prisma.client.delete({ where: { id: req.params.id } });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar cliente' });
  }
});

module.exports = router;
