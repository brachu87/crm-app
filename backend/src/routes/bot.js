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

async function buscarCliente(businessId, nombre) {
  if (!nombre || !String(nombre).trim()) return null;
  return prisma.client.findFirst({
    where: { businessId, active: true, name: { contains: String(nombre).trim(), mode: 'insensitive' } },
    select: { id: true, name: true },
  });
}
async function buscarServicio(businessId, nombre) {
  if (!nombre || !String(nombre).trim()) return null;
  return prisma.service.findFirst({
    where: { businessId, name: { contains: String(nombre).trim(), mode: 'insensitive' } },
  });
}
async function buscarEmpleado(businessId, nombre) {
  if (!nombre || !String(nombre).trim()) return null;
  return prisma.employee.findFirst({
    where: { businessId, active: true, name: { contains: String(nombre).trim(), mode: 'insensitive' } },
  });
}
function minutosEntre(a, b) {
  const p = (x) => { const [h, m] = String(x || '0:0').split(':').map(n => parseInt(n, 10) || 0); return h * 60 + m; };
  return Math.max(30, p(b) - p(a));
}
function sumarMin(hhmm, min) {
  const [h, m] = String(hhmm || '0:0').split(':').map(n => parseInt(n, 10) || 0);
  const t = h * 60 + m + (min || 0);
  const hh = Math.floor((t % (24 * 60)) / 60), mm = t % 60;
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
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
    const business = await prisma.business.findUnique({ where: { id: info.businessId }, select: { name: true, telegramBotEnabled: true } });
    if (!business || business.telegramBotEnabled !== true) return res.status(403).json({ error: 'El bot de Telegram no está habilitado para este negocio. Pedí que lo activen desde Gestumio.' });

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
      const hoy = String(req.query.date || '').trim() || hoyAR();
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

// POST /api/bot/appointment  — crear turno (con servicio) o trabajo rápido
router.post('/appointment', async (req, res) => {
  try {
    const { clientName, serviceName, date, startTime, endTime, employeeName, price, description } = req.body || {};
    if (!clientName) return res.status(400).json({ error: 'Decime el cliente del turno' });
    if (!date) return res.status(400).json({ error: 'Falta la fecha del turno (YYYY-MM-DD)' });
    const cli = await buscarCliente(req.user.businessId, clientName);
    if (!cli) return res.status(404).json({ error: `No encontré un cliente que coincida con "${clientName}".` });
    const emp = employeeName ? await buscarEmpleado(req.user.businessId, employeeName) : null;

    const svc = serviceName ? await buscarServicio(req.user.businessId, serviceName) : null;
    if (serviceName && !svc) return res.status(404).json({ error: `No encontré el servicio "${serviceName}".` });

    if (svc) {
      if (!startTime) return res.status(400).json({ error: 'Falta la hora de inicio (ej: 15:00)' });
      const fin = endTime || sumarMin(startTime, svc.duration || 60);
      const overlap = await prisma.appointment.findFirst({
        where: { businessId: req.user.businessId, clientId: cli.id, date, isQuickWork: false, status: { not: 'cancelled' }, startTime: { lt: fin }, endTime: { gt: startTime } },
      });
      if (overlap) return res.status(409).json({ error: `El cliente ya tiene un turno de ${overlap.startTime} a ${overlap.endTime} ese día.` });
      const a = await prisma.appointment.create({
        data: {
          businessId: req.user.businessId, serviceId: svc.id, clientId: cli.id,
          employeeId: emp?.id || null, date, startTime, endTime: fin,
          price: price != null ? parseFloat(price) : (svc.price || 0), isQuickWork: false,
        },
      });
      return res.status(201).json({ ok: true, id: a.id, cliente: cli.name, servicio: svc.name, fecha: date, hora: startTime, entity: 'appointment' });
    }

    // trabajo rápido / turno simple
    const a = await prisma.appointment.create({
      data: {
        businessId: req.user.businessId, clientId: cli.id, employeeId: emp?.id || null,
        description: description || null, date, startTime: startTime || '', endTime: endTime || '',
        price: parseFloat(price) || 0, isQuickWork: true, status: 'completed', paymentStatus: 'pending',
      },
    });
    res.status(201).json({ ok: true, id: a.id, cliente: cli.name, fecha: date, entity: 'appointment' });
  } catch (e) {
    console.error('[bot/appointment]', e.message);
    res.status(500).json({ error: 'No se pudo crear el turno' });
  }
});

// POST /api/bot/appointment/reschedule  — mover un turno
router.post('/appointment/reschedule', async (req, res) => {
  try {
    const { clientName, fromDate, newDate, newTime } = req.body || {};
    const cli = await buscarCliente(req.user.businessId, clientName);
    if (!cli) return res.status(404).json({ error: `No encontré al cliente "${clientName}".` });
    const where = { businessId: req.user.businessId, clientId: cli.id, status: { not: 'cancelled' } };
    if (fromDate) where.date = String(fromDate).trim();
    const turnos = await prisma.appointment.findMany({ where, orderBy: [{ date: 'asc' }, { startTime: 'asc' }] });
    if (turnos.length === 0) return res.status(404).json({ error: `No encontré turnos de ${cli.name}${fromDate ? ' para esa fecha' : ''}.` });
    if (turnos.length > 1 && !fromDate) return res.status(409).json({ error: `${cli.name} tiene varios turnos. Decime de qué fecha lo querés mover.` });
    const t = turnos[0];
    const data = {};
    if (newDate) data.date = String(newDate).trim();
    if (newTime) { const dur = (t.endTime && t.startTime) ? undefined : 60; data.startTime = newTime; data.endTime = t.endTime && t.startTime ? sumarMin(newTime, minutosEntre(t.startTime, t.endTime)) : sumarMin(newTime, dur); }
    const upd = await prisma.appointment.update({ where: { id: t.id }, data });
    res.json({ ok: true, id: upd.id, cliente: cli.name, fecha: upd.date, hora: upd.startTime });
  } catch (e) {
    console.error('[bot/reschedule]', e.message);
    res.status(500).json({ error: 'No se pudo reprogramar el turno' });
  }
});

// POST /api/bot/appointment/cancel  — cancelar un turno
router.post('/appointment/cancel', async (req, res) => {
  try {
    const { clientName, date } = req.body || {};
    const cli = await buscarCliente(req.user.businessId, clientName);
    if (!cli) return res.status(404).json({ error: `No encontré al cliente "${clientName}".` });
    const where = { businessId: req.user.businessId, clientId: cli.id, status: { not: 'cancelled' } };
    if (date) where.date = String(date).trim();
    const turnos = await prisma.appointment.findMany({ where, orderBy: [{ date: 'asc' }, { startTime: 'asc' }] });
    if (turnos.length === 0) return res.status(404).json({ error: `No encontré turnos activos de ${cli.name}${date ? ' para esa fecha' : ''}.` });
    if (turnos.length > 1 && !date) return res.status(409).json({ error: `${cli.name} tiene varios turnos. Decime la fecha del que querés cancelar.` });
    const t = turnos[0];
    await prisma.appointment.update({ where: { id: t.id }, data: { status: 'cancelled' } });
    res.json({ ok: true, cliente: cli.name, fecha: t.date, hora: t.startTime });
  } catch (e) {
    console.error('[bot/cancel]', e.message);
    res.status(500).json({ error: 'No se pudo cancelar el turno' });
  }
});

// POST /api/bot/cobrar-cuota  — paga la cuota pendiente más vieja de un cliente
router.post('/cobrar-cuota', async (req, res) => {
  try {
    const { clientName, amount, method } = req.body || {};
    const cli = await buscarCliente(req.user.businessId, clientName);
    if (!cli) return res.status(404).json({ error: `No encontré al cliente "${clientName}".` });
    const cuota = await prisma.cuota.findFirst({
      where: { paymentStatus: { in: ['pending', 'overdue'] }, enrollment: { active: true, clientId: cli.id } },
      include: { enrollment: { include: { activity: true } } },
      orderBy: [{ dueDate: 'asc' }, { period: 'asc' }],
    });
    if (!cuota) return res.json({ ok: false, error: `${cli.name} no tiene cuotas pendientes.` });
    const neto = Math.max(0, cuota.amountDue - (cuota.discount || 0));
    const monto = amount != null ? parseFloat(String(amount).replace(',', '.')) : neto;
    await prisma.payment.create({ data: { cuotaId: cuota.id, amount: monto, method: method || null } });
    const pagos = await prisma.payment.aggregate({ where: { cuotaId: cuota.id }, _sum: { amount: true } });
    const totalPagado = pagos._sum.amount || 0;
    const nuevoEstado = totalPagado >= neto ? 'paid' : cuota.paymentStatus;
    if (nuevoEstado !== cuota.paymentStatus) await prisma.cuota.update({ where: { id: cuota.id }, data: { paymentStatus: 'paid' } });
    res.json({ ok: true, cliente: cli.name, actividad: cuota.enrollment?.activity?.name || '', periodo: cuota.period, cobrado: monto, saldado: totalPagado >= neto });
  } catch (e) {
    console.error('[bot/cobrar-cuota]', e.message);
    res.status(500).json({ error: 'No se pudo registrar el cobro de la cuota' });
  }
});

// GET /api/bot/liquidacion?empleado=&desde=&hasta=  — calcula (preview) la liquidación
router.get('/liquidacion', async (req, res) => {
  try {
    const emp = await buscarEmpleado(req.user.businessId, req.query.empleado);
    if (!emp) return res.status(404).json({ error: `No encontré al empleado "${req.query.empleado || ''}".` });
    const ini = inicioMesAR();
    const desde = req.query.desde ? new Date(String(req.query.desde)) : ini;
    const hasta = req.query.hasta ? new Date(String(req.query.hasta)) : new Date(ini.getFullYear(), ini.getMonth() + 1, 0);
    const att = await prisma.attendance.findMany({ where: { businessId: req.user.businessId, employeeId: emp.id, date: { gte: desde, lte: hasta } } });
    const totalHours = att.reduce((s, a) => s + (a.status !== 'absent' ? (a.hoursWorked || 0) : 0), 0);
    const presentDays = att.filter(a => a.status !== 'absent').length;
    const rate = emp.salary || 0;
    const totalAmount = emp.payType === 'hourly' ? totalHours * rate : rate;
    res.json({
      empleado: emp.name, payType: emp.payType, payRate: rate,
      desde: desde.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10),
      totalHours, presentDays, totalAmount,
    });
  } catch (e) {
    console.error('[bot/liquidacion GET]', e.message);
    res.status(500).json({ error: 'No se pudo calcular la liquidación' });
  }
});

// POST /api/bot/liquidacion  — registra la liquidación (confirmar)
router.post('/liquidacion', async (req, res) => {
  try {
    const { empleado, desde, hasta, marcarPagada } = req.body || {};
    const emp = await buscarEmpleado(req.user.businessId, empleado);
    if (!emp) return res.status(404).json({ error: `No encontré al empleado "${empleado || ''}".` });
    const ini = inicioMesAR();
    const d1 = desde ? new Date(String(desde)) : ini;
    const d2 = hasta ? new Date(String(hasta)) : new Date(ini.getFullYear(), ini.getMonth() + 1, 0);
    const att = await prisma.attendance.findMany({ where: { businessId: req.user.businessId, employeeId: emp.id, date: { gte: d1, lte: d2 } } });
    const totalHours = att.reduce((s, a) => s + (a.status !== 'absent' ? (a.hoursWorked || 0) : 0), 0);
    const rate = emp.salary || 0;
    const totalAmount = emp.payType === 'hourly' ? totalHours * rate : rate;
    const rec = await prisma.payrollRecord.create({
      data: {
        businessId: req.user.businessId, employeeId: emp.id, periodStart: d1, periodEnd: d2,
        totalHours, payRate: rate, payType: emp.payType, totalAmount,
        status: marcarPagada ? 'paid' : 'pending',
        ...(marcarPagada ? { paidAt: new Date() } : {}),
      },
    });
    res.status(201).json({ ok: true, id: rec.id, empleado: emp.name, totalAmount, estado: rec.status, entity: 'payroll' });
  } catch (e) {
    console.error('[bot/liquidacion POST]', e.message);
    res.status(500).json({ error: 'No se pudo registrar la liquidación' });
  }
});

// POST /api/bot/delete  — borra un registro cargado por el bot { entity, id }
router.post('/delete', async (req, res) => {
  try {
    const { entity, id } = req.body || {};
    if (!entity || !id) return res.status(400).json({ error: 'Falta qué borrar' });
    const bId = req.user.businessId;
    const guard = async (model, extra = {}) => {
      const row = await model.findUnique({ where: { id } });
      if (!row || (row.businessId && row.businessId !== bId)) return false;
      return true;
    };
    if (entity === 'expense') {
      if (!(await guard(prisma.expense))) return res.status(404).json({ error: 'No encontré ese gasto' });
      await prisma.expense.delete({ where: { id } });
    } else if (entity === 'income') {
      if (!(await guard(prisma.manualIncome))) return res.status(404).json({ error: 'No encontré ese cobro' });
      await prisma.manualIncome.delete({ where: { id } });
    } else if (entity === 'client') {
      const c = await prisma.client.findUnique({ where: { id } });
      if (!c || c.businessId !== bId) return res.status(404).json({ error: 'No encontré ese cliente' });
      await prisma.client.update({ where: { id }, data: { active: false } }); // baja lógica
    } else if (entity === 'appointment') {
      const a = await prisma.appointment.findUnique({ where: { id } });
      if (!a || a.businessId !== bId) return res.status(404).json({ error: 'No encontré ese turno' });
      await prisma.appointment.delete({ where: { id } });
    } else {
      return res.status(400).json({ error: 'No puedo borrar eso' });
    }
    res.json({ ok: true, entity });
  } catch (e) {
    console.error('[bot/delete]', e.message);
    res.status(500).json({ error: 'No se pudo borrar' });
  }
});

// ───────────────────────── Presupuestos y Órdenes de trabajo ─────────────────────────
const { logAudit } = require('../lib/audit');
const _calcTotal = (items) => Array.isArray(items) ? items.reduce((s, it) => s + (Number(it.cantidad) || 0) * (Number(it.precio) || 0), 0) : 0;
const _normItems = (items) => Array.isArray(items)
  ? items.map(it => ({ descripcion: String(it.descripcion || '').slice(0, 300), cantidad: Number(it.cantidad) || 1, precio: Number(it.precio) || 0 })).filter(it => it.descripcion)
  : [];
const BUDGET_ESTADOS = ['borrador', 'enviado', 'aceptado', 'rechazado'];
const WO_ESTADOS = ['pendiente', 'en_curso', 'terminada', 'cancelada'];
// Busca por numero (lo natural para el usuario) o por id
async function findBudget(bId, ref) {
  const n = parseInt(String(ref).replace(/\D/g, ''), 10);
  if (!isNaN(n)) { const b = await prisma.budget.findFirst({ where: { businessId: bId, numero: n } }); if (b) return b; }
  return prisma.budget.findFirst({ where: { businessId: bId, id: String(ref) } });
}
async function findWO(bId, ref) {
  const n = parseInt(String(ref).replace(/\D/g, ''), 10);
  if (!isNaN(n)) { const w = await prisma.workOrder.findFirst({ where: { businessId: bId, numero: n } }); if (w) return w; }
  return prisma.workOrder.findFirst({ where: { businessId: bId, id: String(ref) } });
}

// GET /api/bot/budgets?status=&limit=
router.get('/budgets', async (req, res) => {
  try {
    const where = { businessId: req.user.businessId };
    if (req.query.status && BUDGET_ESTADOS.includes(req.query.status)) where.status = req.query.status;
    const rows = await prisma.budget.findMany({ where, orderBy: { numero: 'desc' }, take: Math.min(parseInt(req.query.limit, 10) || 10, 25) });
    res.json(rows.map(b => ({ numero: b.numero, cliente: b.clienteNombre || 's/cliente', total: b.total, estado: b.status })));
  } catch (e) { console.error('[bot/budgets]', e.message); res.status(500).json({ error: 'No pude listar presupuestos' }); }
});

// POST /api/bot/budget  { clientName?, clienteNombre?, items:[{descripcion,cantidad,precio}], notas?, validezDias? }
router.post('/budget', async (req, res) => {
  try {
    const { clientName, clienteNombre, items, notas, validezDias } = req.body || {};
    const its = _normItems(items);
    if (!its.length) return res.status(400).json({ error: 'Agregá al menos un ítem (descripción y precio)' });
    let nombre = (clienteNombre || '').trim(), cid = null, doc = null;
    if (clientName && String(clientName).trim()) {
      const c = await buscarCliente(req.user.businessId, clientName);
      if (c) { cid = c.id; nombre = nombre || c.name; doc = c.cuit || c.dni || null; }
      else if (!nombre) nombre = String(clientName).trim();
    }
    const max = await prisma.budget.aggregate({ where: { businessId: req.user.businessId }, _max: { numero: true } });
    const numero = (max._max.numero || 0) + 1;
    const dias = (validezDias == null || validezDias === '') ? 15 : parseInt(validezDias, 10);
    const b = await prisma.budget.create({ data: {
      businessId: req.user.businessId, clientId: cid, clienteNombre: nombre || null, clienteDoc: doc,
      numero, status: 'borrador', itemsJson: JSON.stringify(its), total: _calcTotal(its),
      validezDias: dias || null, validoHasta: dias > 0 ? new Date(Date.now() + dias * 86400000) : null, notas: (notas || '').trim() || null,
    } });
    logAudit(req, { action: 'creo_presupuesto', entity: 'presupuesto', entityId: b.id, detail: `#${numero} · ${nombre || 's/cliente'} · $${b.total} (bot)` });
    res.status(201).json({ ok: true, numero: b.numero, total: b.total, cliente: nombre || 's/cliente' });
  } catch (e) { console.error('[bot/budget]', e.message); res.status(500).json({ error: 'No se pudo crear el presupuesto' }); }
});

// POST /api/bot/budget/status  { ref, status }
router.post('/budget/status', async (req, res) => {
  try {
    const { ref, status } = req.body || {};
    if (!BUDGET_ESTADOS.includes(status)) return res.status(400).json({ error: 'Estado inválido (borrador, enviado, aceptado, rechazado)' });
    const b = await findBudget(req.user.businessId, ref);
    if (!b) return res.status(404).json({ error: 'No encontré ese presupuesto' });
    await prisma.budget.update({ where: { id: b.id }, data: { status } });
    logAudit(req, { action: 'edito_presupuesto', entity: 'presupuesto', entityId: b.id, detail: `#${b.numero} · estado: ${status} (bot)` });
    res.json({ ok: true, numero: b.numero, estado: status });
  } catch (e) { console.error('[bot/budget/status]', e.message); res.status(500).json({ error: 'No se pudo cambiar el estado' }); }
});

// GET /api/bot/workorders?status=&limit=
router.get('/workorders', async (req, res) => {
  try {
    const where = { businessId: req.user.businessId };
    if (req.query.status && WO_ESTADOS.includes(req.query.status)) where.status = req.query.status;
    const rows = await prisma.workOrder.findMany({ where, orderBy: { numero: 'desc' }, take: Math.min(parseInt(req.query.limit, 10) || 10, 25) });
    res.json(rows.map(w => ({ numero: w.numero, titulo: w.titulo || '—', cliente: w.clienteNombre || 's/cliente', total: w.total, estado: w.status, facturada: w.facturada, cobrada: w.cobrada })));
  } catch (e) { console.error('[bot/workorders]', e.message); res.status(500).json({ error: 'No pude listar las órdenes' }); }
});

// POST /api/bot/workorder  { clientName?, titulo?, items?, employeeName?, notas?, scheduledDate? }
router.post('/workorder', async (req, res) => {
  try {
    const { clientName, titulo, items, employeeName, notas, scheduledDate } = req.body || {};
    const its = _normItems(items);
    let nombre = '', cid = null;
    if (clientName && String(clientName).trim()) {
      const c = await buscarCliente(req.user.businessId, clientName);
      if (c) { cid = c.id; nombre = c.name; } else nombre = String(clientName).trim();
    }
    let eid = null;
    if (employeeName && String(employeeName).trim()) { const e = await buscarEmpleado(req.user.businessId, employeeName); if (e) eid = e.id; }
    const max = await prisma.workOrder.aggregate({ where: { businessId: req.user.businessId }, _max: { numero: true } });
    const numero = (max._max.numero || 0) + 1;
    const w = await prisma.workOrder.create({ data: {
      businessId: req.user.businessId, clientId: cid, clienteNombre: nombre || null, titulo: (titulo || '').trim() || null,
      employeeId: eid, numero, itemsJson: JSON.stringify(its), total: _calcTotal(its),
      status: 'pendiente', scheduledDate: (scheduledDate || '').trim() || null, notas: (notas || '').trim() || null,
    } });
    logAudit(req, { action: 'creo_orden_trabajo', entity: 'orden_trabajo', entityId: w.id, detail: `#${numero} · ${nombre || 's/cliente'} (bot)` });
    res.status(201).json({ ok: true, numero: w.numero, total: w.total, cliente: nombre || 's/cliente' });
  } catch (e) { console.error('[bot/workorder]', e.message); res.status(500).json({ error: 'No se pudo crear la orden' }); }
});

// POST /api/bot/workorder/status  { ref, status }
router.post('/workorder/status', async (req, res) => {
  try {
    const { ref, status } = req.body || {};
    if (!WO_ESTADOS.includes(status)) return res.status(400).json({ error: 'Estado inválido (pendiente, en_curso, terminada, cancelada)' });
    const w = await findWO(req.user.businessId, ref);
    if (!w) return res.status(404).json({ error: 'No encontré esa orden' });
    await prisma.workOrder.update({ where: { id: w.id }, data: { status, completedAt: status === 'terminada' ? (w.completedAt || new Date()) : null } });
    logAudit(req, { action: 'edito_orden_trabajo', entity: 'orden_trabajo', entityId: w.id, detail: `#${w.numero} · estado: ${status} (bot)` });
    res.json({ ok: true, numero: w.numero, estado: status });
  } catch (e) { console.error('[bot/workorder/status]', e.message); res.status(500).json({ error: 'No se pudo cambiar el estado' }); }
});

// POST /api/bot/workorder/from-budget  { ref }   (convierte un presupuesto en OT)
router.post('/workorder/from-budget', async (req, res) => {
  try {
    const b = await findBudget(req.user.businessId, (req.body || {}).ref);
    if (!b) return res.status(404).json({ error: 'No encontré ese presupuesto' });
    const max = await prisma.workOrder.aggregate({ where: { businessId: req.user.businessId }, _max: { numero: true } });
    const numero = (max._max.numero || 0) + 1;
    const w = await prisma.workOrder.create({ data: {
      businessId: req.user.businessId, budgetId: b.id, clientId: b.clientId, clienteNombre: b.clienteNombre,
      titulo: `Presupuesto N° ${String(b.numero).padStart(6, '0')}`, numero, itemsJson: b.itemsJson, total: b.total, status: 'pendiente',
    } });
    logAudit(req, { action: 'convirtio_presupuesto_ot', entity: 'orden_trabajo', entityId: w.id, detail: `#${numero} desde presupuesto #${b.numero} (bot)` });
    res.status(201).json({ ok: true, numero: w.numero, desdePresupuesto: b.numero });
  } catch (e) { console.error('[bot/wo/from-budget]', e.message); res.status(500).json({ error: 'No se pudo convertir' }); }
});

// POST /api/bot/workorder/cobrar  { ref }   (registra el ingreso por una OT terminada)
router.post('/workorder/cobrar', async (req, res) => {
  try {
    const w = await findWO(req.user.businessId, (req.body || {}).ref);
    if (!w) return res.status(404).json({ error: 'No encontré esa orden' });
    if (w.status !== 'terminada') return res.status(400).json({ error: 'Solo se cobran órdenes terminadas' });
    if (w.cobrada) return res.status(400).json({ error: 'Esa orden ya fue cobrada' });
    if (!(w.total > 0)) return res.status(400).json({ error: 'La orden no tiene un total a cobrar' });
    const desc = `OT N° ${String(w.numero).padStart(6, '0')}${w.titulo ? ' · ' + w.titulo : (w.clienteNombre ? ' · ' + w.clienteNombre : '')}`;
    const inc = await prisma.manualIncome.create({ data: {
      businessId: req.user.businessId, clientId: w.clientId || null, amount: w.total, description: desc.slice(0, 240), category: 'Orden de trabajo', date: hoyAR(),
    } });
    await prisma.workOrder.update({ where: { id: w.id }, data: { cobrada: true, manualIncomeId: inc.id } });
    logAudit(req, { action: 'cobro_orden_trabajo', entity: 'orden_trabajo', entityId: w.id, detail: `#${w.numero} · $${w.total} (bot)` });
    res.json({ ok: true, numero: w.numero, total: w.total });
  } catch (e) { console.error('[bot/wo/cobrar]', e.message); res.status(500).json({ error: 'No se pudo cobrar' }); }
});

module.exports = router;
