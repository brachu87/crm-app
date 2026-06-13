const express = require('express');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { scopedWhere } = require('../middleware/tenant');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const notes = await prisma.note.findMany({
      where: scopedWhere(req),
      orderBy: [{ completed: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(notes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener notas' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, content, dueDate, priority } = req.body;
    if (!title) return res.status(400).json({ error: 'El título es obligatorio' });
    const note = await prisma.note.create({
      data: {
        title,
        content: content || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: priority || 'normal',
        businessId: req.user.businessId,
      },
    });
    res.status(201).json(note);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear nota' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.note.findFirst({ where: scopedWhere(req, { id: req.params.id }) });
    if (!existing) return res.status(404).json({ error: 'Nota no encontrada' });
    const { title, content, dueDate, priority, completed } = req.body;
    const note = await prisma.note.update({
      where: { id: req.params.id },
      data: {
        title: title ?? existing.title,
        content: content !== undefined ? content || null : existing.content,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : existing.dueDate,
        priority: priority || existing.priority,
        completed: completed !== undefined ? completed : existing.completed,
      },
    });
    res.json(note);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al editar nota' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.note.findFirst({ where: scopedWhere(req, { id: req.params.id }) });
    if (!existing) return res.status(404).json({ error: 'Nota no encontrada' });
    await prisma.note.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar nota' });
  }
});

module.exports = router;
