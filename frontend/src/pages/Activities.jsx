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

  function load() {
    api.get('/activities').then((res) => setActivities(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Actividades</h1>
          <p className="page-subtitle">Clases, servicios y horarios de tu negocio</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nueva actividad</button>
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
                <th>Horario</th>
                <th>Precio</th>
                <th>Inscriptos</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => (
                <tr key={a.id}>
                  <td><Link to={`/actividades/${a.id}`}>{a.name}</Link></td>
                  <td>{a.schedule || '-'}</td>
                  <td>{formatMoney(a.price)}</td>
                  <td>{a._count?.enrollments ?? 0}{a.capacity ? ` / ${a.capacity}` : ''}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <Link to={`/actividades/${a.id}`} className="btn btn-secondary btn-sm">Ver</Link>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditActivity(a)}>Editar</button>
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
  const [form, setForm] = useState({ name: '', description: '', price: '', capacity: '', schedule: '' });
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
      await api.post('/activities', {
        name: form.name,
        description: form.description || undefined,
        price: Number(form.price),
        capacity: form.capacity ? Number(form.capacity) : null,
        schedule: form.schedule || undefined,
      });
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
  });
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
      });
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
