import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';
import { useSectionPerms } from '../config/permissions';

const statusLabels = {
  paid: 'Pagado',
  pending: 'Pendiente',
  overdue: 'Vencido',
};

function formatMoney(value) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value || 0);
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('es-AR');
}

export default function ActivityDetail() {
  const can = useSectionPerms('actividades');
  const canCob = useSectionPerms('cobranza');
  const { id } = useParams();
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [error, setError] = useState('');

  function load() {
    api.get(`/activities/${id}`).then((res) => setActivity(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  async function removeEnrollment(enrollmentId) {
    if (!confirm('¿Quitar a este cliente de la actividad?')) return;
    try {
      await api.delete(`/enrollments/${enrollmentId}`);
      load();
    } catch {
      setError('No se pudo quitar al cliente');
    }
  }

  if (loading) return <div className="page-spinner"><div className="spinner spinner-lg"></div><span>Cargando...</span></div>;
  if (!activity) return <p>Actividad no encontrada.</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{activity.name}</h1>
          <p className="page-subtitle">
            {activity.schedule || 'Sin horario definido'} · {formatMoney(activity.price)}
            {activity.capacity ? ` · Cupo ${activity.enrollments.length}/${activity.capacity}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {can.editar && <button className="btn btn-secondary" onClick={() => setShowEdit(true)}>Editar</button>}
          {can.inscribir && <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Inscribir cliente</button>}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        {activity.enrollments.length === 0 ? (
          <div className="empty-state">
            <h3>Nadie inscripto todavía</h3>
            <p>Inscribí clientes a esta actividad para empezar a seguir sus pagos.</p>
            {can.inscribir && <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ marginTop: 12 }}>
              + Inscribir cliente
            </button>}
          </div>
        ) : (
          <div className="table-wrap"><table className="table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Monto</th>
                <th>Vence</th>
                <th>Estado de pago</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {activity.enrollments.map((e) => (
                <tr key={e.id}>
                  <td><Link to={`/clientes/${e.clientId}`}>{e.client.name}</Link></td>
                  <td>{formatMoney(e.amountDue)}</td>
                  <td>{formatDate(e.dueDate)}</td>
                  <td>
                    <span className={`pill pill-${e.paymentStatus}`}>
                      {statusLabels[e.paymentStatus]}
                    </span>
                  </td>
                  <td>
                    {canCob.eliminar && <button className="btn-danger-text" onClick={() => removeEnrollment(e.id)}>Quitar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {showModal && (
        <EnrollModal
          activity={activity}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load(); }}
        />
      )}
      {showEdit && (
        <EditActivityModal
          activity={activity}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load(); }}
        />
      )}
    </div>
  );
}

function EnrollModal({ activity, onClose, onCreated }) {
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [amountDue, setAmountDue] = useState(activity.price);
  const [dueDate, setDueDate] = useState('');
  const [bonificada, setBonificada] = useState(false);
  const [sinLimite, setSinLimite] = useState(true);
  const [bonHasta, setBonHasta] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/clients').then((res) => {
      const enrolledIds = new Set(activity.enrollments.map((e) => e.clientId));
      const available = res.data.filter((c) => !enrolledIds.has(c.id));
      setClients(available);
      if (available.length > 0) setClientId(available[0].id);
    });
  }, [activity]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/enrollments', {
        clientId,
        activityId: activity.id,
        amountDue: Number(amountDue),
        dueDate: dueDate || undefined,
        bonificada,
        bonificadaHasta: bonificada && !sinLimite && bonHasta ? bonHasta : null,
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo inscribir al cliente');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Inscribir cliente</h2>
        {error && <div className="error-banner">{error}</div>}
        {clients.length === 0 ? (
          <div className="empty-state">
            <h3>No hay clientes disponibles</h3>
            <p>Todos tus clientes ya están inscriptos acá, o todavía no creaste ninguno.</p>
            <Link to="/clientes" className="btn btn-primary" style={{ marginTop: 12 }}>Ir a Clientes</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Cliente</label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Monto a pagar</label>
              <input type="number" min="0" step="0.01" value={amountDue} onChange={(e) => setAmountDue(e.target.value)} required />
            </div>
            <div className="field">
              <label>Fecha de vencimiento (opcional)</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 10, border: `2px solid ${bonificada ? '#10b981' : 'var(--border)'}`, background: bonificada ? '#f0fdf4' : 'var(--surface)', transition: 'all .15s' }}>
                <input type="checkbox" checked={bonificada} onChange={(e) => setBonificada(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#10b981' }} />
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Beca / Bonificación</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink-soft)' }}>Actividad sin costo o con precio reducido</p>
                </div>
              </label>
              {bonificada && (
                <div style={{ marginTop: 10, paddingLeft: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer', fontSize: 14 }}>
                    <input type="checkbox" checked={sinLimite} onChange={(e) => setSinLimite(e.target.checked)} style={{ width: 15, height: 15, accentColor: '#6366f1' }} />
                    Sin tiempo determinado
                  </label>
                  {!sinLimite && (
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Beca hasta</label>
                      <input type="date" value={bonHasta} onChange={(e) => setBonHasta(e.target.value)} required={!sinLimite} />
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Inscribiendo...' : 'Inscribir'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}


/* ── Editar Actividad ─────────────────────────────────────────── */
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
  const [selectedEmployees, setSelectedEmployees] = useState(
    (activity.activityEmployees || []).map(ae => ae.employeeId)
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/branches').then(r => setBranches(r.data.filter(b => b.active))).catch(() => {});
    api.get('/employees').then(r => setEmployees(r.data.filter(e => e.active))).catch(() => {});
  }, []);

  function update(field, value) { setForm(f => ({ ...f, [field]: value })); }

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
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Editar actividad</h2>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nombre</label>
            <input value={form.name} onChange={e => update('name', e.target.value)} required />
          </div>
          <div className="field">
            <label>Horario (opcional)</label>
            <input value={form.schedule} onChange={e => update('schedule', e.target.value)} placeholder="Ej: Lunes y miércoles 18:00" />
          </div>
          <div className="two-col-grid">
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
          {employees.length > 0 && (
            <div className="field">
              <label>Instructores asignados</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {employees.map(emp => (
                  <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={selectedEmployees.includes(emp.id)}
                      onChange={ev => setSelectedEmployees(prev =>
                        ev.target.checked ? [...prev, emp.id] : prev.filter(x => x !== emp.id)
                      )}
                    />
                    {emp.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
