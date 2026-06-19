import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAYS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function formatMoney(value) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value || 0);
}

// ── Schedule slot builder ────────────────────────────────────────────────────
function emptySlot() {
  return { id: null, days: [], startTime: '08:00', endTime: '09:00', employeeId: '', maxCapacity: '' };
}

function ScheduleBuilder({ slots, onChange, employees }) {
  function addSlot() { onChange([...slots, emptySlot()]); }
  function removeSlot(i) { onChange(slots.filter((_, idx) => idx !== i)); }
  function updateSlot(i, field, value) {
    onChange(slots.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  }
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
            <button type="button" onClick={() => removeSlot(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 18, lineHeight: 1 }}>×</button>
          </div>

          {/* Days */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {DAYS.map((d, idx) => (
              <button key={idx} type="button"
                onClick={() => toggleDay(i, idx)}
                style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid',
                  background: slot.days.includes(idx) ? 'var(--primary)' : 'transparent',
                  color: slot.days.includes(idx) ? '#fff' : 'var(--muted)',
                  borderColor: slot.days.includes(idx) ? 'var(--primary)' : 'var(--border)',
                }}>
                {d}
              </button>
            ))}
          </div>

          {/* Time + instructor */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <label style={{ fontSize: 12 }}>
              <span style={{ color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Inicio</span>
              <input type="time" value={slot.startTime} onChange={e => updateSlot(i, 'startTime', e.target.value)} className="input" />
            </label>
            <label style={{ fontSize: 12 }}>
              <span style={{ color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Fin</span>
              <input type="time" value={slot.endTime} onChange={e => updateSlot(i, 'endTime', e.target.value)} className="input" />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={{ fontSize: 12 }}>
              <span style={{ color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Instructor</span>
              <select value={slot.employeeId} onChange={e => updateSlot(i, 'employeeId', e.target.value)} className="input">
                <option value="">Sin asignar</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12 }}>
              <span style={{ color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Cupo máximo</span>
              <input type="number" min="0" value={slot.maxCapacity} onChange={e => updateSlot(i, 'maxCapacity', e.target.value)} className="input" placeholder="Sin límite" />
            </label>
          </div>
          {slot.days.length === 0 && <p style={{ fontSize: 11, color: '#f59e0b', marginTop: 6 }}>⚠️ Seleccioná al menos un día</p>}
        </div>
      ))}
      <button type="button" className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }} onClick={addSlot}>
        + Agregar horario
      </button>
    </div>
  );
}

// ── Save schedules helper ────────────────────────────────────────────────────
async function saveSchedules(activityId, branchId, slots, existingIds = []) {
  // Delete removed schedules
  for (const id of existingIds) {
    await api.delete(`/schedules/${id}`);
  }
  // Create new ones — expand each slot into one record per day
  for (const slot of slots) {
    if (slot.days.length === 0) continue;
    for (const day of slot.days) {
      await api.post('/schedules', {
        activityId,
        branchId: branchId || null,
        employeeId: slot.employeeId || null,
        dayOfWeek: day,
        startTime: slot.startTime,
        endTime: slot.endTime,
        maxCapacity: slot.maxCapacity ? Number(slot.maxCapacity) : null,
      });
    }
  }
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function Activities() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editActivity, setEditActivity] = useState(null);
  const [showInactive, setShowInactive] = useState(false);

  function load() {
    const url = showInactive ? '/activities?includeInactive=true' : '/activities';
    api.get(url).then((res) => setActivities(res.data)).finally(() => setLoading(false));
  }

  async function handleDeactivate(activity) {
    if (!window.confirm(`¿Dar de baja la actividad "${activity.name}"?`)) return;
    try {
      await api.put(`/activities/${activity.id}`, { ...activity, active: false });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al dar de baja');
    }
  }

  async function handleReactivate(activity) {
    try {
      await api.put(`/activities/${activity.id}`, { ...activity, active: true });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al reactivar');
    }
  }

  useEffect(load, [showInactive]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Actividades</h1>
          <p className="page-subtitle">Clases, servicios y horarios de tu negocio</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowInactive(!showInactive)} style={{ color: showInactive ? 'var(--primary)' : undefined }}>
            {showInactive ? 'Ver activas' : 'Ver dadas de baja'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nueva actividad</button>
        </div>
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : activities.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <h3>Todavía no creaste actividades</h3>
            <p>Una actividad puede ser una clase, un turno o un servicio que ofrezcas.</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ marginTop: 12 }}>+ Nueva actividad</button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap"><table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Sede</th>
                <th>Instructores</th>
                <th>Horarios</th>
                <th>Precio</th>
                <th>Inscriptos</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => (
                <tr key={a.id} style={{ opacity: a.active === false ? 0.5 : 1 }}>
                  <td><Link to={`/actividades/${a.id}`}>{a.name}</Link></td>
                  <td>{a.branch?.name || <span style={{color:'var(--ink-soft)'}}>-</span>}</td>
                  <td>{a.activityEmployees?.length > 0 ? a.activityEmployees.map(ae => ae.employee?.name).filter(Boolean).join(', ') : <span style={{color:'var(--ink-soft)'}}>-</span>}</td>
                  <td style={{ fontSize: 12 }}>
                    {a.classSchedules?.length > 0
                      ? a.classSchedules.map(cs => `${DAYS[cs.dayOfWeek]} ${cs.startTime}`).join(' · ')
                      : <span style={{color:'var(--ink-soft)'}}>-</span>}
                  </td>
                  <td>{formatMoney(a.price)}</td>
                  <td>{a._count?.enrollments ?? 0}{a.capacity ? ` / ${a.capacity}` : ''}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    {a.active !== false ? (
                      <>
                        <Link to={`/actividades/${a.id}`} className="btn btn-secondary btn-sm">Ver</Link>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditActivity(a)}>Editar</button>
                        <button className="btn btn-secondary btn-sm" style={{ color: '#ef4444' }} onClick={() => handleDeactivate(a)}>Dar de baja</button>
                      </>
                    ) : (
                      <button className="btn btn-secondary btn-sm" style={{ color: '#10b981' }} onClick={() => handleReactivate(a)}>Reactivar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {editActivity && (
        <ActivityModal
          activity={editActivity}
          onClose={() => setEditActivity(null)}
          onSaved={() => { setEditActivity(null); load(); }}
        />
      )}
      {showModal && (
        <ActivityModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

// ── Unified create/edit modal ─────────────────────────────────────────────────
function ActivityModal({ activity, onClose, onSaved }) {
  const isEdit = !!activity;
  const [form, setForm] = useState({
    name: activity?.name || '',
    description: activity?.description || '',
    price: activity?.price ?? '',
    capacity: activity?.capacity ?? '',
    branchId: activity?.branchId || '',
    active: activity?.active !== false,
  });
  const [branches, setBranches] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState(
    (activity?.activityEmployees || []).map(ae => ae.employeeId)
  );
  const [slots, setSlots] = useState([]);  // schedule slots
  const [existingScheduleIds, setExistingScheduleIds] = useState([]); // IDs to delete on edit
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/branches').then(r => setBranches(r.data.filter(b => b.active)));
    api.get('/employees').then(r => setEmployees(r.data.filter(e => e.active)));
    if (isEdit) {
      api.get(`/schedules?activityId=${activity.id}`).then(r => {
        const existing = r.data;
        setExistingScheduleIds(existing.map(s => s.id));
        // Group by startTime+endTime+employeeId to rebuild slots
        const grouped = {};
        existing.forEach(s => {
          const key = `${s.startTime}-${s.endTime}-${s.employeeId || ''}-${s.maxCapacity || ''}`;
          if (!grouped[key]) grouped[key] = { ...s, days: [] };
          grouped[key].days.push(s.dayOfWeek);
        });
        setSlots(Object.values(grouped).map(g => ({
          id: null,
          days: g.days.sort((a, b) => a - b),
          startTime: g.startTime,
          endTime: g.endTime,
          employeeId: g.employeeId || '',
          maxCapacity: g.maxCapacity ?? '',
        })));
      });
    }
  }, []);

  function update(field, value) { setForm(f => ({ ...f, [field]: value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    // Validate slots
    for (const s of slots) {
      if (s.days.length === 0) { setError('Un horario no tiene días seleccionados'); return; }
    }
    setError(''); setSaving(true);
    try {
      let activityId = activity?.id;
      if (isEdit) {
        await api.put(`/activities/${activityId}`, {
          name: form.name, description: form.description || undefined,
          price: Number(form.price), capacity: form.capacity !== '' ? Number(form.capacity) : null,
          active: form.active, branchId: form.branchId || null,
        });
        await api.put(`/activities/${activityId}/employees`, { employeeIds: selectedEmployees });
        // Replace all schedules
        await saveSchedules(activityId, form.branchId, slots, existingScheduleIds);
      } else {
        const res = await api.post('/activities', {
          name: form.name, description: form.description || undefined,
          price: Number(form.price), capacity: form.capacity ? Number(form.capacity) : null,
          branchId: form.branchId || null,
        });
        activityId = res.data.id;
        if (selectedEmployees.length > 0) {
          await api.put(`/activities/${activityId}/employees`, { employeeIds: selectedEmployees });
        }
        await saveSchedules(activityId, form.branchId, slots, []);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <h2>{isEdit ? 'Editar actividad' : 'Nueva actividad'}</h2>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nombre</label>
            <input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Ej: Spinning, Yoga, Pilates" required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Precio</label>
              <input type="number" min="0" step="0.01" value={form.price} onChange={e => update('price', e.target.value)} required />
            </div>
            <div className="field">
              <label>Cupo (opcional)</label>
              <input type="number" min="0" value={form.capacity} onChange={e => update('capacity', e.target.value)} placeholder="Sin límite" />
            </div>
          </div>
          <div className="field">
            <label>Descripción (opcional)</label>
            <textarea rows="2" value={form.description} onChange={e => update('description', e.target.value)} />
          </div>
          {branches.length > 0 && (
            <div className="field">
              <label>Sede</label>
              <select value={form.branchId} onChange={e => update('branchId', e.target.value)}>
                <option value="">Sin sede</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          {/* Instructors */}
          {employees.length > 0 && (
            <div className="field">
              <label>Instructores asignados a la actividad</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {employees.map(e => (
                  <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 14 }}>
                    <input type="checkbox" checked={selectedEmployees.includes(e.id)}
                      onChange={ev => setSelectedEmployees(prev => ev.target.checked ? [...prev, e.id] : prev.filter(x => x !== e.id))} />
                    {e.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Schedule builder */}
          <div className="field">
            <label style={{ marginBottom: 8, display: 'block' }}>Horarios semanales</label>
            <ScheduleBuilder slots={slots} onChange={setSlots} employees={employees} />
          </div>

          {isEdit && (
            <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <label>Activa</label>
              <input type="checkbox" checked={form.active} onChange={e => update('active', e.target.checked)} />
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear actividad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
