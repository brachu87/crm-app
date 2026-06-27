const { google } = require('googleapis');
const prisma = require('../prisma');

// Scope NO sensible: la app crea/gestiona un calendario propio ("Gestumio").
const SCOPES = ['https://www.googleapis.com/auth/calendar.app.created'];
const TZ = 'America/Argentina/Buenos_Aires';
const DAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']; // dayOfWeek 0=Domingo

function isConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function redirectUri() {
  return process.env.GOOGLE_CALENDAR_REDIRECT_URI
    || ((process.env.APP_URL || '').replace(/\/$/, '') + '/api/google-calendar/callback');
}

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri()
  );
}

function authUrl(state) {
  return oauthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  });
}

async function exchangeCode(code) {
  const { tokens } = await oauthClient().getToken(code);
  return tokens;
}

// Devuelve { cal, calendarId, biz } o null si el negocio no está conectado.
async function getContext(businessId) {
  if (!isConfigured()) return null;
  const biz = await prisma.business.findUnique({ where: { id: businessId } });
  if (!biz || !biz.googleCalendarToken) return null;
  const oauth = oauthClient();
  oauth.setCredentials(JSON.parse(biz.googleCalendarToken));
  // Persistir tokens refrescados (nuevo access_token / refresh_token)
  oauth.on('tokens', async (t) => {
    try {
      const prev = JSON.parse(biz.googleCalendarToken || '{}');
      const merged = { ...prev, ...t };
      await prisma.business.update({ where: { id: businessId }, data: { googleCalendarToken: JSON.stringify(merged) } });
    } catch (_) {}
  });
  const cal = google.calendar({ version: 'v3', auth: oauth });
  let calendarId = biz.googleCalendarId;
  if (!calendarId) {
    const created = await cal.calendars.insert({ requestBody: { summary: 'Gestumio', timeZone: TZ } });
    calendarId = created.data.id;
    await prisma.business.update({ where: { id: businessId }, data: { googleCalendarId: calendarId } });
  }
  return { cal, calendarId, biz };
}

async function ensureCalendar(businessId) {
  const ctx = await getContext(businessId);
  return ctx ? ctx.calendarId : null;
}

// requestBody: objeto de evento de Google. eventId opcional (update).
async function upsert(ctx, eventId, requestBody) {
  const { cal, calendarId } = ctx;
  if (eventId) {
    try {
      const r = await cal.events.update({ calendarId, eventId, requestBody });
      return r.data.id;
    } catch (e) {
      if (e.code === 404 || e.code === 410) {
        const r = await cal.events.insert({ calendarId, requestBody });
        return r.data.id;
      }
      throw e;
    }
  }
  const r = await cal.events.insert({ calendarId, requestBody });
  return r.data.id;
}

async function removeEvent(businessId, eventId) {
  if (!eventId) return;
  try {
    const ctx = await getContext(businessId);
    if (!ctx) return;
    await ctx.cal.events.delete({ calendarId: ctx.calendarId, eventId });
  } catch (e) {
    if (e && (e.code === 404 || e.code === 410)) return;
    console.error('[gcal] removeEvent:', e.message);
  }
}

function dt(dateStr, timeStr) {
  // dateStr 'YYYY-MM-DD', timeStr 'HH:MM' -> 'YYYY-MM-DDTHH:MM:00'
  const t = (timeStr && /^\d{1,2}:\d{2}$/.test(timeStr)) ? timeStr.padStart(5, '0') : '09:00';
  return `${dateStr}T${t}:00`;
}
function addHour(timeStr) {
  const [h, m] = (timeStr || '09:00').split(':').map(Number);
  const nh = ((h + 1) % 24).toString().padStart(2, '0');
  return `${nh}:${(m || 0).toString().padStart(2, '0')}`;
}

// ── Sincronización por entidad (Gestumio -> Google) ───────────────
async function syncAppointment(businessId, appt) {
  try {
    if (!appt || !appt.date) return;
    const ctx = await getContext(businessId);
    if (!ctx || !ctx.biz.gcalSyncTurnos) return;
    const clientName = appt.client?.name || '';
    const svc = appt.service?.name || appt.description || 'Turno';
    const summary = clientName ? `${svc} — ${clientName}` : svc;
    const body = { summary, description: appt.notes || undefined };
    if (appt.startTime) {
      body.start = { dateTime: dt(appt.date, appt.startTime), timeZone: TZ };
      body.end = { dateTime: dt(appt.date, appt.endTime || addHour(appt.startTime)), timeZone: TZ };
    } else {
      body.start = { date: appt.date };
      body.end = { date: appt.date };
    }
    const id = await upsert(ctx, appt.gcalEventId, body);
    if (id && id !== appt.gcalEventId) await prisma.appointment.update({ where: { id: appt.id }, data: { gcalEventId: id } });
  } catch (e) { console.error('[gcal] syncAppointment:', e.message); }
}

async function syncNote(businessId, note) {
  try {
    if (!note) return;
    const ctx = await getContext(businessId);
    if (!ctx || !ctx.biz.gcalSyncAgenda) return;
    const start = note.startAt || note.dueDate;
    if (!start) return; // sin fecha no se puede agendar
    const body = { summary: note.title || 'Nota', description: note.content || undefined };
    const startD = new Date(start);
    if (note.allDay) {
      const d = startD.toISOString().slice(0, 10);
      const endD = note.endAt ? new Date(note.endAt).toISOString().slice(0, 10) : d;
      body.start = { date: d };
      body.end = { date: endD };
    } else {
      const end = note.endAt ? new Date(note.endAt) : new Date(startD.getTime() + 60 * 60 * 1000);
      body.start = { dateTime: startD.toISOString(), timeZone: TZ };
      body.end = { dateTime: end.toISOString(), timeZone: TZ };
    }
    const id = await upsert(ctx, note.gcalEventId, body);
    if (id && id !== note.gcalEventId) await prisma.note.update({ where: { id: note.id }, data: { gcalEventId: id } });
  } catch (e) { console.error('[gcal] syncNote:', e.message); }
}

function nextDateForDow(dow) {
  const now = new Date();
  const diff = (dow - now.getDay() + 7) % 7;
  const d = new Date(now);
  d.setDate(now.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

async function syncSchedule(businessId, sched) {
  try {
    if (!sched || sched.dayOfWeek == null) return;
    const ctx = await getContext(businessId);
    if (!ctx || !ctx.biz.gcalSyncClases) return;
    if (sched.active === false) { if (sched.gcalEventId) await removeEvent(businessId, sched.gcalEventId); return; }
    const actName = sched.activity?.name || 'Clase';
    const date = nextDateForDow(Number(sched.dayOfWeek));
    const body = {
      summary: actName,
      start: { dateTime: dt(date, sched.startTime), timeZone: TZ },
      end: { dateTime: dt(date, sched.endTime || addHour(sched.startTime)), timeZone: TZ },
      recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${DAY[Number(sched.dayOfWeek)] || 'MO'}`],
    };
    const id = await upsert(ctx, sched.gcalEventId, body);
    if (id && id !== sched.gcalEventId) await prisma.classSchedule.update({ where: { id: sched.id }, data: { gcalEventId: id } });
  } catch (e) { console.error('[gcal] syncSchedule:', e.message); }
}

module.exports = {
  isConfigured, redirectUri, oauthClient, authUrl, exchangeCode,
  getContext, ensureCalendar, removeEvent,
  syncAppointment, syncNote, syncSchedule,
};
