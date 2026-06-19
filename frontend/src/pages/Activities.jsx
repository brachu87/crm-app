import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function fmtMoney(v) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v || 0);
}
function fmtDate(d) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
}
function calcEnd(startTime, duration) {
  const [h, m] = startTime.split(':').map(Number);
  const total = h * 60 + m + (duration || 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// ── STATUS configs ────────────────────────────────────────────────────────────
const STATUS_CFG = {
  scheduled: { label: 'Agendado', color: '#6366f1' },
  completed:  { label: 'Completado', color: '#10b981' },
  cancelled:  { label: 'Cancelado', color: '#6b7280' },
  'no-show':  { label: 'No asistió', color: '#f59e0b' },
};
const PAY_CFG = {
  pending: { label: 'Pendiente', color: '#f59e0b' },
  paid:    { label: 'Pagado', color: '#10b981' },
};

// ── ScheduleBuilder (reused from before) ─────────────────────────────────────
function emptySlot() { return { id: null, days: [], startTime: '08:00', endTime: '09:00', employeeId: '', maxCapacity: '' }; }

function ScheduleBuilder({ slots, onChange, employees }) {
  function addSlot() { onChange([...slots, emptySlot()]); }
  function removeSlot(i) { onChange(slots.filter((_, idx) => idx !== i)); }
  function updateSlot(i, field, value) { onChange(slots.map((s, idx) => idx === i ? { ...s, [field]: value } : s)); }
  function toggleDay(i, day) {
    const s = slots[i];
    const days = s.days.includes(day) ? s.days.filter(d => d !== day) : [...s.days, day].sort((a,b) => a-b);
    updateSlot(i, 'days', days);
  }
  return (
    <div>
      {slots.map((slot, i) => (
        <div key={i} style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', marginBottom: 10, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>Horario {i + 1}</span>
            <button type="button" onClick={() => removeSlot(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 18 }}>×</button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {DAYS.map((d, idx) => (
              <button key={idx} type="button" onClick={() => toggleDay(i, idx)}
                style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid',
                  background: slot.days.includes(idx) ? 'var(--primary)' : 'transparent',
                  color: slot.days.includes(idx) ? '#fff' : 'var(--muted)',
                  borderColor: slot.days.includes(idx) ? 'var(--primary)' : 'var(--border)' }}>
                {d}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <label style={{ fontSize: 12 }}><span style={{ color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Inicio</span>
              <input type="time" value={slot.startTime} onChange={e => updateSlot(i, 'startTime', e.target.value)} className="input" /></label>
            <label style={{ fontSize: 12 }}><span style={{ color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Fin</span>
              <input type="time" value={slot.endTime} onChange={e => updateSlot(i, 'endTime', e.target.value)} className="input" /></label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={{ fontSize: 12 }}><span style={{ color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Instructor</span>
              <select value={slot.employeeId} onChange={e => updateSlot(i, 'employeeId', e.target.value)} className="input">
                <option value="">Sin asignar</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select></label>
            <label style={{ fontSize: 12 }}><span style={{ color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Cupo máximo</span>
              <input type="number" min="0" value={slot.maxCapacity} onChange={e => updateSlot(i, 'maxCapacity', e.target.value)} className="input" placeholder="Sin límite" /></label>
          </div>
          {slot.days.length === 0 && <p style={{ fontSize: 11, color: '#f59e0b', marginTop: 6 }}>⚠️ Seleccioná al menos un día</p>}
        </div>
      ))}
      <button type="button" className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }} onClick={addSlot}>+ Agregar horario</button>
    </div>
  );
}

async function saveSchedules(activityId, branchId, slots, existingIds = []) {
  for (const id of existingIds) await api.delete(`/schedules/${id}`);
  for (const slot of slots) {
    if (slot.days.length === 0) continue;
    for (const day of slot.days) {
      await api.post('/schedules', {
        activityId, branchId: branchId || null,
        dayOfWeek: day, startTime: slot.startTime, endTime: slot.endTime,
        employeeId: slot.employeeId || null,
        maxCapacity: slot.maxCapacity ? parseInt(slot.maxCapacity) : null,
      });
    }
  }
}

// ── Activity Modal ────────────────────────────────────────────────────────────
function ActivityModal({ activity, branches, employees, onClose, onSaved }) {
  const isEdit = !!activity;
  const [form, setForm] = useState({ name: activity?.name || '', description: activity?.description || '', price: activity?.price || '', capacity: activity?.capacity || '', branchId: activity?.branchId || '', active: activity?.active ?? true });
  const [selectedEmployees, setSelectedEmployees] = useState(() => activity?.activityEmployees?.map(ae => ae.employeeId) || []);
  const [slots, setSlots] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/schedules?activityId=${activity.id}`).then(r => {
      const grouped = {};
      r.data.forEach(cs => {
        const key = `${cs.startTime}-${cs.endTime}-${cs.employeeId || ''}-${cs.maxCapacity || ''}`;
        if (!grouped[key]) grouped[key] = { id: cs.id, days: [], startTime: cs.startTime, endTime: cs.endTime, employeeId: cs.employeeId || '', maxCapacity: cs.maxCapacity || '' };
        grouped[key].days.push(cs.dayOfWeek);
      });
      setSlots(Object.values(grouped).map(s => ({ ...s, days: s.days.sort() })));
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      let saved;
      const payload = { name: form.name, description: form.description, price: parseFloat(form.price) || 0, capacity: form.capacity ? parseInt(form.capacity) : null, branchId: form.branchId || null, active: form.active };
      if (isEdit) { saved = await api.put(`/activities/${activity.id}`, payload); }
      else { saved = await api.post('/activities', payload); }
      const actId = saved.data.id;
      for (const empId of selectedEmployees) {
        try { await api.post(`/activities/${actId}/employees`, { employeeId: empId }); } catch {}
      }
      const existingIds = isEdit ? (await api.get(`/schedules?activityId=${actId}`)).data.map(s => s.id) : [];
      await saveSchedules(actId, form.branchId, slots, existingIds);
      onSaved();
    } catch (err) { setError(err.response?.data?.error || 'Error al guardar'); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <h2>{isEdit ? 'Editar actividad' : 'Nueva actividad'}</h2>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field"><label>Nombre</label><input value={form.name} onChange={e => update('name', e.target.value)} required /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field"><label>Precio</label><input type="number" min="0" step="0.01" value={form.price} onChange={e => update('price', e.target.value)} required /></div>
            <div className="field"><label>Cupo (opcional)</label><input type="number" min="0" value={form.capacity} onChange={e => update('capacity', e.target.value)} placeholder="Sin límite" /></div>
          </div>
          <div className="field"><label>Descripción (opcional)</label><textarea rows="2" value={form.description} onChange={e => update('description', e.target.value)} /></div>
          {branches.length > 0 && <div className="field"><label>Sede</label><select value={form.branchId} onChange={e => update('branchId', e.target.value)}><option value="">Sin sede</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>}
          {employees.length > 0 && (
            <div className="field"><label>Instructores</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {employees.map(e => (
                  <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 14 }}>
                    <input type="checkbox" checked={selectedEmployees.includes(e.id)} onChange={ev => setSelectedEmployees(prev => ev.target.checked ? [...prev, e.id] : prev.filter(x => x !== e.id))} />{e.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="field"><label style={{ marginBottom: 8, display: 'block' }}>Horarios semanales</label>
            <ScheduleBuilder slots={slots} onChange={setSlots} employees={employees} /></div>
          {isEdit && <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><label>Activa</label><input type="checkbox" checked={form.active} onChange={e => update('active', e.target.checked)} /></div>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : isEdit ? 'Guardar' : 'Crear'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Service Modal ─────────────────────────────────────────────────────────────
function ServiceModal({ service, employees, onClose, onSaved }) {
  const isEdit = !!service;
  const [form, setForm] = useState({ name: service?.name || '', description: service?.description || '', duration: service?.duration || 60, price: service?.price || '', employeeId: service?.employeeId || '', active: service?.active ?? true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const payload = { name: form.name, description: form.description || null, duration: parseInt(form.duration), price: parseFloat(form.price) || 0, employeeId: form.employeeId || null, ...(isEdit ? { active: form.active } : {}) };
      if (isEdit) await api.put(`/services/${service.id}`, payload);
      else await api.post('/services', payload);
      onSaved();
    } catch (err) { setError(err.response?.data?.error || 'Error al guardar'); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <h2>{isEdit ? 'Editar servicio' : 'Nuevo servicio'}</h2>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field"><label>Nombre del servicio</label><input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Ej: Masaje 60 min, Osteopatía inicial" required /></div>
          <div className="field"><label>Descripción (opcional)</label><textarea rows="2" value={form.description} onChange={e => update('description', e.target.value)} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field"><label>Duración (minutos)</label><input type="number" min="5" step="5" value={form.duration} onChange={e => update('duration', e.target.value)} required /></div>
            <div className="field"><label>Precio base</label><input type="number" min="0" step="0.01" value={form.price} onChange={e => update('price', e.target.value)} placeholder="0" /></div>
          </div>
          {employees.length > 0 && <div className="field"><label>Prestador por defecto</label><select value={form.employeeId} onChange={e => update('employeeId', e.target.value)}><option value="">Sin asignar</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>}
          {isEdit && <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><label>Activo</label><input type="checkbox" checked={form.active} onChange={e => update('active', e.target.checked)} /></div>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : isEdit ? 'Guardar' : 'Crear servicio'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Appointment Modal ─────────────────────────────────────────────────────────
function AppointmentModal({ service, appointment, clients, employees, onClose, onSaved }) {
  const isEdit = !!appointment;
  const todayISO = new Date().toISOString().split('T')[0];
  const defaultEnd = calcEnd('09:00', service?.duration || 60);
  const [form, setForm] = useState({
    clientId: appointment?.clientId || '',
    employeeId: appointment?.employeeId || service?.employeeId || '',
    date: appointment?.date || todayISO,
    startTime: appointment?.startTime || '09:00',
    endTime: appointment?.endTime || defaultEnd,
    price: appointment?.price ?? service?.price ?? '',
    notes: appointment?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function onTimeChange(startTime) {
    const end = calcEnd(startTime, service?.duration || 60);
    setForm(f => ({ ...f, startTime, endTime: end }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.clientId) { setError('Seleccioná un cliente'); return; }
    setSaving(true); setError('');
    try {
      const payload = { serviceId: service.id, clientId: form.clientId, employeeId: form.employeeId || null, date: form.date, startTime: form.startTime, endTime: form.endTime, price: parseFloat(form.price) || 0, notes: form.notes || null };
      if (isEdit) await api.put(`/appointments/${appointment.id}`, payload);
      else await api.post('/appointments', payload);
      onSaved();
    } catch (err) { setError(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <h2>{isEdit ? 'Editar turno' : `Nuevo turno — ${service?.name}`}</h2>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field"><label>Cliente</label>
            <select value={form.clientId} onChange={e => update('clientId', e.target.value)} required>
              <option value="">Seleccionar cliente...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {employees.length > 0 && <div className="field"><label>Prestador</label><select value={form.employeeId} onChange={e => update('employeeId', e.target.value)}><option value="">Sin asignar</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>}
          <div className="field"><label>Fecha</label><input type="date" value={form.date} onChange={e => update('date', e.target.value)} required /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field"><label>Inicio</label><input type="time" value={form.startTime} onChange={e => onTimeChange(e.target.value)} required /></div>
            <div className="field"><label>Fin</label><input type="time" value={form.endTime} onChange={e => update('endTime', e.target.value)} required /></div>
          </div>
          <div className="field"><label>Precio</label><input type="number" min="0" step="0.01" value={form.price} onChange={e => update('price', e.target.value)} /></div>
          <div className="field"><label>Notas (opcional)</label><textarea rows="2" value={form.notes} onChange={e => update('notes', e.target.value)} /></div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : isEdit ? 'Guardar' : 'Agendar turno'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Appointments Panel ────────────────────────────────────────────────────────
function AppointmentsPanel({ service, clients, employees, onClose }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('upcoming'); // upcoming | all | completed

  function load() {
    setLoading(true);
    api.get(`/appointments?serviceId=${service.id}`).then(r => setAppointments(r.data)).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [service.id]);

  async function updateAppt(id, data) {
    const res = await api.put(`/appointments/${id}`, data);
    setAppointments(prev => prev.map(a => a.id === id ? res.data : a));
  }
  async function deleteAppt(id) {
    if (!confirm('¿Eliminar este turno?')) return;
    await api.delete(`/appointments/${id}`);
    setAppointments(prev => prev.filter(a => a.id !== id));
  }

  function sendWhatsApp(appt) {
    const phone = (appt.client?.phone || '').replace(/\D/g, '');
    const dateLabel = fmtDate(appt.date);
    const lines = [`📅 *Turno confirmado — ${service.name}*`, ``, `👤 ${appt.client?.name}`, `🗓 ${dateLabel} · ${appt.startTime}–${appt.endTime}`, appt.employee ? `👩‍⚕️ ${appt.employee.name}` : '', `💵 ${fmtMoney(appt.price)}`, appt.notes ? `📝 ${appt.notes}` : ''].filter(Boolean).join('\n');
    const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(lines)}` : `https://wa.me/?text=${encodeURIComponent(lines)}`;
    window.open(url, '_blank');
  }

  const today = new Date().toISOString().split('T')[0];
  const filtered = appointments.filter(a => {
    if (filter === 'upcoming') return a.status === 'scheduled' && a.date >= today;
    if (filter === 'completed') return a.status === 'completed';
    return true;
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0008', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
      <div style={{ background: 'var(--surface)', width: '100%', maxWidth: 600, height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 32px #0003' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{service.name}</h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>{service.duration} min · {fmtMoney(service.price)} base</p>
          </div>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>+ Nuevo turno</button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--muted)', lineHeight: 1 }}>×</button>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 2, padding: '12px 24px 0', borderBottom: '1px solid var(--border)' }}>
          {[['upcoming','Próximos'],['all','Todos'],['completed','Completados']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} style={{ padding: '6px 14px', borderRadius: '8px 8px 0 0', border: '1px solid', borderBottom: 'none', cursor: 'pointer', fontSize: 13, fontWeight: filter === v ? 700 : 400, background: filter === v ? 'var(--surface)' : 'var(--bg)', borderColor: filter === v ? 'var(--border)' : 'transparent', color: filter === v ? 'var(--primary)' : 'var(--muted)' }}>{l}</button>
          ))}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {loading ? <p style={{ color: 'var(--muted)' }}>Cargando...</p>
          : filtered.length === 0 ? <p style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 40 }}>No hay turnos {filter === 'upcoming' ? 'próximos' : ''}</p>
          : filtered.map(a => (
            <div key={a.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{a.client?.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>{fmtDate(a.date)} · {a.startTime}–{a.endTime}{a.employee ? ` · ${a.employee.name}` : ''}</div>
                  {a.notes && <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', marginTop: 2 }}>{a.notes}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{fmtMoney(a.price)}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ background: STATUS_CFG[a.status]?.color + '22', color: STATUS_CFG[a.status]?.color, padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>{STATUS_CFG[a.status]?.label}</span>
                <span style={{ background: PAY_CFG[a.paymentStatus]?.color + '22', color: PAY_CFG[a.paymentStatus]?.color, padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>{PAY_CFG[a.paymentStatus]?.label}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {a.status === 'scheduled' && (<>
                    <button className="btn btn-secondary btn-sm" onClick={() => updateAppt(a.id, { status: 'completed' })}>✅ Completar</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => updateAppt(a.id, { status: 'cancelled' })}>✗ Cancelar</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => updateAppt(a.id, { status: 'no-show' })}>👻 No asistió</button>
                  </>)}
                  {a.paymentStatus === 'pending' && a.status !== 'cancelled' && (
                    <button className="btn btn-primary btn-sm" onClick={() => updateAppt(a.id, { paymentStatus: 'paid' })}>💵 Cobrar</button>
                  )}
                  <button className="btn btn-secondary btn-sm" style={{ background: '#25d366', color: '#fff', borderColor: '#25d366' }} onClick={() => sendWhatsApp(a)}>📲</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(a); setShowModal(true); }}>✏️</button>
                  <button className="btn btn-secondary btn-sm" style={{ color: '#ef4444' }} onClick={() => deleteAppt(a.id)}>🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <AppointmentModal
          service={service} appointment={editing} clients={clients} employees={employees}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={() => { setShowModal(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Activities() {
  const [tab, setTab] = useState('actividades');
  // Activities state
  const [activities, setActivities] = useState([]);
  const [showActModal, setShowActModal] = useState(false);
  const [editingAct, setEditingAct] = useState(null);
  // Services state
  const [services, setServices] = useState([]);
  const [showSvcModal, setShowSvcModal] = useState(false);
  const [editingSvc, setEditingSvc] = useState(null);
  const [activePanel, setActivePanel] = useState(null); // service for appointments panel
  // Shared
  const [branches, setBranches] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  function loadAll() {
    setLoading(true);
    Promise.all([
      api.get('/activities'),
      api.get('/services'),
      api.get('/branches').catch(() => ({ data: [] })),
      api.get('/employees'),
      api.get('/clients'),
    ]).then(([actR, svcR, brR, empR, cliR]) => {
      setActivities(actR.data);
      setServices(svcR.data);
      setBranches(brR.data.filter(b => b.active !== false));
      setEmployees(empR.data.filter(e => e.active !== false));
      setClients(cliR.data.filter(c => c.active !== false));
    }).finally(() => setLoading(false));
  }
  useEffect(() => { loadAll(); }, []);

  async function toggleActivity(act) {
    await api.put(`/activities/${act.id}`, { active: !act.active });
    setActivities(prev => prev.map(a => a.id === act.id ? { ...a, active: !a.active } : a));
  }
  async function toggleService(svc) {
    await api.put(`/services/${svc.id}`, { active: !svc.active });
    setServices(prev => prev.map(s => s.id === svc.id ? { ...s, active: !s.active } : s));
  }

  const visibleActivities = activities.filter(a => showInactive ? true : a.active !== false);
  const visibleServices = services.filter(s => showInactive ? true : s.active !== false);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Actividades y Servicios</h1>
          <p className="page-subtitle">Gestioná tus actividades con cuota mensual y servicios por turno</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Ver inactivos
          </label>
          {tab === 'actividades'
            ? <button className="btn btn-primary" onClick={() => { setEditingAct(null); setShowActModal(true); }}>+ Nueva actividad</button>
            : <button className="btn btn-primary" onClick={() => { setEditingSvc(null); setShowSvcModal(true); }}>+ Agregar servicio</button>
          }
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid var(--border)' }}>
        {[['actividades','🏋️ Actividades (cuota mensual)'],['servicios','💆 Servicios (por turno)']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} style={{ padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: tab === v ? 700 : 400, color: tab === v ? 'var(--primary)' : 'var(--muted)', borderBottom: `2px solid ${tab === v ? 'var(--primary)' : 'transparent'}`, marginBottom: -2 }}>{l}</button>
        ))}
      </div>

      {loading ? <p style={{ color: 'var(--muted)' }}>Cargando...</p> : (

        tab === 'actividades' ? (
          // ── ACTIVIDADES ──────────────────────────────────────────────────────
          visibleActivities.length === 0
            ? <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>No hay actividades. Creá la primera.</div>
            : <div className="card table-wrap">
                <table className="table">
                  <thead><tr><th>Nombre</th><th>Precio/mes</th><th>Cupo</th><th>Horarios</th><th>Estado</th><th></th></tr></thead>
                  <tbody>
                    {visibleActivities.map(act => (
                      <tr key={act.id} style={{ opacity: act.active === false ? 0.5 : 1 }}>
                        <td><Link to={`/actividades/${act.id}`} style={{ fontWeight: 600 }}>{act.name}</Link>{act.description && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{act.description}</div>}</td>
                        <td>{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(act.price)}</td>
                        <td>{act.capacity ?? '—'}</td>
                        <td style={{ fontSize: 12 }}>
                          {act.classSchedules?.length > 0
                            ? act.classSchedules.slice(0, 3).map(cs => <span key={cs.id} style={{ display: 'block' }}>{DAYS[cs.dayOfWeek]} {cs.startTime}</span>)
                            : <span style={{ color: 'var(--muted)' }}>Sin horarios</span>}
                        </td>
                        <td><span style={{ background: act.active !== false ? '#d1fae5' : '#fee2e2', color: act.active !== false ? '#065f46' : '#991b1b', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>{act.active !== false ? 'Activa' : 'Inactiva'}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => { setEditingAct(act); setShowActModal(true); }}>Editar</button>
                            <button className="btn btn-secondary btn-sm" style={{ color: act.active !== false ? '#ef4444' : '#10b981' }} onClick={() => toggleActivity(act)}>{act.active !== false ? 'Desactivar' : 'Activar'}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        ) : (
          // ── SERVICIOS ────────────────────────────────────────────────────────
          visibleServices.length === 0
            ? <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>No hay servicios. Agregá el primero.</div>
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {visibleServices.map(svc => (
                  <div key={svc.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, opacity: svc.active ? 1 : 0.5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 2 }}>{svc.name}</div>
                        {svc.description && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{svc.description}</div>}
                      </div>
                      <span style={{ background: svc.active ? '#d1fae5' : '#fee2e2', color: svc.active ? '#065f46' : '#991b1b', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{svc.active ? 'Activo' : 'Inactivo'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 14 }}>
                      <div><span style={{ color: 'var(--muted)', fontSize: 12 }}>Duración</span><br /><strong>⏱ {svc.duration} min</strong></div>
                      <div><span style={{ color: 'var(--muted)', fontSize: 12 }}>Precio base</span><br /><strong style={{ color: 'var(--accent)' }}>{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(svc.price)}</strong></div>
                      {svc.employee && <div><span style={{ color: 'var(--muted)', fontSize: 12 }}>Prestador</span><br /><strong>{svc.employee.name}</strong></div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => setActivePanel(svc)}>📅 Ver turnos</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setEditingSvc(svc); setShowSvcModal(true); }}>✏️ Editar</button>
                      <button className="btn btn-secondary btn-sm" style={{ color: svc.active ? '#ef4444' : '#10b981' }} onClick={() => toggleService(svc)}>{svc.active ? 'Desactivar' : 'Activar'}</button>
                    </div>
                  </div>
                ))}
              </div>
        )
      )}

      {showActModal && (
        <ActivityModal activity={editingAct} branches={branches} employees={employees}
          onClose={() => { setShowActModal(false); setEditingAct(null); }}
          onSaved={() => { setShowActModal(false); setEditingAct(null); loadAll(); }} />
      )}
      {showSvcModal && (
        <ServiceModal service={editingSvc} employees={employees}
          onClose={() => { setShowSvcModal(false); setEditingSvc(null); }}
          onSaved={() => { setShowSvcModal(false); setEditingSvc(null); loadAll(); }} />
      )}
      {activePanel && (
        <AppointmentsPanel service={activePanel} clients={clients} employees={employees} onClose={() => setActivePanel(null)} />
      )}
    </div>
  );
}
