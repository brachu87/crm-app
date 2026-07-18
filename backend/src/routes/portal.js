/**
 * Portal del socio (clientes de los negocios).
 * Login con número de socio (usuario) + DNI (contraseña inicial).
 * Token propio (k:'portal', cid=clientId), separado del token de la app.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const APP_URL = process.env.APP_URL || 'https://crm-app-production-0669.up.railway.app';
const prisma = require('../prisma');
const evo = require('../lib/whatsappEvolution');
let gcal = null; try { gcal = require('../lib/googleCalendar'); } catch (_) {}

const router = express.Router();

function portalAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t) return res.status(401).json({ error: 'No autorizado' });
  try {
    const d = jwt.verify(t, process.env.JWT_SECRET);
    if (d.k !== 'portal' || !d.cid) return res.status(401).json({ error: 'Token inválido' });
    req.socioId = d.cid;
    next();
  } catch { return res.status(401).json({ error: 'Sesión vencida' }); }
}

// POST /api/portal/login  { memberNumber, password }
router.post('/login', async (req, res) => {
  try {
    const memberNumber = String(req.body.memberNumber || '').trim();
    const password = String(req.body.password || '');
    if (!memberNumber || !password) return res.status(400).json({ error: 'Ingresá tu número de socio y contraseña' });

    const client = await prisma.client.findUnique({
      where: { memberNumber },
      include: { business: { select: { name: true } } },
    });
    if (!client) return res.status(401).json({ error: 'Número de socio o contraseña incorrectos' });

    let valid = false;
    if (client.portalPassword) valid = await bcrypt.compare(password, client.portalPassword);
    else valid = !!client.dni && password === client.dni; // primera vez: la contraseña es el DNI

    if (!valid) return res.status(401).json({ error: 'Número de socio o contraseña incorrectos' });
    if (client.active === false) return res.status(403).json({ error: 'Tu cuenta está inactiva. Contactá al negocio.' });

    const token = jwt.sign({ cid: client.id, k: 'portal' }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({
      token,
      client: { name: client.name, memberNumber: client.memberNumber, businessName: client.business?.name || '' },
      mustChangePassword: !client.portalPassword, // sigue usando el DNI
    });
  } catch (e) { console.error('[portal-login]', e.message); res.status(500).json({ error: 'Error' }); }
});

// GET /api/portal/me — resumen de cuenta + actividades
router.get('/me', portalAuth, async (req, res) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: req.socioId },
      include: {
        business: { select: { name: true, mpAccessToken: true } },
        enrollments: {
          include: {
            activity: { select: { name: true, price: true } },
            cuotas: { include: { payments: true }, orderBy: { period: 'desc' } },
          },
        },
        accountMovements: { orderBy: { date: 'desc' } },
      },
    });
    if (!client) return res.status(404).json({ error: 'No encontrado' });

    const appointments = await prisma.appointment.findMany({
      where: { clientId: client.id, status: 'completed' },
      include: { service: { select: { name: true } } },
      orderBy: { date: 'desc' },
    });

    const allCuotas = client.enrollments.flatMap((e) => e.cuotas);
    const totalCharged = allCuotas.reduce((s, c) => s + Math.max(0, c.amountDue - (c.discount || 0)), 0);
    const totalPaid    = allCuotas.reduce((s, c) => s + c.payments.reduce((p, pay) => p + pay.amount, 0), 0);
    const manualCargos = client.accountMovements.filter((m) => m.type === 'cargo').reduce((s, m) => s + m.amount, 0);
    const manualAbonos = client.accountMovements.filter((m) => m.type === 'abono').reduce((s, m) => s + m.amount, 0);
    const apptCharged  = appointments.reduce((s, a) => s + (a.price || 0), 0);
    const apptPaid     = appointments.filter((a) => a.paymentStatus === 'paid').reduce((s, a) => s + (a.price || 0), 0);
    const balance = totalCharged + manualCargos + apptCharged - totalPaid - manualAbonos - apptPaid;

    const activities = client.enrollments.map((e) => {
      const current = e.cuotas[0] || null;
      return {
        name: e.activity?.name || 'Actividad',
        amount: e.amountDue,
        status: current?.paymentStatus || 'pending',
        dueDate: current?.dueDate || null,
        cuotaId: current ? current.id : null,
        net: current ? Math.max(0, current.amountDue - (current.discount || 0)) : e.amountDue,
      };
    });

    res.json({
      name: client.name,
      memberNumber: client.memberNumber,
      dni: client.dni || null,
      businessName: client.business?.name || '',
      mpEnabled: !!(client.business && client.business.mpAccessToken),
      balance,
      activities,
      hasCustomPassword: !!client.portalPassword,
    });
  } catch (e) { console.error('[portal-me]', e.message); res.status(500).json({ error: 'Error' }); }
});

// POST /api/portal/change-password { newPassword }
router.post('/change-password', portalAuth, async (req, res) => {
  try {
    const newPassword = String(req.body.newPassword || '');
    if (newPassword.length < 4) return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
    await prisma.client.update({ where: { id: req.socioId }, data: { portalPassword: await bcrypt.hash(newPassword, 10) } });
    res.json({ ok: true });
  } catch (e) { console.error('[portal-pass]', e.message); res.status(500).json({ error: 'Error' }); }
});

// Helper: businessId del socio
async function socioBusinessId(clientId) {
  const c = await prisma.client.findUnique({ where: { id: clientId }, select: { businessId: true } });
  return c?.businessId || null;
}

// Suma minutos a "HH:MM" y devuelve "HH:MM"
function addMinutes(hhmm, mins) {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return hhmm;
  const total = h * 60 + m + (mins || 0);
  const nh = Math.floor((total % 1440) / 60);
  const nm = total % 60;
  return String(nh).padStart(2, '0') + ':' + String(nm).padStart(2, '0');
}

// GET /api/portal/notifications — avisos para el socio (calculados al vuelo)
router.get('/notifications', portalAuth, async (req, res) => {
  try {
    const now = new Date();
    const in7 = new Date(now); in7.setDate(in7.getDate() + 7);
    const ago7 = new Date(now); ago7.setDate(ago7.getDate() - 7);
    const in2 = new Date(now); in2.setDate(in2.getDate() + 2);
    const todayStr = now.toISOString().slice(0, 10);
    const in2Str = in2.toISOString().slice(0, 10);
    const dstr = (x) => { const [y, m, d] = String(x || '').split('-'); return d ? `${d}/${m}` : (x || ''); };

    const [cuotas, scheduled, cancelled] = await Promise.all([
      prisma.cuota.findMany({
        where: { enrollment: { active: true, clientId: req.socioId }, OR: [{ paymentStatus: 'overdue' }, { paymentStatus: 'pending', dueDate: { gte: now, lte: in7 } }] },
        include: { enrollment: { include: { activity: { select: { name: true } } } } }, take: 20,
      }),
      prisma.appointment.findMany({ where: { clientId: req.socioId, status: 'scheduled', isQuickWork: false, date: { gte: todayStr } }, include: { service: { select: { name: true } } }, orderBy: { date: 'asc' }, take: 20 }),
      prisma.appointment.findMany({ where: { clientId: req.socioId, status: 'cancelled', isQuickWork: false, updatedAt: { gte: ago7 } }, include: { service: { select: { name: true } } }, orderBy: { updatedAt: 'desc' }, take: 20 }),
    ]);

    const items = [];
    for (const c of cuotas) {
      const act = c.enrollment?.activity?.name || 'tu cuota';
      if (c.paymentStatus === 'overdue') items.push({ id: 'cuota-ov-' + c.id, type: 'overdue', title: 'Cuota vencida', detail: `Tu cuota de ${act} está vencida.`, ts: c.dueDate || c.createdAt });
      else items.push({ id: 'cuota-up-' + c.id, type: 'upcoming', title: 'Cuota por vencer', detail: `Tu cuota de ${act} vence el ${dstr(c.dueDate ? new Date(c.dueDate).toISOString().slice(0,10) : '')}.`, ts: c.dueDate });
    }
    for (const a of scheduled) {
      const svc = a.service?.name || 'tu turno';
      if (a.date <= in2Str) items.push({ id: 'appt-rem-' + a.id, type: 'reminder', title: 'Recordatorio de turno', detail: `Tenés turno de ${svc} el ${dstr(a.date)} a las ${a.startTime}.`, ts: a.updatedAt });
      else items.push({ id: 'appt-ok-' + a.id, type: 'confirmed', title: 'Turno confirmado', detail: `Tu turno de ${svc} quedó confirmado para el ${dstr(a.date)} a las ${a.startTime}.`, ts: a.updatedAt });
    }
    for (const a of cancelled) {
      const svc = a.service?.name || 'tu turno';
      items.push({ id: 'appt-cx-' + a.id, type: 'cancelled', title: 'Turno cancelado', detail: `Tu turno de ${svc} del ${dstr(a.date)} fue cancelado.`, ts: a.updatedAt });
    }
    items.sort((x, y) => new Date(y.ts) - new Date(x.ts));
    res.json({ items });
  } catch (e) { console.error('[portal-notifications]', e.message); res.status(500).json({ error: 'Error' }); }
});

// GET /api/portal/services — servicios que el socio puede reservar
router.get('/services', portalAuth, async (req, res) => {
  try {
    const businessId = await socioBusinessId(req.socioId);
    if (!businessId) return res.status(404).json({ error: 'No encontrado' });
    const services = await prisma.service.findMany({
      where: { businessId, active: true, onlineBooking: true },
      select: {
        id: true, name: true, duration: true, price: true,
        schedules: { where: { active: true }, select: { dayOfWeek: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(services.map(s => ({
      id: s.id, name: s.name, duration: s.duration, price: s.price,
      days: [...new Set((s.schedules || []).map(sc => sc.dayOfWeek))].sort((a, b) => a - b),
    })));
  } catch (e) { console.error('[portal-services]', e.message); res.status(500).json({ error: 'Error' }); }
});

// GET /api/portal/appointments — próximos turnos del socio
router.get('/appointments', portalAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const appts = await prisma.appointment.findMany({
      where: { clientId: req.socioId, date: { gte: today }, status: { in: ['scheduled', 'pending', 'cancelled'] } },
      include: { service: { select: { name: true } } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
    res.json(appts.map(a => ({
      id: a.id, date: a.date, startTime: a.startTime, endTime: a.endTime,
      service: a.service?.name || 'Turno', status: a.status, price: a.price,
    })));
  } catch (e) { console.error('[portal-appts]', e.message); res.status(500).json({ error: 'Error' }); }
});

// Día de semana (0=Dom..6=Sáb) de "YYYY-MM-DD" sin problemas de zona horaria
function weekdayOf(dateStr) {
  const [y, m, d] = String(dateStr || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
function timesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

// GET /api/portal/availability?serviceId=..&date=YYYY-MM-DD
// Devuelve los turnos (slots) del servicio para esa fecha, marcando los ocupados.
router.get('/availability', portalAuth, async (req, res) => {
  try {
    const { serviceId, date } = req.query || {};
    if (!serviceId || !date) return res.status(400).json({ error: 'Faltan serviceId o date' });
    const businessId = await socioBusinessId(req.socioId);
    if (!businessId) return res.status(404).json({ error: 'No encontrado' });
    const service = await prisma.service.findFirst({ where: { id: serviceId, businessId }, select: { duration: true, onlineBooking: true, active: true } });
    if (!service || !service.active || !service.onlineBooking) return res.status(404).json({ error: 'Servicio no disponible' });

    const dow = weekdayOf(date);
    if (dow === null) return res.status(400).json({ error: 'Fecha inválida' });
    const dur = service.duration || 60;

    const schedules = await prisma.serviceSchedule.findMany({
      where: { serviceId, businessId, active: true, dayOfWeek: dow },
      orderBy: { startTime: 'asc' },
    });

    // Generar slots según cada franja y la duración del servicio
    const slots = [];
    const seen = new Set();
    for (const sc of schedules) {
      let start = sc.startTime;
      while (true) {
        const end = addMinutes(start, dur);
        if (end > sc.endTime || end === start) break; // no entra un turno completo
        if (!seen.has(start)) { seen.add(start); slots.push({ startTime: start, endTime: end }); }
        start = end;
      }
    }
    slots.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Turnos ya reservados de ese servicio en esa fecha
    const taken = await prisma.appointment.findMany({
      where: { businessId, serviceId, date, isQuickWork: false, status: { not: 'cancelled' } },
      select: { startTime: true, endTime: true },
    });

    const result = slots.map(sl => ({
      startTime: sl.startTime,
      endTime: sl.endTime,
      occupied: taken.some(t => timesOverlap(sl.startTime, sl.endTime, t.startTime, t.endTime)),
    }));

    res.json({ date, dayOfWeek: dow, duration: dur, slots: result });
  } catch (e) { console.error('[portal-availability]', e.message); res.status(500).json({ error: 'Error' }); }
});

function fmtDMY(dateStr) {
  const [y, m, d] = String(dateStr || '').split('-');
  return d && m ? `${d}/${m}` : dateStr;
}
async function genConfirmCode(businessId) {
  for (let i = 0; i < 8; i++) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const dup = await prisma.appointment.findFirst({ where: { businessId, confirmCode: code, status: 'pending' } });
    if (!dup) return code;
  }
  return String(Date.now()).slice(-4);
}

// POST /api/portal/appointments — reservar un turno de un servicio
router.post('/appointments', portalAuth, async (req, res) => {
  try {
    const { serviceId, date, startTime } = req.body || {};
    if (!serviceId || !date || !startTime) return res.status(400).json({ error: 'Elegí servicio, fecha y horario' });
    const businessId = await socioBusinessId(req.socioId);
    if (!businessId) return res.status(404).json({ error: 'No encontrado' });
    const service = await prisma.service.findFirst({ where: { id: serviceId, businessId }, select: { duration: true, price: true, onlineBooking: true, active: true } });
    if (!service || !service.active || !service.onlineBooking) return res.status(404).json({ error: 'Servicio no disponible para reserva online' });
    const endTime = addMinutes(startTime, service.duration || 60);

    // Validar que el horario esté dentro de la agenda del servicio para ese día
    const dow = weekdayOf(date);
    const daySchedules = await prisma.serviceSchedule.findMany({
      where: { serviceId, businessId, active: true, dayOfWeek: dow },
      select: { startTime: true, endTime: true },
    });
    const dentroDeAgenda = daySchedules.some(sc => startTime >= sc.startTime && endTime <= sc.endTime);
    if (!dentroDeAgenda)
      return res.status(409).json({ error: 'Ese horario no está disponible para este servicio.' });

    // Validar que no esté ya ocupado por otro turno del mismo servicio (uno por horario)
    const yaOcupado = await prisma.appointment.findFirst({
      where: {
        businessId, serviceId, date, isQuickWork: false,
        status: { not: 'cancelled' },
        startTime: { lt: endTime }, endTime: { gt: startTime },
      },
    });
    if (yaOcupado)
      return res.status(409).json({ error: 'Ese horario ya fue reservado. Elegí otro.' });

    // Evitar turnos superpuestos del mismo socio
    const overlap = await prisma.appointment.findFirst({
      where: {
        businessId, clientId: req.socioId, date,
        isQuickWork: false,
        status: { not: 'cancelled' },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });
    if (overlap)
      return res.status(409).json({ error: `Ya tenés un turno de ${overlap.startTime} a ${overlap.endTime} ese día.` });

    const confirmCode = await genConfirmCode(businessId);
    const appt = await prisma.appointment.create({
      data: {
        businessId, serviceId, clientId: req.socioId,
        date, startTime, endTime,
        price: service.price || 0,
        status: 'pending', paymentStatus: 'pending',
        confirmCode,
        notes: 'Reservado por el socio desde el portal (pendiente de confirmación)',
      },
    });

    // Aviso por WhatsApp al negocio (mismo número conectado). No bloquea la reserva.
    try {
      const [biz, socio, svc] = await Promise.all([
        prisma.business.findUnique({ where: { id: businessId }, select: { phone: true } }),
        prisma.client.findUnique({ where: { id: req.socioId }, select: { name: true } }),
        prisma.service.findUnique({ where: { id: serviceId }, select: { name: true } }),
      ]);
      if (!evo || !evo.isConfigured || !evo.isConfigured()) {
        console.log('[portal-appt] Aviso WA omitido: Evolution no configurada');
      } else if (!biz || !biz.phone) {
        console.log('[portal-appt] Aviso WA omitido: el negocio no tiene teléfono cargado (Ajustes → Datos del negocio)');
      } else {
        const msg =
          `🔔 *Nuevo turno reservado*\n` +
          `${socio?.name || 'Un socio'} reservó *${svc?.name || 'un servicio'}* para el ${fmtDMY(date)} a las ${startTime}.\n\n` +
          `Respondé *SI ${confirmCode}* para confirmar o *NO ${confirmCode}* para rechazar.`;
        evo.sendText(businessId, biz.phone, msg)
          .then(() => console.log(`[portal-appt] Aviso WA enviado a ${biz.phone}`))
          .catch((err) => console.error('[portal-appt] Error enviando aviso WA:', err.message));
      }
    } catch (_) { /* no bloquear la reserva por el aviso */ }

    res.status(201).json({ ok: true, id: appt.id, status: 'pending' });
  } catch (e) { console.error('[portal-appt-create]', e.message); res.status(500).json({ error: 'Error' }); }
});

// POST /api/portal/appointments/:id/cancel — cancelar un turno propio
router.post('/appointments/:id/cancel', portalAuth, async (req, res) => {
  try {
    const appt = await prisma.appointment.findFirst({ where: { id: req.params.id, clientId: req.socioId } });
    if (!appt) return res.status(404).json({ error: 'Turno no encontrado' });
    await prisma.appointment.update({ where: { id: appt.id }, data: { status: 'cancelled' } });
    if (gcal && gcal.removeEvent && appt.gcalEventId) { try { gcal.removeEvent(appt.businessId, appt.gcalEventId); } catch (_) {} }

    // Aviso por WhatsApp al negocio: el socio canceló su turno. No bloquea.
    try {
      const [biz, socio, svc] = await Promise.all([
        prisma.business.findUnique({ where: { id: appt.businessId }, select: { phone: true } }),
        prisma.client.findUnique({ where: { id: req.socioId }, select: { name: true } }),
        appt.serviceId ? prisma.service.findUnique({ where: { id: appt.serviceId }, select: { name: true } }) : Promise.resolve(null),
      ]);
      if (!evo || !evo.isConfigured || !evo.isConfigured()) {
        console.log('[portal-appt-cancel] Aviso WA omitido: Evolution no configurada');
      } else if (!biz || !biz.phone) {
        console.log('[portal-appt-cancel] Aviso WA omitido: el negocio no tiene teléfono cargado');
      } else {
        const msg =
          `🚫 *Turno cancelado por el socio*\n` +
          `${socio?.name || 'Un socio'} canceló su turno de *${svc?.name || 'un servicio'}* del ${fmtDMY(appt.date)} a las ${appt.startTime}.`;
        evo.sendText(appt.businessId, biz.phone, msg)
          .then(() => console.log(`[portal-appt-cancel] Aviso WA enviado a ${biz.phone}`))
          .catch((err) => console.error('[portal-appt-cancel] Error enviando aviso WA:', err.message));
      }
    } catch (_) { /* no bloquear la cancelación por el aviso */ }

    res.json({ ok: true });
  } catch (e) { console.error('[portal-appt-cancel]', e.message); res.status(500).json({ error: 'Error' }); }
});

// Calcula la próxima fecha (>= hoy) que cae en dayOfWeek (0=Dom..6=Sáb) → "YYYY-MM-DD"
function nextDateForDow(dow) {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const diff = (dow - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function ymdUTC(d) { return d.toISOString().slice(0, 10); }
function todayUTC() { return new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z'); }
function mondayOf(d) {
  const wd = d.getUTCDay();
  const diff = wd === 0 ? -6 : 1 - wd;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
}
function occurrencesInMonth(dow, from) {
  const y = from.getUTCFullYear(), m = from.getUTCMonth();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const out = [];
  for (let day = from.getUTCDate(); day <= last; day++) {
    const dd = new Date(Date.UTC(y, m, day));
    if (dd.getUTCDay() === dow) out.push(ymdUTC(dd));
  }
  return out;
}
function occurrencesInWeek(dow, from) {
  const mon = mondayOf(from); const out = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(Date.UTC(mon.getUTCFullYear(), mon.getUTCMonth(), mon.getUTCDate() + i));
    if (dd.getUTCDay() === dow && ymdUTC(dd) >= ymdUTC(from)) out.push(ymdUTC(dd));
  }
  return out;
}

const DOW = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// GET /api/portal/classes — clases (horarios) del negocio para reservar cupo
router.get('/classes', portalAuth, async (req, res) => {
  try {
    const businessId = await socioBusinessId(req.socioId);
    if (!businessId) return res.status(404).json({ error: 'No encontrado' });
    const schedules = await prisma.classSchedule.findMany({
      where: { businessId, active: true, activity: { active: true } },
      include: { activity: { select: { name: true, reservationMode: true } } },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    const out = [];
    const today = new Date().toISOString().slice(0, 10);
    for (const sc of schedules) {
      const date = nextDateForDow(sc.dayOfWeek);
      const taken = await prisma.classReservation.count({ where: { classScheduleId: sc.id, date, status: 'reserved' } });
      const mine = await prisma.classReservation.count({ where: { classScheduleId: sc.id, status: 'reserved', clientId: req.socioId, date: { gte: today } } });
      out.push({
        id: sc.id,
        activity: sc.activity?.name || 'Actividad',
        dayOfWeek: sc.dayOfWeek, dayLabel: DOW[sc.dayOfWeek] || '',
        startTime: sc.startTime, endTime: sc.endTime,
        maxCapacity: sc.maxCapacity || null,
        date, taken, spotsLeft: sc.maxCapacity ? Math.max(0, sc.maxCapacity - taken) : null,
        alreadyReserved: mine > 0,
        mode: sc.activity?.reservationMode || 'daily',
      });
    }
    res.json(out);
  } catch (e) { console.error('[portal-classes]', e.message); res.status(500).json({ error: 'Error' }); }
});

// GET /api/portal/my-classes — reservas de clase próximas del socio (agrupadas por período)
router.get('/my-classes', portalAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const reservas = await prisma.classReservation.findMany({
      where: { clientId: req.socioId, status: 'reserved', date: { gte: today } },
      include: { classSchedule: { include: { activity: { select: { name: true } } } } },
      orderBy: [{ date: 'asc' }],
    });
    const groups = {};
    for (const r of reservas) {
      const pt = r.periodType || 'daily';
      const key = pt === 'daily' ? r.date : (r.periodKey || r.date);
      const gid = `${r.classScheduleId}|${pt}|${key}`;
      if (!groups[gid]) groups[gid] = {
        groupId: gid, periodType: pt,
        activity: r.classSchedule?.activity?.name || 'Actividad',
        startTime: r.classSchedule?.startTime || '', endTime: r.classSchedule?.endTime || '',
        dates: [],
      };
      groups[gid].dates.push(r.date);
    }
    res.json(Object.values(groups).map(g => ({
      groupId: g.groupId, periodType: g.periodType, activity: g.activity,
      startTime: g.startTime, endTime: g.endTime,
      count: g.dates.length, nextDate: g.dates[0], lastDate: g.dates[g.dates.length - 1],
    })));
  } catch (e) { console.error('[portal-myclasses]', e.message); res.status(500).json({ error: 'Error' }); }
});

// POST /api/portal/classes/:scheduleId/reserve — reservar cupo (según modo de la actividad)
router.post('/classes/:scheduleId/reserve', portalAuth, async (req, res) => {
  try {
    const businessId = await socioBusinessId(req.socioId);
    const sc = await prisma.classSchedule.findFirst({
      where: { id: req.params.scheduleId, businessId, active: true },
      include: { activity: { select: { reservationMode: true } } },
    });
    if (!sc) return res.status(404).json({ error: 'Clase no encontrada' });
    const mode = sc.activity?.reservationMode || 'daily';

    async function tryReserve(date, periodType, periodKey) {
      const dup = await prisma.classReservation.findFirst({ where: { classScheduleId: sc.id, clientId: req.socioId, date, status: 'reserved' } });
      if (dup) return 'dup';
      if (sc.maxCapacity) {
        const taken = await prisma.classReservation.count({ where: { classScheduleId: sc.id, date, status: 'reserved' } });
        if (taken >= sc.maxCapacity) return 'full';
      }
      await prisma.classReservation.create({ data: { businessId, classScheduleId: sc.id, clientId: req.socioId, date, status: 'reserved', periodType, periodKey } });
      return 'ok';
    }

    if (mode === 'daily') {
      const date = req.body.date || nextDateForDow(sc.dayOfWeek);
      const r = await tryReserve(date, 'daily', null);
      if (r === 'dup') return res.status(409).json({ error: 'Ya reservaste esta clase' });
      if (r === 'full') return res.status(409).json({ error: 'No quedan cupos para esta clase' });
      return res.status(201).json({ ok: true, reserved: 1, full: 0, mode });
    }

    const from = todayUTC();
    const dates = mode === 'monthly' ? occurrencesInMonth(sc.dayOfWeek, from) : occurrencesInWeek(sc.dayOfWeek, from);
    const periodKey = mode === 'monthly' ? from.toISOString().slice(0, 7) : ymdUTC(mondayOf(from));
    let reserved = 0, full = 0;
    for (const date of dates) {
      const r = await tryReserve(date, mode, periodKey);
      if (r === 'ok') reserved++;
      else if (r === 'full') full++;
    }
    return res.status(201).json({ ok: true, reserved, full, mode });
  } catch (e) { console.error('[portal-reserve]', e.message); res.status(500).json({ error: 'Error' }); }
});

// POST /api/portal/class-reservations/:id/cancel
router.post('/class-reservations/:id/cancel', portalAuth, async (req, res) => {
  try {
    const r = await prisma.classReservation.findFirst({ where: { id: req.params.id, clientId: req.socioId } });
    if (!r) return res.status(404).json({ error: 'Reserva no encontrada' });
    await prisma.classReservation.update({ where: { id: r.id }, data: { status: 'cancelled' } });
    res.json({ ok: true });
  } catch (e) { console.error('[portal-cancel-class]', e.message); res.status(500).json({ error: 'Error' }); }
});

// POST /api/portal/class-reservations/cancel-group — cancela todo un período (semanal/mensual) o una clase (daily)
router.post('/class-reservations/cancel-group', portalAuth, async (req, res) => {
  try {
    const { groupId } = req.body || {};
    if (!groupId) return res.status(400).json({ error: 'groupId requerido' });
    const [scheduleId, periodType, key] = String(groupId).split('|');
    const today = new Date().toISOString().slice(0, 10);
    const where = { clientId: req.socioId, classScheduleId: scheduleId, status: 'reserved' };
    if (periodType === 'daily') where.date = key;
    else { where.periodKey = key; where.date = { gte: today }; }
    await prisma.classReservation.updateMany({ where, data: { status: 'cancelled' } });
    res.json({ ok: true });
  } catch (e) { console.error('[portal-cancel-group]', e.message); res.status(500).json({ error: 'Error' }); }
});

// POST /api/portal/cuotas/:cuotaId/pay-preference — crea el checkout de Mercado Pago
router.post('/cuotas/:cuotaId/pay-preference', portalAuth, async (req, res) => {
  try {
    const cuota = await prisma.cuota.findFirst({
      where: { id: req.params.cuotaId, enrollment: { clientId: req.socioId } },
      include: { enrollment: { include: { client: true, activity: { include: { business: true } } } } },
    });
    if (!cuota) return res.status(404).json({ error: 'Cuota no encontrada' });
    const biz = cuota.enrollment.activity.business;
    if (!biz || !biz.mpAccessToken) return res.status(400).json({ error: 'El negocio todavía no tiene Mercado Pago configurado.' });
    const net = Math.max(0, cuota.amountDue - (cuota.discount || 0));
    if (net <= 0) return res.status(400).json({ error: 'Esta cuota no tiene saldo para pagar.' });

    const client = new MercadoPagoConfig({ accessToken: biz.mpAccessToken });
    const pref = await new Preference(client).create({
      body: {
        items: [{
          title: `${cuota.enrollment.activity?.name || 'Cuota'} - ${cuota.period}`,
          quantity: 1, currency_id: 'ARS', unit_price: Math.round(net * 100) / 100,
        }],
        payer: { name: cuota.enrollment.client?.name || '' },
        external_reference: cuota.id,
        back_urls: {
          success: `${APP_URL}/socio?pago=ok`,
          failure: `${APP_URL}/socio?pago=error`,
          pending: `${APP_URL}/socio?pago=pend`,
        },
        auto_return: 'approved',
        notification_url: `${APP_URL}/api/portal/mp-webhook?bid=${biz.id}`,
        statement_descriptor: (biz.name || 'GESTUMIO').slice(0, 22),
      },
    });
    res.json({ init_point: pref.init_point || pref.sandbox_init_point });
  } catch (e) {
    console.error('[portal pay-pref]', e.message);
    res.status(502).json({ error: 'No se pudo iniciar el pago. Intentá de nuevo.' });
  }
});

// POST /api/portal/mp-webhook — Mercado Pago notifica el pago (público, sin auth)
router.post('/mp-webhook', async (req, res) => {
  res.sendStatus(200); // responder rápido a MP
  try {
    const bid = req.query.bid;
    const type = req.body?.type || req.query.type || req.query.topic;
    const paymentId = (req.body?.data && req.body.data.id) || req.query['data.id'] || req.query.id;
    if (!bid || !paymentId || (type && type !== 'payment')) return;
    const biz = await prisma.business.findUnique({ where: { id: String(bid) }, select: { id: true, mpAccessToken: true } });
    if (!biz || !biz.mpAccessToken) return;
    const client = new MercadoPagoConfig({ accessToken: biz.mpAccessToken });
    const pay = await new Payment(client).get({ id: String(paymentId) });
    if (!pay || pay.status !== 'approved') return;
    const cuotaId = pay.external_reference;
    if (!cuotaId) return;
    const dup = await prisma.payment.findFirst({ where: { externalId: String(pay.id) } });
    if (dup) return;
    const cuota = await prisma.cuota.findFirst({ where: { id: cuotaId, enrollment: { activity: { businessId: biz.id } } } });
    if (!cuota) return;
    await prisma.payment.create({ data: { cuotaId, amount: pay.transaction_amount || 0, method: 'Mercado Pago', externalId: String(pay.id) } });
    const agg = await prisma.payment.aggregate({ where: { cuotaId }, _sum: { amount: true } });
    const totalPaid = agg._sum.amount || 0;
    const net = Math.max(0, cuota.amountDue - (cuota.discount || 0));
    const newStatus = totalPaid >= net ? 'paid' : (cuota.paymentStatus === 'overdue' ? 'overdue' : 'pending');
    await prisma.cuota.update({ where: { id: cuotaId }, data: { paymentStatus: newStatus } });
    console.log('[mp-webhook] cobro online registrado — cuota', cuotaId, 'pago', pay.id);
  } catch (e) { console.error('[mp-webhook]', e.message); }
});

module.exports = router;
