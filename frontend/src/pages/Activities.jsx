import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

function formatMoney(value) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value || 0);
}

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
    if (!window.confirm(`¿Dar de baja la actividad "${activity.name}"? Va a dejar de aparecer en la lista.`)) return;
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
            <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ marginTop: 12 }}>
              + Nueva actividad
            </button>
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
        <EditActivityModal
          activity={editActivity}
          onClose={() => setEditActivity(null)}
          onSaved={() => { setEditActivity(null); load(); }}
        />
      )}
      {showModal && (
        <NewActivityModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

function NewActivityModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', description: '', price: '', capacity: '', schedule: '', branchId: '' });
  const [branches, setBranches] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  useEffect(() => {
    api.get('/branches').then(r => setBranches(r.data.filter(b => b.active)));
    api.get('/employees').then(r => setEmployees(r.data.filter(e => e.active)));
  }, []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await api.post('/activities', {
        name: form.name,
        description: form.description || undefined,
        price: Number(form.price),
        capacity: form.capacity ? Number(form.capacity) : null,
        schedule: form.schedule || undefined,
        branchId: form.branchId || null,
      });
      if (selectedEmployees.length > 0) {
        await api.put(`/activities/${res.data.id}/employees`, { employeeIds: selectedEmployees });
      }
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear la actividad');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Nueva actividad</h2>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nombre</label>
            <input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Ej: Spinning Lunes 18hs" required />
          </div>
          <div className="field">
            <label>Horario (opcional)</label>
            <input value={form.schedule} onChange={(e) => update('schedule', e.target.value)} placeholder="Ej: Lunes y miércoles 18:00" />
          </div>
          <div className="field">
            <label>Precio</label>
            <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => update('price', e.target.value)} required />
          </div>
          <div className="field">
            <label>Cupo (opcional)</label>
            <input type="number" min="0" value={form.capacity} onChange={(e) => update('capacity', e.target.value)} placeholder="Sin límite" />
          </div>
          <div className="field">
            <label>Descripción (opcional)</label>
            <textarea rows="2" value={form.description} onChange={(e) => update('description', e.target.value)} />
          </div>
          {branches.length > 0 && <div className="field">
            <label>Sede</label>
            <select value={form.branchId} onChange={e => update('branchId', e.target.value)}>
              <option value="">Sin sede</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>}
          {employees.length > 0 && <div className="field">
            <label>Instructores asignados</label>
            <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
              {employees.map(e => (
                <label key={e.id} style={{display:'flex',alignItems:'center',gap:4,cursor:'pointer',fontSize:14}}>
                  <input type="checkbox" checked={selectedEmployees.includes(e.id)}
                    onChange={ev => setSelectedEmployees(prev => ev.target.checked ? [...prev, e.id] : prev.filter(x => x !== e.id))} />
                  {e.name}
                </label>
              ))}
            </div>
          </div>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creando...' : 'Crear actividad'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}


function EditActivityModal({ activity, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: activity.name || '',
    description: activity.description || '',
    price: activity.price ?? '',
    capacity: activity.capacity ?? '',
    schedule: activity.schedule || '',
    active: activity.active !== false,
    branchId: activity.branchId || '',
  });
  const [branches, setBranches] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState((activity.activityEmployees || []).map(ae => ae.employeeId));
  useEffect(() => {
    api.get('/branches').then(r => setBranches(r.data.filter(b => b.active)));
    api.get('/employees').then(r => setEmployees(r.data.filter(e => e.active)));
  }, []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.put(`/activities/${activity.id}`, {
        name: form.name,
        description: form.description || undefined,
        price: Number(form.price),
        capacity: form.capacity !== '' ? Number(form.capacity) : null,
        schedule: form.schedule || undefined,
        active: form.active,
        branchId: form.branchId || null,
      });
      await api.put(`/activities/${activity.id}/employees`, { employeeIds: selectedEmployees });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Editar actividad</h2>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nombre</label>
            <input value={form.name} onChange={(e) => update('name', e.target.value)} required />
          </div>
          <div className="field">
            <label>Horario (opcional)</label>
            <input value={form.schedule} onChange={(e) => update('schedule', e.target.value)} placeholder="Ej: Lunes y miercoles 18:00" />
          </div>
          <div className="field">
            <label>Precio</label>
            <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => update('price', e.target.value)} required />
          </div>
          <div className="field">
            <label>Cupo (opcional)</label>
            <input type="number" min="0" value={form.capacity} onChange={(e) => update('capacity', e.target.value)} placeholder="Sin limite" />
          </div>
          <div className="field">
            <label>Descripcion (opcional)</label>
            <textarea rows="2" value={form.description} onChange={(e) => update('description', e.target.value)} />
          </div>
          {branches.length > 0 && <div className="field">
            <label>Sede</label>
            <select value={form.branchId} onChange={e => update('branchId', e.target.value)}>
              <option value="">Sin sede</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>}
          {employees.length > 0 && <div className="field">
            <label>Instructores asignados</label>
            <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
              {employees.map(e => (
                <label key={e.id} style={{display:'flex',alignItems:'center',gap:4,cursor:'pointer',fontSize:14}}>
                  <input type="checkbox" checked={selectedEmployees.includes(e.id)}
                    onChange={ev => setSelectedEmployees(prev => ev.target.checked ? [...prev, e.id] : prev.filter(x => x !== e.id))} />
                  {e.name}
                </label>
              ))}
            </div>
          </div>}
          <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <label>Activa</label>
            <input type="checkbox" checked={form.active} onChange={(e) => update('active', e.target.checked)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
