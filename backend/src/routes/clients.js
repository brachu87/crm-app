const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { scopedWhere } = require('../middleware/tenant');

const router = express.Router();
const validate = require('../lib/validate');
const schemas = require('../schemas');

router.use(authMiddleware);

// Genera un número de socio único global (6 dígitos), reintentando ante colisión.
async function generateMemberNumber() {
  for (let i = 0; i < 12; i++) {
    const n = String(Math.floor(100000 + Math.random() * 900000));
    const exists = await prisma.client.findUnique({ where: { memberNumber: n }, select: { id: true } });
    if (!exists) return n;
  }
  // fallback muy improbable
  return String(Date.now()).slice(-8);
}

// GET /api/clients - lista todos los clientes del negocio
router.get('/', async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const clients = await prisma.client.findMany({
      where: scopedWhere(req, includeInactive ? {} : { active: true }),
      orderBy: { name: 'asc' },
      include: {
        enrollments: {
          where: { active: true },
          include: {
            cuotas: {
              where: { paymentStatus: { in: ['pending', 'overdue'] } },
              select: { amountDue: true, discount: true },
            },
          },
        },
        appointments: {
          where: { status: 'completed', paymentStatus: 'pending' },
          select: { price: true },
        },
      },
    });

    // Calcular saldo pendiente por cliente y limpiar datos pesados
    const result = clients.map((c) => {
      const cuotaDebt = c.enrollments
        .flatMap((e) => e.cuotas)
        .reduce((sum, q) => sum + Math.max(0, (q.amountDue || 0) - (q.discount || 0)), 0);
      const apptDebt = c.appointments
        .reduce((sum, a) => sum + (a.price || 0), 0);
      const { enrollments, appointments, ...rest } = c;
      return { ...rest, saldo: Math.round(cuotaDebt + apptDebt) };
    });

    res.json(result);
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

    // Asignar número de socio si todavía no tiene (para clientes viejos)
    if (!client.memberNumber) {
      try {
        const mn = await generateMemberNumber();
        await prisma.client.update({ where: { id: client.id }, data: { memberNumber: mn } });
        client.memberNumber = mn;
      } catch (_) {}
    }

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
router.post('/', validate(schemas.clientCreate), async (req, res) => {
  try {
    const { name, phone, email, notes, birthday, emergencyContact, emergencyPhone, medicalNotes, active, dni, cuit, responsableName, responsablePhone, globalDiscount } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });

    // Evitar clientes duplicados en el mismo negocio por DNI.
    // (El email NO se bloquea: las familias suelen compartir el mismo correo.)
    if (dni && String(dni).trim()) {
      const existing = await prisma.client.findFirst({
        where: { businessId: req.user.businessId, dni: String(dni).trim() },
      });
      if (existing) {
        return res.status(409).json({ error: `Ya existe un cliente (${existing.name}) con el DNI ${dni}.` });
      }
    }

    const memberNumber = await generateMemberNumber();
    const client = await prisma.client.create({
      data: {
        name,
        memberNumber,
        phone: phone || null,
        email: email || null,
        notes: notes || null,
        birthday: birthday ? new Date(birthday) : null,
        emergencyContact: emergencyContact || null,
        emergencyPhone: emergencyPhone || null,
        medicalNotes: medicalNotes || null,
        dni: dni || null,
        cuit: cuit || null,
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

function parseImportDate(v) {
  if (v === undefined || v === null) return null;
  const str = String(v).trim();
  if (!str) return null;
  // Serial de Excel (número)
  if (/^\d+(\.\d+)?$/.test(str)) {
    const n = parseFloat(str);
    if (n > 20000 && n < 60000) { const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000); return isNaN(d) ? null : d; }
  }
  let m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/); // DD/MM/AAAA
  if (m) { let [, d, mo, y] = m; if (y.length === 2) y = String(+y <= 25 ? 2000 + +y : 1900 + +y); const dt = new Date(Date.UTC(+y, +mo - 1, +d, 12)); return isNaN(dt) ? null : dt; }
  m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); // AAAA-MM-DD
  if (m) { const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)); return isNaN(dt) ? null : dt; }
  const dt = new Date(str);
  return isNaN(dt) ? null : dt;
}

function parseDiscount(v) {
  const n = parseFloat(String(v ?? '').replace('%', '').replace(',', '.').trim());
  return isNaN(n) ? 0 : Math.max(0, Math.min(100, n));
}

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
          data: {
            name: c.name,
            phone: c.phone || null,
            email: c.email || null,
            dni: c.dni || null,
            cuit: c.cuit || null,
            notes: c.notes || null,
            medicalNotes: c.medicalNotes || null,
            emergencyContact: c.emergencyContact || null,
            emergencyPhone: c.emergencyPhone || null,
            responsableName: c.responsableName || null,
            responsablePhone: c.responsablePhone || null,
            birthday: parseImportDate(c.birthday),
            globalDiscount: parseDiscount(c.globalDiscount),
            businessId: req.user.businessId,
          },
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
    const { name, phone, email, notes, birthday, emergencyContact, emergencyPhone, medicalNotes, active, dni, cuit, responsableName, responsablePhone, globalDiscount } = req.body;
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: {
        name,
        phone: phone || null,
        email: email || null,
        notes: notes || null,
        dni: dni !== undefined ? (dni || null) : existing.dni,
        cuit: cuit !== undefined ? (cuit || null) : existing.cuit,
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
