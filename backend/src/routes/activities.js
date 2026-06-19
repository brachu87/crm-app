const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { scopedWhere } = require('../middleware/tenant');

const router = express.Router();

router.use(authMiddleware);

// GET /api/activities - lista actividades con cantidad de inscriptos
router.get('/', async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const activities = await prisma.activity.findMany({
      where: scopedWhere(req, includeInactive ? {} : { active: true }),
      include: {
        _count: { select: { enrollments: true } },
        branch: { select: { id: true, name: true } },
        activityEmployees: { include: { employee: { select: { id: true, name: true } } } }
      },
      orderBy: { name: 'asc' },
    });
    res.json(activities);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener actividades' });
  }
});

// GET /api/activities/:id - detalle + lista de clientes inscriptos con estado de pago
router.get('/:id', async (req, res) => {
  try {
    const activity = await prisma.activity.findFirst({
      where: scopedWhere(req, { id: req.params.id }),
      include: {
        enrollments: {
          include: {
            client: true,
            cuotas: { orderBy: { period: 'desc' }, take: 1 },
          },
          orderBy: { client: { name: 'asc' } },
        },
      },
    });

    if (!activity) return res.status(404).json({ error: 'Actividad no encontrada' });

    // Exponer estado/vencimiento de la última cuota en cada inscripción
    activity.enrollments = activity.enrollments.map((e) => {
      const current = e.cuotas[0] || null;
      return { ...e, paymentStatus: current?.paymentStatus || 'pending', dueDate: current?.dueDate || null };
    });

    res.json(activity);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener actividad' });
  }
});

// POST /api/activities - crear actividad
router.post('/', async (req, res) => {
  try {
    const { name, description, price, capacity, schedule, branchId } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Nombre y precio son obligatorios' });
    }

    const activity = await prisma.activity.create({
      data: {
        name,
        description,
        price,
        capacity,
        schedule,
        branchId: branchId || null,
        businessId: req.user.businessId,
      },
    });

    res.status(201).json(activity);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear actividad' });
  }
});

// PUT /api/activities/:id - editar actividad
router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.activity.findFirst({
      where: scopedWhere(req, { id: req.params.id }),
    });
    if (!existing) return res.status(404).json({ error: 'Actividad no encontrada' });

    const { name, description, price, capacity, schedule, active, branchId } = req.body;

    const activity = await prisma.activity.update({
      where: { id: req.params.id },
      data: { name, description, price, capacity, schedule, active,
              branchId: branchId !== undefined ? (branchId || null) : existing.branchId },
    });

    res.json(activity);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al editar actividad' });
  }
});

// DELETE /api/activities/:id
router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.activity.findFirst({
      where: scopedWhere(req, { id: req.params.id }),
    });
    if (!existing) return res.status(404).json({ error: 'Actividad no encontrada' });

    await prisma.activity.delete({ where: { id: req.params.id } });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar actividad' });
  }
});


// PUT /api/activities/:id/employees - reemplaza lista de empleados asignados
router.put('/:id/employees', async (req, res) => {
  try {
    const existing = await prisma.activity.findFirst({
      where: scopedWhere(req, { id: req.params.id }),
    });
    if (!existing) return res.status(404).json({ error: 'Actividad no encontrada' });

    const { employeeIds } = req.body; // array of employee ids
    if (!Array.isArray(employeeIds)) return res.status(400).json({ error: 'employeeIds debe ser un array' });

    // delete all then recreate
    await prisma.activityEmployee.deleteMany({ where: { activityId: req.params.id } });
    if (employeeIds.length > 0) {
      await prisma.activityEmployee.createMany({
        data: employeeIds.map(empId => ({ activityId: req.params.id, employeeId: empId }))
      });
    }
    const updated = await prisma.activity.findFirst({
      where: { id: req.params.id },
      include: { activityEmployees: { include: { employee: { select: { id: true, name: true } } } } }
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al asignar empleados' });
  }
});

module.exports = router;
