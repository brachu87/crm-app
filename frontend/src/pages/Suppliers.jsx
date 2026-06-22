import { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

const CATEGORIAS = ['Equipamiento', 'Insumos', 'Servicios', 'Limpieza', 'Tecnología', 'Alimentos', 'Otro'];

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [accountSupplier, setAccountSupplier] = useState(null);
  const navigate = useNavigate();

  function load() {
    setLoading(true);
    api.get('/suppliers').then((res) => setSuppliers(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este proveedor?')) return;
    await api.delete(`/suppliers/${id}`);
    load();
  }

  function exportCSV() {
    const rows = [
      ['Nombre', 'Contacto', 'Teléfono', 'Email', 'CUIT', 'DNI', 'Categoría', 'Notas'],
      ...suppliers.map((s) => [s.name, s.contact || '', s.phone || '', s.email || '', s.cuit || '', s.dni || '', s.category || '', s.notes || '']),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'proveedores.csv';
    a.click();
  }

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.contact || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Proveedores</h1>
          <p className="page-subtitle">Gestión de proveedores y contactos comerciales</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {suppliers.length > 0 && (
            <button className="btn btn-secondary" onClick={exportCSV}>↓ Exportar CSV</button>
          )}
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>
            + Nuevo proveedor
          </button>
        </div>
      </div>

      {suppliers.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o contacto..."
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', width: 280, fontSize: 14 }}
          />
        </div>
      )}

      {loading ? (
        <div className="page-spinner"><div className="spinner spinner-lg"></div><span>Cargando...</span></div>
      ) : filtered.length === 0 && !search ? (
        <div className="card">
          <div className="empty-state">
            
            <h3>Todavía no hay proveedores</h3>
            <p>Registrá tus proveedores para tener sus datos a mano.</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ marginTop: 12 }}>
              + Nuevo proveedor
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          {filtered.length === 0 ? (
            <p style={{ color: 'var(--ink-soft)', padding: 8 }}>Sin resultados para "{search}"</p>
          ) : (
            <div className="table-wrap"><table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Teléfono</th>
                  <th>CUIT / DNI</th>
                  <th>Categoría</th>
                  <th>Total gastado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/proveedores/${s.id}`)}>
                    <td><strong style={{ color: 'var(--primary)' }}>{s.name}</strong>{s.contact && <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-soft)', fontWeight: 400 }}>{s.contact}</span>}</td>
                    <td>{s.phone ? <a href={`https://wa.me/${s.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{s.phone}</a> : '-'}</td>
                    <td style={{ fontSize: 13 }}>{[s.cuit, s.dni].filter(Boolean).join(' / ') || '-'}</td>
                    <td>{s.category ? <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: 'var(--bg)', color: 'var(--ink)' }}>{s.category}</span> : '-'}</td>
                    <td style={{ fontWeight: 600, color: (s.totalExpenses || 0) > 0 ? '#dc2626' : 'var(--ink-soft)' }}>
                      {(s.totalExpenses || 0) > 0 ? '$' + Number(s.totalExpenses).toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(s); setShowModal(true); }}>Editar</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      )}

      {accountSupplier && (
        <SupplierAccountModal
          supplier={accountSupplier}
          onClose={() => setAccountSupplier(null)}
        />
      )}

      {showModal && (
        <SupplierModal
          supplier={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

function SupplierModal({ supplier, onClose, onSaved }) {
  const isEdit = !!supplier;
  const toast = useToast();
  const [form, setForm] = useState({
    name: supplier?.name || '',
    contact: supplier?.contact || '',
    phone: supplier?.phone || '',
    email: supplier?.email || '',
    cuit: supplier?.cuit || '',
    dni: supplier?.dni || '',
    category: supplier?.category || '',
    notes: supplier?.notes || '',
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
      if (isEdit) {
        await api.put(`/suppliers/${supplier.id}`, form);
      } else {
        await api.post('/suppliers', form);
      }
      toast(isEdit ? 'Proveedor actualizado' : 'Proveedor creado', 'success');
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nombre / Razón social *</label>
            <input value={form.name} onChange={(e) => update('name', e.target.value)} required />
          </div>
          <div className="two-col-grid">
            <div className="field">
              <label>Persona de contacto</label>
              <input value={form.contact} onChange={(e) => update('contact', e.target.value)} />
            </div>
            <div className="field">
              <label>Teléfono</label>
              <input value={form.phone} onChange={(e) => update('phone', e.target.value)} />
            </div>
          </div>
          <div className="two-col-grid">
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
            </div>
            <div className="field">
              <label>CUIT</label>
              <input value={form.cuit} onChange={(e) => update('cuit', e.target.value)} placeholder="XX-XXXXXXXX-X" />
            </div>
          </div>
          <div className="two-col-grid">
            <div className="field">
              <label>DNI</label>
              <input value={form.dni} onChange={(e) => update('dni', e.target.value)} placeholder="Ej: 12345678" />
            </div>
            <div />
          </div>
          <div className="field">
            <label>Categoría</label>
            <input list="cat-list" value={form.category} onChange={(e) => update('category', e.target.value)} placeholder="Tipo de proveedor" />
            <datalist id="cat-list">
              {CATEGORIAS.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div className="field">
            <label>Notas</label>
            <textarea rows="2" value={form.notes} onChange={(e) => update('notes', e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear proveedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SupplierAccountModal({ supplier, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    api.get(`/suppliers/${supplier.id}/account?${params}`)
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const fmt = (n) => '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2 });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640, width: '95%' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Cuenta corriente — {supplier.name}</h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Date filters */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
          <div className="field" style={{ margin: 0, flex: 1 }}>
            <label style={{ fontSize: 12, marginBottom: 4 }}>Desde</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', width: '100%' }} />
          </div>
          <div className="field" style={{ margin: 0, flex: 1 }}>
            <label style={{ fontSize: 12, marginBottom: 4 }}>Hasta</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', width: '100%' }} />
          </div>
          <button className="btn btn-primary" onClick={load} style={{ whiteSpace: 'nowrap' }}>Filtrar</button>
        </div>

        {loading ? (
          <div className="page-spinner"><div className="spinner spinner-lg"></div><span>Cargando...</span></div>
        ) : !data ? null : data.expenses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--ink-soft)' }}>
            <p>No hay gastos registrados para este proveedor{from || to ? ' en ese período' : ''}.</p>
          </div>
        ) : (
          <>
            {/* Total */}
            <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: 'var(--ink-soft)' }}>Total adeudado / gastado</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#dc2626' }}>{fmt(data.total)}</span>
            </div>

            {/* Expense list */}
            <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, background: 'var(--surface)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--ink-soft)', fontWeight: 500 }}>Fecha</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--ink-soft)', fontWeight: 500 }}>Categoría</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--ink-soft)', fontWeight: 500 }}>Descripción</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ink-soft)', fontWeight: 500 }}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {data.expenses.map((e) => (
                    <tr key={e.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px' }}>{new Date(e.date).toLocaleDateString('es-AR')}</td>
                      <td style={{ padding: '8px' }}>{e.category}</td>
                      <td style={{ padding: '8px', color: 'var(--ink-soft)' }}>{e.description || '-'}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>{fmt(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
