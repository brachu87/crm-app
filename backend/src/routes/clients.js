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
            cuotas: {
              include: { payments: { orderBy: { date: 'desc' } } },
              orderBy: { period: 'desc' },
            },
          },
        },
      },
    });

    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

    // Exponer pagos aplanados y el estado/vencimiento de la última cuota,
    // manteniendo la forma que consume la ficha de cliente.
    client.enrollments = client.enrollments.map((e) => {
      const payments = e.cuotas
        .flatMap((c) => c.payments)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      const current = e.cuotas[0] || null; // la más reciente (period desc)
      return {
        ...e,
        payments,
        paymentStatus: current?.paymentStatus || 'pending',
        dueDate: current?.dueDate || null,
      };
    });

    res.json(client);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener cliente' });
  }
});

// POST /api/clients - crear cliente
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, notes, birthday, emergencyContact, emergencyPhone, medicalNotes, active, dni, responsableName, responsablePhone, globalDiscount } = req.body;
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
        dni: dni || null,
        responsableName: responsableName || null,
        responsablePhone: responsablePhone || null,
        globalDiscount: globalDiscount != null ? Number(globalDiscount) : 0,
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
    const { name, phone, email, notes, birthday, emergencyContact, emergencyPhone, medicalNotes, active, dni, responsableName, responsablePhone, globalDiscount } = req.body;
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: {
        name,
        phone: phone || null,
        email: email || null,
        notes: notes || null,
        dni: dni !== undefined ? (dni || null) : existing.dni,
        birthday: birthday !== undefined ? (birthday ? new Date(birthday) : null) : existing.birthday,
        emergencyContact: emergencyContact !== undefined ? emergencyContact || null : existing.emergencyContact,
        emergencyPhone: emergencyPhone !== undefined ? emergencyPhone || null : existing.emergencyPhone,
        medicalNotes: medicalNotes !== undefined ? medicalNotes || null : existing.medicalNotes,
        active: active !== undefined ? active : existing.active,
        responsableName: responsableName !== undefined ? (responsableName || null) : existing.responsableName,
        responsablePhone: responsablePhone !== undefined ? (responsablePhone || null) : existing.responsablePhone,
        globalDiscount: globalDiscount !== undefined ? Number(globalDiscount) : existing.globalDiscount,
      },
    });

    // Propagar el estado activo a las inscripciones: una baja no debe dejar
    // cuotas vivas en Cobranza/Dashboard; una re-alta restaura las membresías.
    if (active !== undefined && active !== existing.active) {
      await prisma.enrollment.updateMany({
        where: { clientId: req.params.id },
        data: { active },
      });
    }

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

// GET /api/clients/:id/notes
router.get('/:id/notes', async (req, res) => {
  try {
    const client = await prisma.client.findFirst({ where: scopedWhere(req, { id: req.params.id }) });
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
    const notes = await prisma.clientNote.findMany({
      where: { clientId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(notes);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al obtener notas' }); }
});

// POST /api/clients/:id/notes
router.post('/:id/notes', async (req, res) => {
  try {
    const client = await prisma.client.findFirst({ where: scopedWhere(req, { id: req.params.id }) });
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'El contenido es obligatorio' });
    const note = await prisma.clientNote.create({ data: { clientId: req.params.id, content: content.trim() } });
    res.status(201).json(note);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al crear nota' }); }
});

// DELETE /api/clients/:id/notes/:noteId
router.delete('/:id/notes/:noteId', async (req, res) => {
  try {
    const client = await prisma.client.findFirst({ where: scopedWhere(req, { id: req.params.id }) });
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
    await prisma.clientNote.delete({ where: { id: req.params.noteId } });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al eliminar nota' }); }
});

module.exports = router;
