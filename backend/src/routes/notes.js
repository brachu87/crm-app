const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

// GET /notes
router.get('/', async (req, res) => {
  try {
    const notes = await prisma.note.findMany({
      where: { businessId: req.user.businessId },
      orderBy: [
        { completed: 'asc' },
        { startAt: 'asc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });
    res.json(notes);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /notes
router.post('/', async (req, res) => {
  try {
    const { title, content, dueDate, priority, startAt, endAt, allDay, color } = req.body;
    if (!title) return res.status(400).json({ error: 'title requerido' });
    const note = await prisma.note.create({
      data: {
        title,
        content: content || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: priority || 'normal',
        startAt: startAt ? new Date(startAt) : null,
        endAt: endAt ? new Date(endAt) : null,
        allDay: allDay !== undefined ? Boolean(allDay) : true,
        color: color || 'blue',
        businessId: req.user.businessId,
      },
    });
    res.status(201).json(note);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /notes/:id
router.put('/:id', async (req, res) => {
  try {
    const { title, content, dueDate, completed, priority, startAt, endAt, allDay, color } = req.body;
    const data = {};
    if (title !== undefined) data.title = title;
    if (content !== undefined) data.content = content;
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
    if (completed !== undefined) data.completed = Boolean(completed);
    if (priority !== undefined) data.priority = priority;
    if (startAt !== undefined) data.startAt = startAt ? new Date(startAt) : null;
    if (endAt !== undefined) data.endAt = endAt ? new Date(endAt) : null;
    if (allDay !== undefined) data.allDay = Boolean(allDay);
    if (color !== undefined) data.color = color;
    const note = await prisma.note.update({
      where: { id: req.params.id },
      data,
    });
    res.json(note);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /notes/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.note.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
