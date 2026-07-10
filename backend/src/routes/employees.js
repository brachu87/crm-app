const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { scopedWhere } = require('../middleware/tenant');

const router = express.Router();
router.use(authMiddleware);

// GET /api/employees
router.get('/', async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      where: scopedWhere(req),
      include: {
        branch: { select: { id: true, name: true } },
        activityEmployees: { include: { activity: { select: { id: true, name: true } } } }
      },
      orderBy: { name: 'asc' },
    });
    res.json(employees);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener empleados' });
  }
});

// POST /api/employees

function parseImportDate(v) {
  if (v === undefined || v === null) return null;
  const str = String(v).trim(); if (!str) return null;
  if (/^\d+(\.\d+)?$/.test(str)) { const n = parseFloat(str); if (n > 20000 && n < 60000) { const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000); return isNaN(d) ? null : d; } }
  let m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) { let [, d, mo, y] = m; if (y.length === 2) y = String(+y <= 25 ? 2000 + +y : 1900 + +y); const dt = new Date(Date.UTC(+y, +mo - 1, +d, 12)); return isNaN(dt) ? null : dt; }
  m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) { const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)); return isNaN(dt) ? null : dt; }
  const dt = new Date(str); return isNaN(dt) ? null : dt;
}

// POST /api/employees/import
router.post('/import', async (req, res) => {
  try {
    const { employees } = req.body;
    if (!Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de empleados' });
    }
    const created = [], errors = [];
    for (const e of employees) {
      if (!e.name) { errors.push({ row: e, error: 'Sin nombre' }); continue; }
      try {
        const data = {
          name: e.name,
          role: e.role || 'Empleado',
          phone: e.phone || null,
          email: e.email || null,
          salary: e.salary ? parseFloat(String(e.salary).replace(/[^0-9.,-]/g, '').replace(',', '.')) : null,
          notes: e.notes || null,
          businessId: req.user.businessId,
        };
        const sd = parseImportDate(e.startDate);
        if (sd) data.startDate = sd;
        const emp = await prisma.employee.create({ data });
        created.push(emp);
      } catch (err) {
        errors.push({ row: e, error: err.message });
      }
    }
    res.status(201).json({ created: created.length, errors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al importar empleados' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, role, phone, email, salary, payType, payFrequency, startDate, notes, branchId } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
    if (!role) return res.status(400).json({ error: 'El rol es obligatorio' });

    const employee = await prisma.employee.create({
      data: {
        name,
        role,
        phone: phone || null,
        email: email || null,
        salary: salary ? parseFloat(salary) : null,
        payType: payType || 'hourly',
        payFrequency: payFrequency || 'monthly',
        startDate: startDate ? new Date(startDate) : new Date(),
        notes: notes || null,
        branchId: branchId || null,
        businessId: req.user.businessId,
      },
      include: { branch: { select: { id: true, name: true } } }
    });
    res.status(201).json(employee);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear empleado' });
  }
});

// PUT /api/employees/:id
router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.employee.findFirst({
      where: scopedWhere(req, { id: req.params.id }),
    });
    if (!existing) return res.status(404).json({ error: 'Empleado no encontrado' });

    const { name, role, phone, email, salary, payType, payFrequency, startDate, notes, active, branchId } = req.body;
    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: {
        name,
        role,
        phone: phone || null,
        email: email || null,
        salary: salary ? parseFloat(salary) : null,
        payType: payType || existing.payType,
        payFrequency: payFrequency || existing.payFrequency,
        startDate: startDate ? new Date(startDate) : undefined,
        notes: notes || null,
        active: active !== undefined ? active : existing.active,
        branchId: branchId !== undefined ? (branchId || null) : existing.branchId,
      },
      include: { branch: { select: { id: true, name: true } } }
    });
    res.json(employee);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al editar empleado' });
  }
});

// DELETE /api/employees/:id
router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.employee.findFirst({
      where: scopedWhere(req, { id: req.params.id }),
    });
    if (!existing) return res.status(404).json({ error: 'Empleado no encontrado' });

    await prisma.employee.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar empleado' });
  }
});

module.exports = router;
