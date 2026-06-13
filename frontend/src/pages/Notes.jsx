import { useEffect, useState, useRef, useCallback } from 'react';
import api from '../api';

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
    dueDate: fmtDate(base),
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
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      content: form.content || null,
      allDay: form.allDay,
      color: form.color,
      priority: form.priority,
      completed: form.completed,
      dueDate: form.allDay ? form.dueDate : null,
      startAt: form.allDay
        ? (form.dueDate ? new Date(form.dueDate).toISOString() : null)
        : (form.startAt ? new Date(form.startAt).toISOString() : null),
      endAt: form.allDay ? null : (form.endAt ? new Date(form.endAt).toISOString() : null),
    };
    await onSave(payload, event?.id);
    onClose();
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
          {!isNew && (
            <button className="btn-danger-sm" onClick={() => { onDelete(event.id); onClose(); }}>
              Eliminar
            </button>
          )}
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
              style={{ background: colorHex(ev.color) }}
              onClick={e => { e.stopPropagation(); onEventClick(ev); }}
              title={ev.title}
            >
              {!ev.allDay && ev.startAt && (
                <span className="cal-pill-time">{fmtTime(ev.startAt)}</span>
              )}
              {ev.title}
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
                  className={`cal-week-event${ev.completed ? ' cal-pill--done' : ''}`}
                  style={{
                    top: topPct(ev),
                    height: heightPx(ev),
                    background: colorHex(ev.color),
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
                className={`cal-week-event${ev.completed ? ' cal-pill--done' : ''}`}
                style={{
                  top: topPx(ev),
                  height: heightPx(ev),
                  background: colorHex(ev.color),
                  width: 'calc(100% - 8px)',
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
              style={{ borderLeft: `4px solid ${colorHex(ev.color)}` }}
            >
              <div className="cal-agenda-item-time">
                {ev.allDay ? 'Todo el dia' : `${fmtTime(ev.startAt)}${ev.endAt ? ` - ${fmtTime(ev.endAt)}` : ''}`}
              </div>
              <div className="cal-agenda-item-title">{ev.title}</div>
              {ev.content && <div className="cal-agenda-item-desc">{ev.content}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Notes Component ─────────────────────────────────────────────────────
export default function Notes() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [view, setView] = useState('month');
  const [navDate, setNavDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { event, defaultDate }

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/notes');
      setEvents(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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

  if (loading) return <div className="page-loading">Cargando...</div>;

  return (
    <div className="cal-shell">
      {/* Toolbar */}
      <div className="cal-toolbar">
        <button className="cal-today-btn" onClick={() => setNavDate(new Date())}>Hoy</button>
        <button className="cal-nav-btn" onClick={navPrev}>&#8249;</button>
        <button className="cal-nav-btn" onClick={navNext}>&#8250;</button>
        <span className="cal-toolbar-title">{headerTitle()}</span>
        <div style={{ flex: 1 }} />
        <button className="cal-new-btn" onClick={() => openNew(navDate)}>+ Nuevo</button>
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
            events={events}
            today={today}
            onDayClick={d => { setNavDate(d); openNew(d, true); }}
            onEventClick={openEdit}
          />
        )}
        {view === 'week' && (
          <WeekView
            navDate={navDate}
            events={events}
            today={today}
            onSlotClick={(date, allDay) => openNew(date, allDay)}
            onEventClick={openEdit}
          />
        )}
        {view === 'day' && (
          <DayView
            navDate={navDate}
            events={events}
            today={today}
            onSlotClick={(date, allDay) => openNew(date, allDay)}
            onEventClick={openEdit}
          />
        )}
        {view === 'agenda' && (
          <AgendaView events={events} onEventClick={openEdit} />
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
    </div>
  );
}
