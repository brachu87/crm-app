// API para el bot de Telegram. Permite cargar y consultar datos del negocio.
// /link es público (canjea un código de vinculación). El resto requiere el token
// del bot (JWT via=telegram) validado por el authMiddleware global + botLinkCheck.
const express = require('express');
const prisma = require('../prisma');
const { consumirCodigo, firmarTokenBot } = require('../lib/telegramBot');
const { botLinkCheck } = require('../middleware/botAuth');

const router = express.Router();

function hoyAR() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}
function inicioMesAR() {
  const d = new Date(Date.now() - 3 * 3600 * 1000);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// ---------- POST /api/bot/link ----------  (público)
router.post('/link', async (req, res) => {
  try {
    const { code, telegramUserId, telegramName } = req.body || {};
    if (!code || !telegramUserId) return res.status(400).json({ error: 'Faltan datos de vinculación' });
    const info = consumirCodigo(code);
    if (!info) return res.status(400).json({ error: 'Código inválido o vencido. Generá uno nuevo en Gestumio → Ajustes → Telegram.' });

    const user = await prisma.user.findUnique({ where: { id: info.userId } });
    if (!user || user.businessId !== info.businessId) return res.status(400).json({ error: 'Usuario no encontrado' });
    const business = await prisma.business.findUnique({ where: { id: info.businessId }, select: { name: true } });

    await prisma.telegramLink.upsert({
      where: { telegramUserId: String(telegramUserId) },
      create: {
        telegramUserId: String(telegramUserId),
        telegramName: telegramName || null,
        businessId: info.businessId,
        userId: info.userId,
        revoked: false,
      },
      update: {
        telegramName: telegramName || null,
        businessId: info.businessId,
        userId: info.userId,
        revoked: false,
      },
    });

    const token = firmarTokenBot({ userId: user.id, businessId: user.businessId, role: user.role, telegramUserId });
    res.json({ token, businessName: business?.name || '', userName: user.name, role: user.role });
  } catch (e) {
    console.error('[bot/link]', e.message);
    res.status(500).json({ error: 'No se pudo vincular' });
  }
});

// ---- de acá para abajo, requiere vinculación activa ----
router.use(botLinkCheck);

// GET /api/bot/me
router.get('/me', async (req, res) => {
  const business = await prisma.business.findUnique({ where: { id: req.user.businessId }, select: { name: true } });
  const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { name: true, role: true } });
  res.json({ businessName: business?.name || '', userName: user?.name || '', role: user?.role || '' });
});

// POST /api/bot/expense  { amount, category, description?, paymentMethod?, date? }
router.post('/expense', async (req, res) => {
  try {
    const { amount, category, description, paymentMethod, date } = req.body || {};
    const _amt = parseFloat(String(amount).replace(',', '.'));
    if (isNaN(_amt) || _amt <= 0) return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    if (!category) return res.status(400).json({ error: 'Falta la categoría' });
    const exp = await prisma.expense.create({
      data: {
        amount: _amt,
        category: String(category).trim(),
        description: description || null,
        paymentMethod: paymentMethod || null,
        date: date ? new Date(date) : new Date(),
        businessId: req.user.businessId,
      },
    });
    res.status(201).json({ ok: true, id: exp.id, amount: exp.amount, category: exp.category });
  } catch (e) {
    console.error('[bot/expense]', e.message);
    res.status(500).json({ error: 'No se pudo cargar el gasto' });
  }
});

// POST /api/bot/income  { amount, description, category?, date?, clientName? }
router.post('/income', async (req, res) => {
  try {
    const { amount, description, category, date, clientName } = req.body || {};
    const _amt = parseFloat(String(amount).replace(',', '.'));
    if (isNaN(_amt) || _amt <= 0) return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    if (!description) return res.status(400).json({ error: 'Falta la descripción del cobro' });

    let clientId = null, clientMatched = null;
    if (clientName && String(clientName).trim()) {
      const c = await prisma.client.findFirst({
        where: { businessId: req.user.businessId, active: true, name: { contains: String(clientName).trim(), mode: 'insensitive' } },
        select: { id: true, name: true },
      });
      if (c) { clientId = c.id; clientMatched = c.name; }
    }
    const item = await prisma.manualIncome.create({
      data: {
        businessId: req.user.businessId,
        amount: _amt,
        description: String(description).trim(),
        category: (category && String(category).trim()) || 'Cobro',
        date: date || hoyAR(),
        clientId,
      },
    });
    res.status(201).json({ ok: true, id: item.id, amount: item.amount, clientMatched });
  } catch (e) {
    console.error('[bot/income]', e.message);
    res.status(500).json({ error: 'No se pudo registrar el cobro' });
  }
});

// POST /api/bot/client  { name, phone?, email?, dni?, cuit?, notes? }
router.post('/client', async (req, res) => {
  try {
    const { name, phone, email, dni, cuit, notes } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Falta el nombre del cliente' });
    if (dni && String(dni).trim()) {
      const dup = await prisma.client.findFirst({ where: { businessId: req.user.businessId, dni: String(dni).trim() } });
      if (dup) return res.status(409).json({ error: `Ya existe un cliente (${dup.name}) con ese DNI.` });
    }
    const client = await prisma.client.create({
      data: {
        name: String(name).trim(),
        phone: phone || null,
        email: email || null,
        dni: dni || null,
        cuit: cuit || null,
        notes: notes || null,
        active: true,
        businessId: req.user.businessId,
      },
    });
    res.status(201).json({ ok: true, id: client.id, name: client.name });
  } catch (e) {
    console.error('[bot/client]', e.message);
    res.status(500).json({ error: 'No se pudo crear el cliente' });
  }
});

// GET /api/bot/query?type=resumen|deuda|turnos&name=...
router.get('/query', async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const type = String(req.query.type || 'resumen');

    if (type === 'deuda') {
      const name = String(req.query.name || '').trim();
      if (!name) return res.status(400).json({ error: 'Decime el nombre del cliente' });
      const c = await prisma.client.findFirst({
        where: { businessId, active: true, name: { contains: name, mode: 'insensitive' } },
        select: { id: true, name: true },
      });
      if (!c) return res.json({ type, found: false, message: `No encontré un cliente que coincida con "${name}".` });
      const cuotas = await prisma.cuota.findMany({
        where: { paymentStatus: { in: ['pending', 'overdue'] }, enrollment: { active: true, clientId: c.id } },
        select: { amountDue: true, discount: true, paymentStatus: true },
      });
      let deuda = 0, vencidas = 0;
      for (const q of cuotas) { const net = Math.max(0, q.amountDue - (q.discount || 0)); deuda += net; if (q.paymentStatus === 'overdue') vencidas += net; }
      const appts = await prisma.appointment.aggregate({
        where: { businessId, clientId: c.id, status: 'completed', paymentStatus: 'pending' },
        _sum: { price: true },
      });
      deuda += appts._sum.price || 0;
      return res.json({ type, found: true, cliente: c.name, deudaTotal: deuda, vencido: vencidas, cuotasImpagas: cuotas.length });
    }

    if (type === 'turnos') {
      const hoy = hoyAR();
      const turnos = await prisma.appointment.findMany({
        where: { businessId, date: hoy, status: { not: 'cancelled' } },
        include: { client: { select: { name: true } }, service: { select: { name: true } }, employee: { select: { name: true } } },
        orderBy: { startTime: 'asc' },
      });
      return res.json({
        type, fecha: hoy, count: turnos.length,
        turnos: turnos.map(t => ({
          hora: t.startTime || '', cliente: t.client?.name || '', servicio: t.service?.name || t.description || '',
          empleado: t.employee?.name || '', estado: t.status, cobro: t.paymentStatus,
        })),
      });
    }

    // resumen (por defecto)
    const ini = inicioMesAR();
    const finMes = new Date(ini.getFullYear(), ini.getMonth() + 1, 0, 23, 59, 59);
    const iniStr = ini.toISOString().slice(0, 10);
    const [clientsCount, pagosMes, apptPagosMes, manualMes, gastosMes, openCuotas, apptPend] = await Promise.all([
      prisma.client.count({ where: { businessId, active: true } }),
      prisma.payment.aggregate({ where: { date: { gte: ini, lte: finMes }, cuota: { enrollment: { activity: { businessId } } } }, _sum: { amount: true } }),
      prisma.appointment.aggregate({ where: { businessId, paymentStatus: 'paid', paidAt: { gte: ini, lte: finMes } }, _sum: { price: true } }),
      prisma.manualIncome.aggregate({ where: { businessId, date: { gte: iniStr } }, _sum: { amount: true } }),
      prisma.expense.aggregate({ where: { businessId, date: { gte: ini, lte: finMes } }, _sum: { amount: true } }),
      prisma.cuota.findMany({ where: { paymentStatus: { in: ['pending', 'overdue'] }, enrollment: { active: true, client: { businessId, active: true } } }, select: { amountDue: true, discount: true, paymentStatus: true } }),
      prisma.appointment.aggregate({ where: { businessId, status: 'completed', paymentStatus: 'pending' }, _sum: { price: true } }),
    ]);
    let porCobrar = 0, vencido = 0;
    for (const q of openCuotas) { const net = Math.max(0, q.amountDue - (q.discount || 0)); porCobrar += net; if (q.paymentStatus === 'overdue') vencido += net; }
    porCobrar += apptPend._sum.price || 0;
    const ingresosMes = (pagosMes._sum.amount || 0) + (apptPagosMes._sum.price || 0) + (manualMes._sum.amount || 0);
    const gastos = gastosMes._sum.amount || 0;
    return res.json({
      type: 'resumen', clientesActivos: clientsCount,
      ingresosDelMes: ingresosMes, gastosDelMes: gastos, balanceDelMes: ingresosMes - gastos,
      porCobrar, vencido,
    });
  } catch (e) {
    console.error('[bot/query]', e.message);
    res.status(500).json({ error: 'No se pudo consultar' });
  }
});

module.exports = router;
