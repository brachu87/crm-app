const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const prisma = require('../prisma');
const { markOverdueCuotas } = require('../lib/overdue');

router.use(auth);

function daysFromNow(n) { const d = new Date(); d.setDate(d.getDate() + n); return d; }
function dmy(d) { if (!d) return ''; const x = new Date(d); return String(x.getUTCDate()).padStart(2, '0') + '/' + String(x.getUTCMonth() + 1).padStart(2, '0'); }
function dmyStr(s) { const [y, m, d] = String(s || '').split('-'); return d ? `${d}/${m}` : (s || ''); }

// GET /api/notifications — avisos calculados al vuelo para el dueño
router.get('/', async (req, res) => {
  try {
    const businessId = req.user.businessId;
    try { await markOverdueCuotas({ businessId }); } catch (_) {}
    const now = new Date();
    const in7 = daysFromNow(7);
    const cuotaInclude = { enrollment: { include: { client: { select: { name: true } }, activity: { select: { name: true } } } } };

    const [overdue, upcoming, pendingAppts, cancelledAppts] = await Promise.all([
      prisma.cuota.findMany({ where: { paymentStatus: 'overdue', enrollment: { active: true, client: { businessId, active: true } } }, include: cuotaInclude, orderBy: { dueDate: 'desc' }, take: 40 }),
      prisma.cuota.findMany({ where: { paymentStatus: 'pending', dueDate: { gte: now, lte: in7 }, enrollment: { active: true, client: { businessId, active: true } } }, include: cuotaInclude, orderBy: { dueDate: 'asc' }, take: 40 }),
      prisma.appointment.findMany({ where: { businessId, status: 'pending', isQuickWork: false, client: { active: true } }, include: { client: { select: { name: true } }, service: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 40 }),
      prisma.appointment.findMany({ where: { businessId, status: 'cancelled', isQuickWork: false, updatedAt: { gte: daysFromNow(-7) }, notes: { contains: 'portal' }, client: { active: true } }, include: { client: { select: { name: true } }, service: { select: { name: true } } }, orderBy: { updatedAt: 'desc' }, take: 40 }),
    ]);

    const items = [];
    for (const c of overdue) items.push({ id: 'cuota-ov-' + c.id, type: 'overdue', title: 'Cuota vencida', detail: `${c.enrollment?.client?.name || 'Cliente'} — ${c.enrollment?.activity?.name || ''} · venció ${dmy(c.dueDate)}`, ts: c.dueDate || c.createdAt, href: '/cobranza' });
    for (const c of upcoming) items.push({ id: 'cuota-up-' + c.id, type: 'upcoming', title: 'Cuota por vencer', detail: `${c.enrollment?.client?.name || 'Cliente'} — ${c.enrollment?.activity?.name || ''} · vence ${dmy(c.dueDate)}`, ts: c.dueDate, href: '/cobranza' });
    for (const a of pendingAppts) items.push({ id: 'appt-pend-' + a.id, type: 'appt-new', title: 'Nuevo turno reservado', detail: `${a.client?.name || 'Socio'} — ${a.service?.name || 'servicio'} · ${dmyStr(a.date)} ${a.startTime}`, ts: a.createdAt, href: '/actividades' });
    for (const a of cancelledAppts) items.push({ id: 'appt-cancel-' + a.id, type: 'appt-cancel', title: 'Turno cancelado por el socio', detail: `${a.client?.name || 'Socio'} — ${a.service?.name || 'servicio'} · ${dmyStr(a.date)} ${a.startTime}`, ts: a.updatedAt, href: '/actividades' });

    items.sort((x, y) => new Date(y.ts) - new Date(x.ts));
    res.json({ items });
  } catch (e) { console.error('[notifications]', e.message); res.status(500).json({ error: 'Error' }); }
});

module.exports = router;
