const express = require('express');
const prisma = require('../prisma');
const { authMiddleware } = require('./auth');

const router = express.Router();

// GET /api/manual-income
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { from, to, category } = req.query;
    const where = { businessId: req.user.businessId };
    if (from) where.date = { ...(where.date || {}), gte: from };
    if (to)   where.date = { ...(where.date || {}), lte: to };
    if (category) where.category = category;

    const items = await prisma.manualIncome.findMany({
      where,
      orderBy: { date: 'desc' },
    });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/manual-income
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { amount, description, category, date } = req.body;
    if (!amount || !description || !date) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    const item = await prisma.manualIncome.create({
      data: {
        businessId: req.user.businessId,
        amount: parseFloat(amount),
        description,
        category: category?.trim() || 'Otro',
        date,
      },
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/manual-income/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const item = await prisma.manualIncome.findUnique({ where: { id: req.params.id } });
    if (!item || item.businessId !== req.user.businessId) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    await prisma.manualIncome.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
