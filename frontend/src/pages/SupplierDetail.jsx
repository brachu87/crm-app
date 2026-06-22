import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';

const fmt = (n) => '$' + Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-AR') : '-';

function InfoField({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>{value}</p>
    </div>
  );
}

export default function SupplierDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState(null);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      api.get(`/suppliers/${id}`),
      api.get(`/suppliers/${id}/account`).then(r => setAccount(r.data)),
    ]).then(([res]) => {
      setSupplier(res.data);
    }).finally(() => setLoading(false));
  }

  async function loadAccount() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await api.get(`/suppliers/${id}/account?${params}`);
    setAccount(res.data);
  }

  useEffect(() => { load(); }, [id]);

  async function handleDelete() {
    if (!confirm('¿Eliminar este proveedor?')) return;
    await api.delete(`/suppliers/${id}`);
    navigate('/proveedores');
  }

  if (loading) return <div className="page-spinner" style={{ height: 320 }}><div className="spinner spinner-lg"></div><span>Cargando...</span></div>;
  if (!supplier) return <div className="empty-state"><span className="empty-state-icon">🔍</span><h3>Proveedor no encontrado</h3></div>;

  const initials = supplier.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate('/proveedores')} className="btn btn-secondary btn-sm" style={{ fontSize: 13 }}>← Volver</button>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{supplier.name}</h1>
              {supplier.category && (
                <span style={{ padding: '3px 10px', borderRadius: 12, background: 'var(--bg)', fontSize: 13, color: 'var(--ink-soft)' }}>{supplier.category}</span>
              )}
            </div>
            {supplier.contact && <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 14 }}>Contacto: {supplier.contact}</p>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(true)}>Editar</button>
            <button className="btn btn-danger btn-sm" onClick={handleDelete}>Eliminar</button>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, marginBottom: 16, marginTop: 0, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink-soft)', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.06em' }}>Información</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px 24px' }}>
          <InfoField label="Teléfono" value={supplier.phone ? (
            <a href={`https://wa.me/${supplier.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
              📱 {supplier.phone}
            </a>
          ) : null} />
          <InfoField label="Email" value={supplier.email ? (
            <a href={`mailto:${supplier.email}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{supplier.email}</a>
          ) : null} />
          <InfoField label="CUIT" value={supplier.cuit} />
          <InfoField label="DNI" value={supplier.dni} />
          {supplier.notes && (
            <div style={{ gridColumn: '1 / -1' }}>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notas</p>
              <p style={{ margin: 0, fontSize: 14, whiteSpace: 'pre-wrap' }}>{supplier.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Cuenta / Gastos */}
      <h2 style={{ fontSize: 16, marginBottom: 12, fontWeight: 700, letterSpacing: '-0.01em' }}>Cuenta corriente</h2>
      <div className="card" style={{ marginBottom: 20 }}>
        {/* Filtros */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="field" style={{ margin: 0, flex: 1, minWidth: 130 }}>
            <label style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>Desde</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', width: '100%', background: 'var(--surface)', color: 'var(--ink)' }} />
          </div>
          <div className="field" style={{ margin: 0, flex: 1, minWidth: 130 }}>
            <label style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>Hasta</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', width: '100%', background: 'var(--surface)', color: 'var(--ink)' }} />
          </div>
          <button className="btn btn-primary" onClick={() => loadAccount(true)} style={{ whiteSpace: 'nowrap' }}>Filtrar</button>
          {(from || to) && <button className="btn btn-secondary" onClick={() => { setFrom(''); setTo(''); setTimeout(() => loadAccount(true), 50); }}>Limpiar</button>}
        </div>

        {account && (
          <>
            <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
              <div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-soft)' }}>Total gastado</p>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#dc2626' }}>{fmt(account.total)}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-soft)' }}>Gastos registrados</p>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{account.expenses.length}</p>
              </div>
            </div>

            {account.expenses.length === 0 ? (
              <div className="empty-state"><h3>Sin gastos{from || to ? ' en ese período' : ''}</h3></div>
            ) : (
              <div className="table-wrap"><table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Categoría</th>
                    <th>Descripción</th>
                    <th>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {account.expenses.map((e) => (
                    <tr key={e.id}>
                      <td>{fmtDate(e.date)}</td>
                      <td>{e.category || '-'}</td>
                      <td style={{ color: 'var(--ink-soft)', fontSize: 13 }}>{e.description || '-'}</td>
                      <td style={{ fontWeight: 600, color: '#dc2626' }}>{fmt(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </>
        )}
      </div>

      {showModal && (
        <EditSupplierModal
          supplier={supplier}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

const CATEGORIAS = ['Equipamiento', 'Insumos', 'Servicios', 'Limpieza', 'Tecnología', 'Alimentos', 'Otro'];

function EditSupplierModal({ supplier, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: supplier.name || '',
    contact: supplier.contact || '',
    phone: supplier.phone || '',
    email: supplier.email || '',
    cuit: supplier.cuit || '',
    dni: supplier.dni || '',
    category: supplier.category || '',
    notes: supplier.notes || '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function update(field, value) { setForm(f => ({ ...f, [field]: value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/suppliers/${supplier.id}`, form);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar');
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Editar proveedor</h2>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field"><label>Nombre / Razón social *</label>
            <input value={form.name} onChange={(e) => update('name', e.target.value)} required /></div>
          <div className="two-col-grid">
            <div className="field"><label>Persona de contacto</label>
              <input value={form.contact} onChange={(e) => update('contact', e.target.value)} /></div>
            <div className="field"><label>Teléfono</label>
              <input value={form.phone} onChange={(e) => update('phone', e.target.value)} /></div>
          </div>
          <div className="two-col-grid">
            <div className="field"><label>Email</label>
              <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} /></div>
            <div className="field"><label>CUIT</label>
              <input value={form.cuit} onChange={(e) => update('cuit', e.target.value)} placeholder="XX-XXXXXXXX-X" /></div>
          </div>
          <div className="two-col-grid">
            <div className="field"><label>DNI</label>
              <input value={form.dni} onChange={(e) => update('dni', e.target.value)} placeholder="Ej: 12345678" /></div>
            <div className="field"><label>Categoría</label>
              <input list="cat-list-edit" value={form.category} onChange={(e) => update('category', e.target.value)} />
              <datalist id="cat-list-edit">{CATEGORIAS.map(c => <option key={c} value={c} />)}</datalist>
            </div>
          </div>
          <div className="field"><label>Notas</label>
            <textarea rows="2" value={form.notes} onChange={(e) => update('notes', e.target.value)} /></div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
