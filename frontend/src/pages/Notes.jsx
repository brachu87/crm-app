import { useEffect, useState, useRef, useCallback } from 'react';
import api from '../api/client';
import { useSectionPerms } from '../config/permissions';

// ─── Constants ────────────────────────────────────────────────────────────────
const COLORS = {
  blue:   '#3b82f6',
  green:  '#10b981',
  red:    '#ef4444',
  orange: '#f59e0b',
  purple: '#8b5cf6',
  pink:   '#ec4899',
  teal:   '#14b8a6',
  gray:   '#6b7280',
};

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];
const DAYS_L = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const SLOT_H = 60; // px per hour in week/day views

// ─── Schedule expansion ───────────────────────────────────────────────────────
const SCHED_COLORS = ['teal','blue','purple','green','orange','pink','red'];

function colorForActivity(activityId, index) {
  return SCHED_COLORS[index % SCHED_COLORS.length];
}

function parseTime(timeStr, date) {
  const can = useSectionPerms('agenda');
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

function expandSchedules(schedules, fromDate, toDate, activityColorMap) {
  const events = [];
  const from = new Date(fromDate); from.setHours(0,0,0,0);
  const to = new Date(toDate); to.setHours(23,59,59,999);
  const cursor = new Date(from);
  while (cursor <= to) {
    const dow = cursor.getDay();
    schedules.forEach(s => {
      if (s.dayOfWeek === dow) {
        const startAt = parseTime(s.startTime, cursor);
        const endAt = parseTime(s.endTime, cursor);
        events.push({
          id: `sched-${s.id}-${cursor.toISOString().slice(0,10)}`,
          title: s.activity?.name || 'Clase',
          content: s.employee ? `Instructor: ${s.employee.name}` : '',
          allDay: false,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          color: activityColorMap[s.activityId] || 'teal',
          isSchedule: true,
          scheduleData: s,
        });
      }
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return events;
}


const APPT_STATUS_COLOR = {
  scheduled: 'orange',
  completed:  'green',
  cancelled:  'gray',
  'no-show':  'gray',
};

function appointmentsToEvents(appointments) {
  return appointments
    .filter(a => a.date && a.startTime && a.endTime)
    .map(a => {
      const startAt = new Date(`${a.date}T${a.startTime}:00`).toISOString();
      const endAt   = new Date(`${a.date}T${a.endTime}:00`).toISOString();
      const payBadge = a.paymentStatus === 'paid' ? ' ✓$' : '';
      return {
        id: `appt-${a.id}`,
        title: `${a.service?.name || 'Turno'} — ${a.client?.name || ''}${payBadge}`,
        content: `${a.startTime}–${a.endTime}${a.employee ? ' · ' + a.employee.name : ''}`,
        allDay: false,
        startAt,
        endAt,
        color: APPT_STATUS_COLOR[a.status] || 'orange',
        isSchedule: true,
        isAppointment: true,
        appointmentData: a,
      };
    });
}

function getViewRange(view, navDate) {
  if (view === 'month') {
    const y = navDate.getFullYear(), m = navDate.getMonth();
    return { from: new Date(y, m - 1, 1), to: new Date(y, m + 2, 0) };
  }
  if (view === 'week') {
    const ws = startOfWeek(navDate);
    return { from: addDays(ws, -7), to: addDays(ws, 14) };
  }
  if (view === 'day') {
    return { from: addDays(navDate, -1), to: addDays(navDate, 1) };
  }
  // agenda: next 90 days
  return { from: new Date(), to: addDays(new Date(), 90) };
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function startOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function fmtTime(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function localDateStr(d) {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtDate(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  return d.toISOString().slice(0, 10);
}

function toDatetimeLocal(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

function eventStart(e) {
  return e.startAt ? new Date(e.startAt) : e.dueDate ? new Date(e.dueDate) : null;
}

function eventEnd(e) {
  return e.endAt ? new Date(e.endAt) : null;
}

function eventsForDay(events, day) {
  return events.filter(e => {
    const s = eventStart(e);
    return s && sameDay(s, day);
  });
}

function colorHex(c) {
  return COLORS[c] || COLORS.blue;
}

// ─── Empty form ───────────────────────────────────────────────────────────────
function emptyForm(date) {
  const d = date || new Date();
  const base = new Date(d);
  base.setMinutes(0, 0, 0);
  const end = new Date(base);
  end.setHours(end.getHours() + 1);
  return {
    title: '',
    content: '',
    allDay: true,
    dueDate: localDateStr(base),
    startAt: toDatetimeLocal(base),
    endAt: toDatetimeLocal(end),
    color: 'blue',
    priority: 'normal',
    completed: false,
  };
}

// ─── EventModal ───────────────────────────────────────────────────────────────
function EventModal({ event, defaultDate, onSave, onDelete, onClose }) {
  const isNew = !event?.id;
  const [saveError, setSaveError] = useState('');
  const [form, setForm] = useState(() =>
    event?.id
      ? {
          title: event.title || '',
          content: event.content || '',
          allDay: event.allDay !== false,
          dueDate: fmtDate(event.startAt || event.dueDate || new Date()),
          startAt: toDatetimeLocal(event.startAt),
          endAt: toDatetimeLocal(event.endAt),
          color: event.color || 'blue',
          priority: event.priority || 'normal',
          completed: event.completed || false,
        }
      : emptyForm(defaultDate)
  );

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.title.trim()) { setSaveError('El titulo es obligatorio'); return; }
    setSaveError('');
    const payload = {
      title: form.title.trim(),
      content: form.content || null,
      allDay: form.allDay,
      color: form.color,
      priority: form.priority,
      completed: form.completed,
      dueDate: form.allDay ? form.dueDate : null,
      startAt: form.allDay
        ? (form.dueDate ? form.dueDate + 'T12:00:00.000Z' : null)
        : (form.startAt ? new Date(form.startAt).toISOString() : null),
      endAt: form.allDay ? null : (form.endAt ? new Date(form.endAt).toISOString() : null),
    };
    try {
      await onSave(payload, event?.id);
      onClose();
    } catch (e) {
      setSaveError('No se pudo guardar. Intenta de nuevo.');
    }
  }

  return (
    <div className="cal-modal-backdrop" onClick={onClose}>
      <div className="cal-modal" onClick={e => e.stopPropagation()}>
        <div className="cal-modal-header" style={{ borderLeft: `4px solid ${colorHex(form.color)}` }}>
          <input
            className="cal-modal-title-input"
            placeholder="Titulo del evento"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            autoFocus
          />
          <button className="cal-modal-close" onClick={onClose}>X</button>
        </div>

        <div className="cal-modal-body">
          {saveError && <div className="cal-save-error">{saveError}</div>}
          {/* Color picker */}
          <div className="cal-modal-row">
            <label className="cal-modal-label">Color</label>
            <div className="cal-color-row">
              {Object.entries(COLORS).map(([k, v]) => (
                <button
                  key={k}
                  className={`cal-color-dot${form.color === k ? ' selected' : ''}`}
                  style={{ background: v }}
                  onClick={() => set('color', k)}
                  title={k}
                />
              ))}
            </div>
          </div>

          {/* All-day toggle */}
          <div className="cal-modal-row">
            <label className="cal-modal-label">Todo el dia</label>
            <label className="cal-toggle">
              <input
                type="checkbox"
                checked={form.allDay}
                onChange={e => set('allDay', e.target.checked)}
              />
              <span className="cal-toggle-slider" />
            </label>
          </div>

          {/* Date / time */}
          {form.allDay ? (
            <div className="cal-modal-row">
              <label className="cal-modal-label">Fecha</label>
              <input
                type="date"
                className="cal-input"
                value={form.dueDate}
                onChange={e => set('dueDate', e.target.value)}
              />
            </div>
          ) : (
            <>
              <div className="cal-modal-row">
                <label className="cal-modal-label">Inicio</label>
                <input
                  type="datetime-local"
                  className="cal-input"
                  value={form.startAt}
                  onChange={e => set('startAt', e.target.value)}
                />
              </div>
              <div className="cal-modal-row">
                <label className="cal-modal-label">Fin</label>
                <input
                  type="datetime-local"
                  className="cal-input"
                  value={form.endAt}
                  onChange={e => set('endAt', e.target.value)}
                />
              </div>
            </>
          )}

          {/* Priority */}
          <div className="cal-modal-row">
            <label className="cal-modal-label">Prioridad</label>
            <select
              className="cal-input"
              value={form.priority}
              onChange={e => set('priority', e.target.value)}
            >
              <option value="low">Baja</option>
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
            </select>
          </div>

          {/* Completed */}
          <div className="cal-modal-row">
            <label className="cal-modal-label">Completado</label>
            <label className="cal-toggle">
              <input
                type="checkbox"
                checked={form.completed}
                onChange={e => set('completed', e.target.checked)}
              />
              <span className="cal-toggle-slider" />
            </label>
          </div>

          {/* Description */}
          <div className="cal-modal-row cal-modal-row--col">
            <label className="cal-modal-label">Descripcion</label>
            <textarea
              className="cal-input cal-textarea"
              placeholder="Agregar descripcion..."
              value={form.content}
              onChange={e => set('content', e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="cal-modal-footer">
          {!isNew && can.eliminar && <button className="btn-danger-sm" onClick={() => { onDelete(event.id); onClose(); }}>Eliminar</button>}
          <div style={{ flex: 1 }} />
          <button className="btn-secondary-sm" onClick={onClose}>Cancelar</button>
          <button className="btn-primary-sm" onClick={handleSave}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ─── MonthView ────────────────────────────────────────────────────────────────
function MonthView({ navDate, events, today, onDayClick, onEventClick }) {
  const year = navDate.getFullYear();
  const month = navDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - firstDay + 1;
    const date = new Date(year, month, dayNum);
    const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
    const isToday = inMonth && sameDay(date, today);
    const dayEvents = inMonth ? eventsForDay(events, date) : [];

    cells.push(
      <div
        key={i}
        className={`cal-month-cell${inMonth ? '' : ' cal-month-cell--out'}${isToday ? ' cal-month-cell--today' : ''}`}
        onClick={() => inMonth && onDayClick(date)}
      >
        <span className={`cal-month-day-num${isToday ? ' cal-month-day-num--today' : ''}`}>
          {inMonth ? dayNum : ''}
        </span>
        <div className="cal-month-events">
          {dayEvents.slice(0, 3).map(ev => (
            <div
              key={ev.id}
              className={`cal-month-pill${ev.completed ? ' cal-pill--done' : ''}`}
              style={{
                background: colorHex(ev.color),
                opacity: ev.isSchedule ? 0.75 : 1,
                cursor: 'pointer',
              }}
              onClick={e => { e.stopPropagation(); onEventClick(ev); }}
              title={ev.isSchedule ? `${ev.title}${ev.scheduleData?.employee ? ' · ' + ev.scheduleData.employee.name : ''}` : ev.title}
            >
              {!ev.allDay && ev.startAt && (
                <span className="cal-pill-time">{fmtTime(ev.startAt)}</span>
              )}
              {ev.isSchedule ? '📍 ' : ''}{ev.title}
            </div>
          ))}
          {dayEvents.length > 3 && (
            <div className="cal-month-more" onClick={e => { e.stopPropagation(); onDayClick(date); }}>
              +{dayEvents.length - 3} mas
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="cal-month-grid">
      {DAYS_L.map(d => (
        <div key={d} className="cal-month-header-cell">{d}</div>
      ))}
      {cells}
    </div>
  );
}

// ─── WeekView ─────────────────────────────────────────────────────────────────
function WeekView({ navDate, events, today, onSlotClick, onEventClick }) {
  const weekStart = startOfWeek(navDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 7 * SLOT_H;
    }
  }, []);

  const allDayEvents = events.filter(e => {
    const s = eventStart(e);
    return s && e.allDay && days.some(d => sameDay(d, s));
  });

  function timedEventsForDay(day) {
    return events.filter(e => {
      const s = eventStart(e);
      return s && !e.allDay && sameDay(s, day);
    });
  }

  function topPct(e) {
    const s = new Date(e.startAt);
    return (s.getHours() + s.getMinutes() / 60) * SLOT_H;
  }

  function heightPx(e) {
    if (!e.endAt) return SLOT_H;
    const s = new Date(e.startAt);
    const en = new Date(e.endAt);
    const diff = (en - s) / 3600000;
    return Math.max(diff * SLOT_H, 20);
  }

  return (
    <div className="cal-week-wrap">
      {/* All-day row */}
      {allDayEvents.length > 0 && (
        <div className="cal-week-allday-row">
          <div className="cal-week-time-gutter" />
          {days.map((day, i) => {
            const dayAll = allDayEvents.filter(e => sameDay(eventStart(e), day));
            return (
              <div key={i} className="cal-week-allday-cell">
                {dayAll.map(ev => (
                  <div
                    key={ev.id}
                    className={`cal-week-allday-pill${ev.completed ? ' cal-pill--done' : ''}`}
                    style={{ background: colorHex(ev.color) }}
                    onClick={() => onEventClick(ev)}
                  >
                    {ev.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Time grid */}
      <div className="cal-week-scroll" ref={scrollRef}>
        {/* Day headers */}
        <div className="cal-week-day-headers">
          <div className="cal-week-time-gutter" />
          {days.map((day, i) => (
            <div
              key={i}
              className={`cal-week-day-head${sameDay(day, today) ? ' cal-week-day-head--today' : ''}`}
            >
              <span className="cal-week-day-name">{DAYS_L[day.getDay()]}</span>
              <span className={`cal-week-day-num${sameDay(day, today) ? ' cal-week-day-num--today' : ''}`}>
                {day.getDate()}
              </span>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="cal-week-grid">
          {/* Hour labels */}
          <div className="cal-week-hours">
            {HOURS.map(h => (
              <div key={h} className="cal-week-hour-label" style={{ height: SLOT_H }}>
                {h === 0 ? '' : `${h.toString().padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, di) => (
            <div
              key={di}
              className="cal-week-col"
              onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const hour = Math.floor(y / SLOT_H);
                const clickDate = new Date(day);
                clickDate.setHours(hour, 0, 0, 0);
                onSlotClick(clickDate, false);
              }}
            >
              {/* Hour lines */}
              {HOURS.map(h => (
                <div key={h} className="cal-week-hour-line" style={{ top: h * SLOT_H }} />
              ))}
              {/* Timed events */}
              {timedEventsForDay(day).map(ev => (
                <div
                  key={ev.id}
                  className={`cal-week-event${ev.completed ? ' cal-pill--done' : ''}${ev.isSchedule ? ' cal-sched-event' : ''}`}
                  style={{
                    top: topPct(ev),
                    height: heightPx(ev),
                    background: colorHex(ev.color),
                    opacity: ev.isSchedule ? 0.75 : 1,
                    cursor: 'pointer',
                  }}
                  onClick={e => { e.stopPropagation(); onEventClick(ev); }}
                >
                  <span className="cal-week-event-title">{ev.isSchedule ? '📍 ' : ''}{ev.title}</span>
                  <span className="cal-week-event-time">
                    {fmtTime(ev.startAt)}{ev.endAt ? ` - ${fmtTime(ev.endAt)}` : ''}
                    {ev.isSchedule && ev.scheduleData?.employee ? ` · ${ev.scheduleData.employee.name}` : ''}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── DayView ──────────────────────────────────────────────────────────────────
function DayView({ navDate, events, today, onSlotClick, onEventClick }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 7 * SLOT_H;
    }
  }, []);

  const allDay = events.filter(e => {
    const s = eventStart(e);
    return s && e.allDay && sameDay(s, navDate);
  });

  const timed = events.filter(e => {
    const s = eventStart(e);
    return s && !e.allDay && sameDay(s, navDate);
  });

  function topPx(e) {
    const s = new Date(e.startAt);
    return (s.getHours() + s.getMinutes() / 60) * SLOT_H;
  }

  function heightPx(e) {
    if (!e.endAt) return SLOT_H;
    const s = new Date(e.startAt);
    const en = new Date(e.endAt);
    const diff = (en - s) / 3600000;
    return Math.max(diff * SLOT_H, 24);
  }

  return (
    <div className="cal-day-wrap">
      {allDay.length > 0 && (
        <div className="cal-day-allday-row">
          <div className="cal-week-time-gutter"><span className="cal-week-hour-label">Todo dia</span></div>
          <div className="cal-day-allday-col">
            {allDay.map(ev => (
              <div
                key={ev.id}
                className={`cal-week-allday-pill${ev.completed ? ' cal-pill--done' : ''}`}
                style={{ background: colorHex(ev.color) }}
                onClick={() => onEventClick(ev)}
              >
                {ev.title}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="cal-week-scroll" ref={scrollRef}>
        <div className="cal-week-grid" style={{ gridTemplateColumns: `56px 1fr` }}>
          <div className="cal-week-hours">
            {HOURS.map(h => (
              <div key={h} className="cal-week-hour-label" style={{ height: SLOT_H }}>
                {h === 0 ? '' : `${h.toString().padStart(2, '0')}:00`}
              </div>
            ))}
          </div>
          <div
            className="cal-week-col"
            style={{ height: 24 * SLOT_H, position: 'relative' }}
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              const y = e.clientY - rect.top;
              const hour = Math.floor(y / SLOT_H);
              const clickDate = new Date(navDate);
              clickDate.setHours(hour, 0, 0, 0);
              onSlotClick(clickDate, false);
            }}
          >
            {HOURS.map(h => (
              <div key={h} className="cal-week-hour-line" style={{ top: h * SLOT_H }} />
            ))}
            {timed.map(ev => (
              <div
                key={ev.id}
                className={`cal-week-event${ev.completed ? ' cal-pill--done' : ''}${ev.isSchedule ? ' cal-sched-event' : ''}`}
                style={{
                  top: topPx(ev),
                  height: heightPx(ev),
                  background: colorHex(ev.color),
                  width: 'calc(100% - 8px)',
                  opacity: ev.isSchedule ? 0.75 : 1,
                  cursor: 'pointer',
                }}
                onClick={e => { e.stopPropagation(); onEventClick(ev); }}
              >
                <span className="cal-week-event-title">{ev.title}</span>
                <span className="cal-week-event-time">
                  {fmtTime(ev.startAt)}{ev.endAt ? ` - ${fmtTime(ev.endAt)}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AgendaView ───────────────────────────────────────────────────────────────
function AgendaView({ events, onEventClick }) {
  const upcoming = [...events]
    .filter(e => eventStart(e))
    .sort((a, b) => eventStart(a) - eventStart(b));

  if (upcoming.length === 0) {
    return (
      <div className="cal-agenda-empty">
        No hay eventos. Hace click en un dia para agregar uno.
      </div>
    );
  }

  let lastDate = null;
  return (
    <div className="cal-agenda-list">
      {upcoming.map(ev => {
        const s = eventStart(ev);
        const dateKey = s.toDateString();
        const showDate = dateKey !== lastDate;
        lastDate = dateKey;
        return (
          <div key={ev.id}>
            {showDate && (
              <div className="cal-agenda-date-header">
                {DAYS_L[s.getDay()]}, {s.getDate()} {MONTHS[s.getMonth()]} {s.getFullYear()}
              </div>
            )}
            <div
              className={`cal-agenda-item${ev.completed ? ' cal-pill--done' : ''}`}
              onClick={() => onEventClick(ev)}
              style={{
                borderLeft: `4px solid ${colorHex(ev.color)}`,
                opacity: ev.isSchedule ? 0.85 : 1,
                cursor: 'pointer',
              }}
            >
              <div className="cal-agenda-item-time">
                {ev.allDay ? 'Todo el dia' : `${fmtTime(ev.startAt)}${ev.endAt ? ` - ${fmtTime(ev.endAt)}` : ''}`}
              </div>
              <div className="cal-agenda-item-title">
                {ev.isSchedule ? '📍 ' : ''}{ev.title}
                {ev.isSchedule && ev.scheduleData?.employee && <span style={{fontWeight:400,fontSize:12,marginLeft:6,color:'var(--muted)'}}>· {ev.scheduleData.employee.name}</span>}
              </div>
              {ev.content && <div className="cal-agenda-item-desc">{ev.content}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Notes Component ─────────────────────────────────────────────────────

// ── Modal de detalle de horario/clase (solo lectura) ─────────────────────────
const DAYS_ES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

function ScheduleDetailModal({ sched, onClose }) {
  if (!sched) return null;
  const activity = sched.activity || {};
  const employee = sched.employee || null;
  const branch   = sched.branch   || null;

  return (
    <div className="cal-modal-backdrop" onClick={onClose}>
      <div className="cal-modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div className="cal-modal-header" style={{ borderLeft: '4px solid var(--primary)' }}>
          <span className="cal-modal-title-input" style={{ fontWeight: 700, fontSize: 16 }}>
            📍 {activity.name || 'Clase'}
          </span>
          <button className="cal-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="cal-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Row label="Día"      value={DAYS_ES[sched.dayOfWeek] ?? '—'} />
            <Row label="Horario"  value={sched.startTime && sched.endTime ? `${sched.startTime} – ${sched.endTime}` : sched.startTime || '—'} />
            {employee && <Row label="Instructor" value={employee.name} />}
            {branch    && <Row label="Sede"      value={branch.name} />}
            {activity.price != null && <Row label="Precio" value={`$${Number(activity.price).toLocaleString('es-AR')}`} />}
            {activity.description && <Row label="Descripción" value={activity.description} />}
          </div>
        </div>
        <div className="cal-modal-footer" style={{ justifyContent: 'flex-end' }}>
          <button className="btn-secondary-sm" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span style={{ minWidth: 90, fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 14, color: 'var(--ink)' }}>{value}</span>
    </div>
  );
}

export default function Notes() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [view, setView] = useState('month');
  const [navDate, setNavDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { event, defaultDate }
  const [apptModal, setApptModal] = useState(null); // appointmentData
  const [scheduleModal, setScheduleModal] = useState(null); // scheduleData

  const [schedules, setSchedules] = useState([]);
  const [activityColorMap, setActivityColorMap] = useState({});
  const [appointments, setAppointments] = useState([]);

  const load = useCallback(async () => {
    try {
      const [notesRes, schedRes, apptRes] = await Promise.all([
        api.get('/notes'),
        api.get('/schedules'),
        api.get('/appointments'),
      ]);
      setEvents(notesRes.data);
      const scheds = schedRes.data;
      setSchedules(scheds);
      setAppointments(apptRes.data || []);
      // Build activity→color map
      const map = {};
      let idx = 0;
      scheds.forEach(s => {
        if (s.activityId && !(s.activityId in map)) {
          map[s.activityId] = colorForActivity(s.activityId, idx++);
        }
      });
      setActivityColorMap(map);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Merge notes with expanded schedule events for current view
  const allEvents = (() => {
    const range = getViewRange(view, navDate);
    const schedEvents = expandSchedules(schedules, range.from, range.to, activityColorMap);
    const apptEvents  = appointmentsToEvents(appointments);
    return [...events, ...schedEvents, ...apptEvents];
  })();

  async function handleSave(payload, id) {
    if (id) {
      const { data } = await api.put(`/notes/${id}`, payload);
      setEvents(prev => prev.map(e => e.id === id ? data : e));
    } else {
      const { data } = await api.post('/notes', payload);
      setEvents(prev => [...prev, data]);
    }
  }

  async function handleDelete(id) {
    await api.delete(`/notes/${id}`);
    setEvents(prev => prev.filter(e => e.id !== id));
  }

  function openNew(date, allDay = true) {
    setModal({ event: null, defaultDate: date || new Date(), defaultAllDay: allDay });
  }

  function openEdit(event) {
    if (event.isAppointment && event.appointmentData) {
      setApptModal(event.appointmentData);
      return;
    }
    if (event.isSchedule) { setScheduleModal(event.scheduleData); return; }
    setModal({ event, defaultDate: null });
  }

  // Navigation
  function navPrev() {
    if (view === 'month') {
      setNavDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    } else if (view === 'week') {
      setNavDate(d => addDays(d, -7));
    } else if (view === 'day') {
      setNavDate(d => addDays(d, -1));
    }
  }

  function navNext() {
    if (view === 'month') {
      setNavDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    } else if (view === 'week') {
      setNavDate(d => addDays(d, 7));
    } else if (view === 'day') {
      setNavDate(d => addDays(d, 1));
    }
  }

  function headerTitle() {
    if (view === 'month') {
      return `${MONTHS[navDate.getMonth()]} ${navDate.getFullYear()}`;
    }
    if (view === 'week') {
      const ws = startOfWeek(navDate);
      const we = addDays(ws, 6);
      if (ws.getMonth() === we.getMonth()) {
        return `${ws.getDate()} - ${we.getDate()} ${MONTHS[ws.getMonth()]} ${ws.getFullYear()}`;
      }
      return `${ws.getDate()} ${MONTHS[ws.getMonth()]} - ${we.getDate()} ${MONTHS[we.getMonth()]} ${ws.getFullYear()}`;
    }
    if (view === 'day') {
      return `${DAYS_L[navDate.getDay()]}, ${navDate.getDate()} ${MONTHS[navDate.getMonth()]} ${navDate.getFullYear()}`;
    }
    return 'Agenda';
  }

  if (loading) return <div className="page-spinner"><div className="spinner spinner-lg"></div><span>Cargando...</span></div>;

  return (
    <div className="cal-shell">
      {/* Toolbar */}
      <div className="cal-toolbar">
        <button className="cal-today-btn" onClick={() => setNavDate(new Date())}>Hoy</button>
        <button className="cal-nav-btn" onClick={navPrev}>&#8249;</button>
        <button className="cal-nav-btn" onClick={navNext}>&#8250;</button>
        <span className="cal-toolbar-title">{headerTitle()}</span>
        <div style={{ flex: 1 }} />
        {can.crear && <button className="cal-new-btn" onClick={() => openNew(navDate)}>+ Nuevo</button>}
        <div className="cal-view-tabs">
          {['month', 'week', 'day', 'agenda'].map(v => (
            <button
              key={v}
              className={`cal-view-tab${view === v ? ' active' : ''}`}
              onClick={() => setView(v)}
            >
              {v === 'month' ? 'Mes' : v === 'week' ? 'Semana' : v === 'day' ? 'Dia' : 'Lista'}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar body */}
      <div className="cal-body">
        {view === 'month' && (
          <MonthView
            navDate={navDate}
            events={allEvents}
            today={today}
            onDayClick={d => { setNavDate(d); openNew(d, true); }}
            onEventClick={openEdit}
          />
        )}
        {view === 'week' && (
          <WeekView
            navDate={navDate}
            events={allEvents}
            today={today}
            onSlotClick={(date, allDay) => openNew(date, allDay)}
            onEventClick={openEdit}
          />
        )}
        {view === 'day' && (
          <DayView
            navDate={navDate}
            events={allEvents}
            today={today}
            onSlotClick={(date, allDay) => openNew(date, allDay)}
            onEventClick={openEdit}
          />
        )}
        {view === 'agenda' && (
          <AgendaView events={allEvents} onEventClick={openEdit} />
        )}
      </div>

      {/* Modal */}
      {modal !== null && (
        <EventModal
          event={modal.event}
          defaultDate={modal.defaultDate}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
      {scheduleModal && (
        <ScheduleDetailModal
          sched={scheduleModal}
          onClose={() => setScheduleModal(null)}
        />
      )}
      {apptModal && (
        <ApptDetailModal
          appt={apptModal}
          onClose={() => setApptModal(null)}
          onUpdated={() => { setApptModal(null); load(); }}
        />
      )}
    </div>
  );
}

/* ── Detalle de turno desde la agenda ─────────────────────────── */
function ApptDetailModal({ appt, onClose, onUpdated }) {
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(appt.status || 'scheduled');
  const [notes, setNotes] = useState(appt.notes || '');
  const [error, setError] = useState('');

  const fmt = (v) => v ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v) : '—';
  const fmtDate = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  const STATUS_LABELS = { scheduled: 'Programado', confirmed: 'Confirmado', completed: 'Completado', cancelled: 'Cancelado' };
  const STATUS_COLORS = { scheduled: '#3b82f6', confirmed: '#10b981', completed: '#6366f1', cancelled: '#ef4444' };

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await api.put(`/appointments/${appt.id}`, { status, notes });
      onUpdated();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
      setSaving(false);
    }
  }

  async function handleCancel() {
    if (!confirm('¿Cancelar este turno?')) return;
    setSaving(true);
    try {
      await api.put(`/appointments/${appt.id}`, { status: 'cancelled' });
      onUpdated();
    } catch (e) {
      setError(e.response?.data?.error || 'Error');
      setSaving(false);
    }
  }

  return (
    <div className="cal-modal-backdrop">
      <div className="cal-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="cal-modal-header" style={{ borderLeft: `4px solid ${STATUS_COLORS[status] || '#6366f1'}` }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>
            {appt.service?.name || appt.description || 'Turno'}
          </span>
          <button className="cal-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="cal-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div className="error-banner">{error}</div>}

          {/* Info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Cliente</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{appt.client?.name || '—'}</div>
              {appt.client?.phone && <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{appt.client.phone}</div>}
            </div>
            <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Fecha</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{fmtDate(appt.date)}</div>
              {appt.startTime && <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{appt.startTime} – {appt.endTime}</div>}
            </div>
            {appt.employee && (
              <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Empleado</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{appt.employee.name}</div>
              </div>
            )}
            {appt.price > 0 && (
              <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Precio</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: appt.paymentStatus === 'paid' ? '#10b981' : 'var(--ink)' }}>
                  {fmt(appt.price)}
                  {appt.paymentStatus === 'paid' && <span style={{ marginLeft: 6, fontSize: 12 }}>✓ Cobrado</span>}
                </div>
              </div>
            )}
          </div>

          {/* Estado */}
          <div className="cal-modal-row">
            <label className="cal-modal-label">Estado</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14 }}
            >
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {/* Notas */}
          <div className="cal-modal-row cal-modal-row--col">
            <label className="cal-modal-label">Notas internas</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Observaciones, indicaciones..."
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div className="cal-modal-footer" style={{ flexWrap: 'wrap', gap: 8 }}>
          {appt.status !== 'cancelled' && can.eliminar && <button className="btn-danger-sm" onClick={handleCancel} disabled={saving}>Cancelar turno</button>}
          {appt.client?.phone && (() => {
            const phone = appt.client.phone.replace(/\D/g, '');
            const intlPhone = phone.startsWith('54') ? phone : `54${phone}`;
            const fmtDateShort = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' }) : '';
            const msg = `Hola ${appt.client.name}, te recordamos tu turno de ${appt.service?.name || 'servicio'} el ${fmtDateShort(appt.date)}${appt.startTime ? ' a las ' + appt.startTime : ''}. ¡Te esperamos! 🙌`;
            return (
              <a
                href={`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 8, textDecoration: 'none',
                  background: '#25d366', color: '#fff', fontWeight: 700, fontSize: 13,
                }}
              >
                📱 Recordatorio WA
              </a>
            );
          })()}
          <div style={{ flex: 1 }} />
          <button className="btn-secondary-sm" onClick={onClose}>Cerrar</button>
          <button className="btn-primary-sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
