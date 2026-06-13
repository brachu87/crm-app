import { useEffect, useState } from 'react';
import api from '../api/client';

const CATEGORIAS = ['Equipamiento', 'Insumos', 'Servicios', 'Limpieza', 'Tecnología', 'Alimentos', 'Otro'];

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

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
      ['Nombre', 'Contacto', 'Teléfono', 'Email', 'CUIT', 'Categoría', 'Notas'],
      ...suppliers.map((s) => [s.name, s.contact || '', s.phone || '', s.email || '', s.cuit || '', s.category || '', s.notes || '']),
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
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', width: 280, fontSize: 14 }}
          />
        </div>
      )}

      {loading ? (
        <p>Cargando...</p>
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
            <p style={{ color: '#9ca3af', padding: 8 }}>Sin resultados para "{search}"</p>
          ) : (
            <div className="table-wrap"><table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Contacto</th>
                  <th>Teléfono</th>
                  <th>Email</th>
                  <th>CUIT</th>
                  <th>Categoría</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.contact || '-'}</td>
                    <td>{s.phone || '-'}</td>
                    <td>{s.email || '-'}</td>
                    <td>{s.cuit || '-'}</td>
                    <td>{s.category ? (
                      <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: '#f3f4f6', color: '#374151' }}>
                        {s.category}
                      </span>
                    ) : '-'}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(s); setShowModal(true); }}>Editar</button>
                      <button className="btn btn-secondary btn-sm" style={{ color: '#dc2626' }} onClick={() => handleDelete(s.id)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
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
  const [form, setForm] = useState({
    name: supplier?.name || '',
    contact: supplier?.contact || '',
    phone: supplier?.phone || '',
    email: supplier?.email || '',
    cuit: supplier?.cuit || '',
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
        <h2>{isEdit ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nombre / Razón social *</label>
            <input value={form.name} onChange={(e) => update('name', e.target.value)} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Persona de contacto</label>
              <input value={form.contact} onChange={(e) => update('contact', e.target.value)} />
            </div>
            <div className="field">
              <label>Teléfono</label>
              <input value={form.phone} onChange={(e) => update('phone', e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
            </div>
            <div className="field">
              <label>CUIT</label>
              <input value={form.cuit} onChange={(e) => update('cuit', e.target.value)} placeholder="XX-XXXXXXXX-X" />
            </div>
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
