import { useState, useEffect } from 'react'
import api from '../api/client'

export default function Sedes() {
  const [branches, setBranches] = useState([])
  const [modal, setModal] = useState(null) // null | 'new' | branch object
  const [form, setForm] = useState({ name: '', address: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const load = () => api.get('/branches').then(r => setBranches(r.data))
  useEffect(() => { load() }, [])

  const openNew = () => { setForm({ name: '', address: '', phone: '' }); setModal('new') }
  const openEdit = b => { setForm({ name: b.name, address: b.address || '', phone: b.phone || '' }); setModal(b) }

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (modal === 'new') {
        await api.post('/branches', form)
      } else {
        await api.put(`/branches/${modal.id}`, form)
      }
      await load()
      setModal(null)
    } finally { setSaving(false) }
  }

  const toggleActive = async b => {
    await api.put(`/branches/${b.id}`, { active: !b.active })
    load()
  }

  const del = async b => {
    if (!window.confirm(`¿Eliminar sede "${b.name}"? Se desvinculan los empleados y actividades asignados.`)) return
    setDeleting(b.id)
    try { await api.delete(`/branches/${b.id}`); load() }
    finally { setDeleting(null) }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Sedes</h1>
          <p className="page-subtitle">Gestioná las sucursales o locales del negocio</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nueva sede</button>
      </div>

      {branches.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-soft)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏢</div>
          <p>No hay sedes cargadas todavía.</p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={openNew}>Crear primera sede</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {branches.map(b => (
            <div key={b.id} className="card" style={{ opacity: b.active ? 1 : 0.55 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>🏢</span>
                    <strong style={{ fontSize: 17 }}>{b.name}</strong>
                    {!b.active && <span className="pill" style={{ background: 'var(--bg)', color: 'var(--ink-soft)', fontSize: 12 }}>Inactiva</span>}
                  </div>
                  {b.address && <p style={{ margin: '6px 0 2px', color: 'var(--ink-soft)', fontSize: 15 }}>📍 {b.address}</p>}
                  {b.phone && <p style={{ margin: '2px 0', color: 'var(--ink-soft)', fontSize: 15 }}>📞 {b.phone}</p>}
                  <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                    <span style={{ fontSize: 14, color: 'var(--ink-soft)' }}>👥 {b._count?.employees ?? 0} empleados</span>
                    <span style={{ fontSize: 14, color: 'var(--ink-soft)' }}>🏃 {b._count?.activities ?? 0} actividades</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button className="btn btn-sm" onClick={() => openEdit(b)}>Editar</button>
                  <button className="btn btn-sm" onClick={() => toggleActive(b)}>{b.active ? 'Desactivar' : 'Activar'}</button>
                  <button className="btn btn-sm btn-danger" onClick={() => del(b)} disabled={deleting === b.id}>Eliminar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{modal === 'new' ? 'Nueva sede' : 'Editar sede'}</h2>
            <div className="field">
              <label>Nombre *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Sucursal Centro" autoFocus />
            </div>
            <div className="field">
              <label>Dirección</label>
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Ej: Av. Colón 1234" />
            </div>
            <div className="field">
              <label>Teléfono</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Ej: 351 000-0000" />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-primary" onClick={save} disabled={saving || !form.name.trim()}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
              <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
