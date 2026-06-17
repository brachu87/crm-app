import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

const statusLabels = { paid: 'Pagado', pending: 'Pendiente', overdue: 'Vencido' };

const filters = [
  { value: '', label: 'Todos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'overdue', label: 'Vencidos' },
  { value: 'paid', label: 'Pagados' },
  { value: 'proximas', label: '⏰ Próximas a vencer' },
];

export const DEFAULT_TEMPLATES = [
  {
    id: 'cobranza',
    name: 'Recordatorio de pago',
    text: 'Hola {nombre}! Te recordamos que tenés pendiente el pago de {actividad} por {monto}. Vencimiento: {vencimiento}. Cualquier consulta estamos a disposición. ¡Gracias!',
  },
  {
    id: 'vencido',
    name: 'Cuota vencida',
    text: 'Hola {nombre}! Tu cuota de {actividad} por {monto} se encuentra vencida desde el {vencimiento}. Te pedimos que regularices tu situación a la brevedad. ¡Gracias!',
  },
  {
    id: 'previo',
    name: 'Aviso previo al vencimiento',
    text: 'Hola {nombre}! Te avisamos que tu cuota de {actividad} ({monto}) vence el {vencimiento}. ¡Gracias por tu puntualidad!',
  },
  {
    id: 'generico',
    name: 'Mensaje genérico',
    text: 'Hola {nombre}! Queremos contactarte respecto a tu inscripción en {actividad}. ¡Escribinos cuando puedas!',
  },
];

export function getTemplates() {
  try {
    const stored = localStorage.getItem('wa_templates');
    return stored ? JSON.parse(stored) : DEFAULT_TEMPLATES;
  } catch {
    return DEFAULT_TEMPLATES;
  }
}

function fillTemplate(text, vars) {
  return text
    .replace(/{nombre}/g, vars.nombre || '')
    .replace(/{actividad}/g, vars.actividad || '')
    .replace(/{monto}/g, vars.monto || '')
    .replace(/{vencimiento}/g, vars.vencimiento || '');
}

function buildWaLink(phone, message) {
  const cleaned = phone.replace(/\D/g, '');
  const num = cleaned.startsWith('0')
    ? '549' + cleaned.slice(1)
    : cleaned.startsWith('54')
    ? cleaned
    : '549' + cleaned;
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

function formatMoney(value) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value || 0);
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('es-AR');
}

function TemplateModal({ enrollment, onClose }) {
  const templates = getTemplates();
  const [selectedId, setSelectedId] = useState(templates[0]?.id);
  const net = Math.max(0, enrollment.amountDue - (enrollment.discount || 0));

  const vars = {
    nombre: enrollment.client.name,
    actividad: enrollment.activity.name,
    monto: formatMoney(net),
    vencimiento: formatDate(enrollment.dueDate),
  };

  const selected = templates.find((t) => t.id === selectedId) || templates[0];
  const preview = selected ? fillTemplate(selected.text, vars) : '';
  const waHref = buildWaLink(enrollment.client.phone, preview);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: 4 }}>Enviar por WhatsApp</h2>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16 }}>
          Para <strong>{enrollment.client.name}</strong> — {enrollment.activity.name}
        </p>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>
            Plantilla
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {templates.map((t) => (
              <label
                key={t.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                  padding: '10px 12px', borderRadius: 8, border: `1px solid ${selectedId === t.id ? 'var(--primary)' : 'var(--border)'}`,
                  background: selectedId === t.id ? 'var(--primary-soft)' : 'var(--surface)',
                  transition: 'all .15s',
                }}
              >
                <input
                  type="radio"
                  name="template"
                  value={t.id}
                  checked={selectedId === t.id}
                  onChange={() => setSelectedId(t.id)}
                  style={{ marginTop: 2, accentColor: 'var(--primary)' }}
                />
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{t.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink-soft)' }}>
                    {t.text.slice(0, 70)}{t.text.length > 70 ? '…' : ''}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>
            Vista previa del mensaje
          </label>
          <div style={{
            background: '#dcfce7', borderRadius: 10, padding: '12px 14px', fontSize: 13,
            lineHeight: 1.5, color: '#14532d', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {preview}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
            onClick={onClose}
            style={{ textDecoration: 'none' }}
          >
            💬 Abrir WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

export default function Collections() {
  const [enrollments, setEnrollments] = useState([]);
  const [status, setStatus] = useState('pending');
  const [dias, setDias] = useState(7);
  const [loading, setLoading] = useState(true);
  const [renewing, setRenewing] = useState(false);
  const [renewMsg, setRenewMsg] = useState('');
  const [waModal, setWaModal] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [editModal, setEditModal] = useState(null);

  function load() {
    setLoading(true);
    const apiStatus = status === 'proximas' ? 'pending' : status;
    const query = apiStatus ? `?status=${apiStatus}` : '';
    api.get(`/enrollments${query}`).then((res) => setEnrollments(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, [status]);

  async function handleRenewMonth() {
    if (!confirm('¿Renovar el mes? Esto marcará todas las cuotas pagadas como pendientes para el mes siguiente.')) return;
    setRenewing(true);
    setRenewMsg('');
    try {
      const res = await api.post('/enrollments/renew-month');
      setRenewMsg(`✓ ${res.data.message}`);
      load();
    } catch (err) {
      setRenewMsg('Error al renovar: ' + (err.response?.data?.error || err.message));
    } finally {
      setRenewing(false);
    }
  }

  // Filter for proximas a vencer
  const displayEnrollments = status === 'proximas'
    ? enrollments.filter((e) => {
        if (!e.dueDate) return false;
        const due = new Date(e.dueDate);
        const now = new Date();
        const limit = new Date();
        limit.setDate(limit.getDate() + dias);
        return due >= now && due <= limit;
      })
    : enrollments;

  const totalDeuda = enrollments
    .filter((e) => e.paymentStatus !== 'paid')
    .reduce((s, e) => s + Math.max(0, e.amountDue - (e.discount || 0)), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Cobranza</h1>
          <p className="page-subtitle">Quién te debe y quién está al día</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ Nueva cobranza</button>
          <button
            className="btn btn-secondary"
            onClick={handleRenewMonth}
            disabled={renewing}
            title="Marca todas las cuotas pagadas como pendientes para el mes siguiente"
          >
            {renewing ? 'Renovando...' : '↻ Renovar mes'}
          </button>
        </div>
      </div>

      {renewMsg && (
        <div style={{
          background: renewMsg.startsWith('✓') ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${renewMsg.startsWith('✓') ? '#bbf7d0' : '#fecaca'}`,
          color: renewMsg.startsWith('✓') ? '#166534' : '#991b1b',
          borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 14,
        }}>
          {renewMsg}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {filters.map((f) => (
          <button
            key={f.value}
            className={`btn btn-sm ${status === f.value ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatus(f.value)}
          >
            {f.label}
          </button>
        ))}
        {status === 'proximas' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>Vencen en</span>
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                className={`btn btn-sm ${dias === d ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setDias(d)}
              >
                {d}d
              </button>
            ))}
          </div>
        )}
        {totalDeuda > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 14, color: '#dc2626', fontWeight: 600 }}>
            Total a cobrar: {formatMoney(totalDeuda)}
          </span>
        )}
      </div>

      <div className="card">
        {loading ? (
          <p>Cargando...</p>
        ) : displayEnrollments.length === 0 ? (
          <div className="empty-state">
            <h3>Nada por aquí</h3>
            <p>{status === 'proximas' ? `No hay cuotas que venzan en los próximos ${dias} días.` : 'No hay inscripciones con este estado.'}</p>
          </div>
        ) : (
          <div className="table-wrap"><table className="table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Actividad</th>
                <th>Cuota</th>
                <th>Descuento</th>
                <th>A cobrar</th>
                <th>Vence</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {displayEnrollments.map((e) => {
                const net = Math.max(0, e.amountDue - (e.discount || 0));
                const phone = e.client.phone;
                return (
                  <tr key={e.id}>
                    <td><Link to={`/clientes/${e.clientId}`}>{e.client.name}</Link></td>
                    <td><Link to={`/actividades/${e.activityId}`}>{e.activity.name}</Link></td>
                    <td>{formatMoney(e.amountDue)}</td>
                    <td>{e.discount > 0 ? <span style={{ color: '#10b981', fontSize: 12 }}>-{formatMoney(e.discount)}</span> : '-'}</td>
                    <td style={{ fontWeight: 600 }}>{formatMoney(net)}</td>
                    <td style={{ color: e.paymentStatus === 'overdue' ? '#dc2626' : 'inherit' }}>{formatDate(e.dueDate)}</td>
                    <td><span className={`pill pill-${e.paymentStatus}`}>{statusLabels[e.paymentStatus]}</span></td>
                    <td style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      {phone && e.paymentStatus !== 'paid' && (
                        <button
                          onClick={() => setWaModal(e)}
                          title="Enviar mensaje por WhatsApp"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                            background: '#dcfce7', color: '#166534', border: 'none', cursor: 'pointer',
                          }}
                        >
                          💬 WA
                        </button>
                      )}
                      <button
                        onClick={() => setEditModal(e)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 12 }}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>

      {waModal && (
        <TemplateModal enrollment={waModal} onClose={() => setWaModal(null)} />
      )}
      {showNew && (
        <NewEnrollmentModal
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); load(); }}
        />
      )}
      {editModal && (
        <EditEnrollmentModal
          enrollment={editModal}
          onClose={() => setEditModal(null)}
          onSaved={() => { setEditModal(null); load(); }}
        />
      )}
    </div>
  );
}

function NewEnrollmentModal({ onClose, onSaved }) {
  const [clients, setClients] = useState([]);
  const [activities, setActivities] = useState([]);
  const [form, setForm] = useState({
    clientId: '',
    activityId: '',
    amountDue: '',
    discount: '',
    startDate: new Date().toISOString().slice(0, 10),
    dueDate: (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })(),
    paymentStatus: 'pending',
    bonificada: false,
    sinLimite: true,
    bonHasta: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/clients').then((r) => setClients(r.data)).catch(() => {});
    api.get('/activities').then((r) => setActivities(r.data)).catch(() => {});
  }, []);

  // Auto-fill price when activity is selected
  function handleActivityChange(actId) {
    const act = activities.find((a) => a.id === actId);
    setForm((f) => ({ ...f, activityId: actId, amountDue: act ? String(act.price) : f.amountDue }));
  }

  function set(field, value) {
    if (field === 'startDate' && value) {
      const d = new Date(value + 'T12:00:00');
      d.setMonth(d.getMonth() + 1);
      d.setDate(d.getDate() - 1);
      setForm((f) => ({ ...f, startDate: value, dueDate: d.toISOString().slice(0, 10) }));
    } else {
      setForm((f) => ({ ...f, [field]: value }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.clientId || !form.activityId || !form.amountDue) {
      return setError('Cliente, actividad y monto son obligatorios');
    }
    setSaving(true);
    try {
      await api.post('/enrollments', {
        clientId: form.clientId,
        activityId: form.activityId,
        amountDue: parseFloat(form.amountDue),
        discount: form.discount ? parseFloat(form.discount) : 0,
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
        paymentStatus: form.paymentStatus,
        bonificada: form.bonificada,
        bonificadaHasta: form.bonificada && !form.sinLimite && form.bonHasta ? form.bonHasta : null,
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear la cobranza');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <h2>Nueva cobranza</h2>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Cliente *</label>
            <select value={form.clientId} onChange={(e) => set('clientId', e.target.value)} required>
              <option value="">Seleccioná un cliente...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Actividad *</label>
            <select value={form.activityId} onChange={(e) => handleActivityChange(e.target.value)} required>
              <option value="">Seleccioná una actividad...</option>
              {activities.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className="two-col-grid">
            <div className="field">
              <label>Monto *</label>
              <input
                type="number" min="0" step="0.01"
                value={form.amountDue}
                onChange={(e) => set('amountDue', e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Descuento</label>
              <input
                type="number" min="0" step="0.01"
                value={form.discount}
                onChange={(e) => set('discount', e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="two-col-grid">
            <div className="field">
              <label>Inicio de membresía</label>
              <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </div>
            <div className="field">
              <label>Vencimiento</label>
              <input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Estado</label>
            <select value={form.paymentStatus} onChange={(e) => set('paymentStatus', e.target.value)}>
              <option value="pending">Pendiente</option>
              <option value="paid">Pagado</option>
              <option value="overdue">Vencido</option>
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 10, border: `2px solid ${form.bonificada ? '#10b981' : 'var(--border)'}`, background: form.bonificada ? '#f0fdf4' : 'var(--surface)', transition: 'all .15s' }}>
              <input type="checkbox" checked={form.bonificada} onChange={(e) => set('bonificada', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#10b981' }} />
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Beca / Bonificación</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9ca3af' }}>Actividad sin costo o con precio reducido</p>
              </div>
            </label>
            {form.bonificada && (
              <div style={{ marginTop: 10, paddingLeft: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={form.sinLimite} onChange={(e) => set('sinLimite', e.target.checked)} style={{ width: 15, height: 15, accentColor: '#6366f1' }} />
                  Sin tiempo determinado
                </label>
                {!form.sinLimite && (
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Beca hasta</label>
                    <input type="date" value={form.bonHasta} onChange={(e) => set('bonHasta', e.target.value)} required={!form.sinLimite} />
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Crear cobranza'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditEnrollmentModal({ enrollment, onClose, onSaved }) {
  const [form, setForm] = useState({
    amountDue: enrollment.amountDue ?? '',
    discount: enrollment.discount ?? 0,
    startDate: enrollment.startDate ? enrollment.startDate.slice(0, 10) : '',
    dueDate: enrollment.dueDate ? enrollment.dueDate.slice(0, 10) : '',
    paymentStatus: enrollment.paymentStatus || 'pending',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.patch(`/enrollments/${enrollment.id}`, {
        amountDue: Number(form.amountDue),
        discount: Number(form.discount) || 0,
        startDate: form.startDate || undefined,
        dueDate: form.dueDate || undefined,
        paymentStatus: form.paymentStatus,
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  const net = Math.max(0, Number(form.amountDue) - Number(form.discount || 0));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <h2>Editar cuota</h2>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16 }}>
          <strong>{enrollment.client?.name}</strong> — {enrollment.activity?.name}
        </p>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="two-col-grid">
            <div className="field">
              <label>Cuota ($)</label>
              <input type="number" min="0" step="0.01" value={form.amountDue} onChange={(e) => set('amountDue', e.target.value)} required />
            </div>
            <div className="field">
              <label>Descuento ($)</label>
              <input type="number" min="0" step="0.01" value={form.discount} onChange={(e) => set('discount', e.target.value)} />
            </div>
          </div>
          {Number(form.discount) > 0 && (
            <p style={{ fontSize: 13, color: '#6366f1', marginBottom: 10 }}>
              A cobrar: <strong>${net.toLocaleString('es-AR')}</strong>
            </p>
          )}
          <div className="two-col-grid">
            <div className="field">
              <label>Inicio de membresía</label>
              <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </div>
            <div className="field">
              <label>Vencimiento</label>
              <input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Estado</label>
            <select value={form.paymentStatus} onChange={(e) => set('paymentStatus', e.target.value)}>
              <option value="pending">Pendiente</option>
              <option value="paid">Pagado</option>
              <option value="overdue">Vencido</option>
            </select>
          </div>
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
