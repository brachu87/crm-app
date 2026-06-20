import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_TEMPLATES, getTemplates } from './Collections';

export default function Settings() {
  const { user, business, updateBusiness } = useAuth();
  const isOwner = user?.role === 'owner';

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [logoTs, setLogoTs] = useState(Date.now());
  const [logoError, setLogoError] = useState(false);

  // Business info form
  const [bizForm, setBizForm] = useState({ name: business?.name || '', category: business?.category || 'otro' });
  const [savingBiz, setSavingBiz] = useState(false);
  const CATEGORIES = [
    { value: 'gym', label: 'Gimnasio' },
    { value: 'estetica', label: 'Centro estético' },
    { value: 'pilates', label: 'Pilates / Yoga' },
    { value: 'danza', label: 'Academia de danza' },
    { value: 'crossfit', label: 'CrossFit / Box' },
    { value: 'peluqueria', label: 'Peluquería / Barbería' },
    { value: 'otro', label: 'Otro' },
  ];

  async function saveBizInfo() {
    if (!bizForm.name.trim()) return;
    setSavingBiz(true);
    try {
      const res = await api.put('/business', bizForm);
      updateBusiness(res.data);
      setSuccess('Datos del negocio actualizados');
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo guardar');
    } finally {
      setSavingBiz(false);
    }
  }

  async function uploadLogo(file) {
    const fd = new FormData();
    fd.append('logo', file);
    try {
      await api.post('/business/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setLogoTs(Date.now());
      setLogoError(false);
      setSuccess('Logo actualizado');
    } catch (e) {
      setError('No se pudo subir el logo');
    }
  }

  async function deleteLogo() {
    if (!window.confirm('¿Eliminar el logo del negocio?')) return;
    try {
      await api.delete('/business/logo');
      setLogoTs(Date.now());
      setLogoError(true);
      setSuccess('Logo eliminado');
    } catch (e) {
      setError('No se pudo eliminar el logo');
    }
  }

  function load() {
    api.get('/users')
      .then((res) => setUsers(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function deleteUser(id) {
    if (!window.confirm('¿Eliminar este usuario?')) return;
    try {
      await api.delete(`/users/${id}`);
      setSuccess('Usuario eliminado');
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al eliminar');
    }
  }

  const roleLabel = { owner: 'Propietario', admin: 'Administrador', staff: 'Personal' };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Ajustes</h1>
          <p className="page-subtitle">Usuarios y configuración del negocio</p>
        </div>
        {isOwner && (
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>
            + Nuevo usuario
          </button>
        )}
      </div>

      {error && <div className="error-banner" onClick={() => setError('')}>{error}</div>}
      {success && (
        <div style={{ background: 'var(--primary-soft)', color: 'var(--primary)', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {success}
        </div>
      )}

      {/* Datos del negocio */}
      {isOwner && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, marginBottom: 16 }}>Datos del negocio</h2>
          <div className="two-col-grid" style={{ marginBottom: 16 }}>
            <div className="field" style={{ margin: 0 }}>
              <label>Nombre del negocio</label>
              <input
                value={bizForm.name}
                onChange={e => setBizForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nombre de tu negocio"
              />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Tipo de negocio</label>
              <select value={bizForm.category} onChange={e => setBizForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={saveBizInfo}
            disabled={savingBiz || !bizForm.name.trim()}
          >
            {savingBiz ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      )}

      {/* Logo del negocio */}
      {isOwner && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, marginBottom: 4 }}>Logo del negocio</h2>
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 16 }}>
            Aparece en la barra lateral de la aplicación. Recomendado: imagen cuadrada, mínimo 128×128px.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ width: 80, height: 80, borderRadius: 12, border: '2px solid var(--border)', overflow: 'hidden', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {!logoError ? (
                <img
                  src={`/api/business/logo?t=${logoTs}&token=${localStorage.getItem('token')}`}
                  alt="Logo"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={() => setLogoError(true)}
                />
              ) : (
                <span style={{ fontSize: 28 }}>🏢</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <label className="btn btn-secondary" style={{ cursor: 'pointer', marginBottom: 0 }}>
                📷 {logoError ? 'Subir logo' : 'Cambiar logo'}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files[0] && uploadLogo(e.target.files[0])}
                />
              </label>
              {!logoError && (
                <button className="btn btn-secondary" onClick={deleteLogo} style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>
                  Eliminar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 16 }}>Usuarios del negocio</h2>
        {loading ? (
          <p>Cargando...</p>
        ) : users.length === 0 ? (
          <p style={{ color: 'var(--ink-soft)' }}>No hay usuarios.</p>
        ) : (
          <div className="table-wrap"><table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                {isOwner && <th></th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.name}
                    {u.id === user?.id && (
                      <span style={{ marginLeft: 8, fontSize: 11, background: 'var(--primary-soft)', color: 'var(--primary)', padding: '2px 6px', borderRadius: 4 }}>Vos</span>
                    )}
                  </td>
                  <td>{u.email}</td>
                  <td>{roleLabel[u.role] || u.role}</td>
                  {isOwner && (
                    <td>
                      {u.id !== user?.id && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => { setEditing(u); setShowModal(true); }}
                          >
                            Editar
                          </button>
                          <button
                            className="btn-danger-text"
                            onClick={() => deleteUser(u.id)}
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Tu sesión actual</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Nombre</p>
            <p style={{ margin: 0 }}>{user?.name}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Email</p>
            <p style={{ margin: 0 }}>{user?.email}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Rol</p>
            <p style={{ margin: 0 }}>{roleLabel[user?.role] || user?.role}</p>
          </div>
        </div>
      </div>

      <WhatsAppTemplates />

      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 36 }}>📖</div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>Manual de usuario</h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)' }}>
              Guía completa de Zentric con todas las secciones, consejos y preguntas frecuentes.
            </p>
          </div>
          <a
            href="https://brachu87.github.io/-zentric-landing/manual-zentric.pdf"
            target="_blank"
            rel="noreferrer"
            download="Manual-Zentric.pdf"
            className="btn btn-primary"
            style={{ whiteSpace: 'nowrap' }}
          >
            ⬇ Descargar PDF
          </a>
        </div>
      </div>

      {showModal && (
        <UserModal
          user={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={() => { setShowModal(false); setEditing(null); setSuccess(editing ? 'Usuario actualizado' : 'Usuario creado'); load(); }}
        />
      )}
    </div>
  );
}

function WhatsAppTemplates() {
  const [templates, setTemplates] = useState(getTemplates);
  const [editing, setEditing] = useState(null); // index being edited
  const [saved, setSaved] = useState(false);

  function handleChange(i, field, value) {
    setTemplates((prev) => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t));
  }

  function handleSave() {
    localStorage.setItem('wa_templates', JSON.stringify(templates));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setEditing(null);
  }

  function handleReset() {
    if (!confirm('¿Restaurar todas las plantillas a los valores originales?')) return;
    setTemplates(DEFAULT_TEMPLATES);
    localStorage.removeItem('wa_templates');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const VARS = ['{nombre}', '{actividad}', '{monto}', '{vencimiento}'];

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Plantillas de mensajes WhatsApp</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {saved && <span style={{ fontSize: 13, color: 'var(--primary)', alignSelf: 'center' }}>✓ Guardado</span>}
          <button className="btn btn-secondary btn-sm" onClick={handleReset}>Restaurar originales</button>
          {editing !== null && (
            <button className="btn btn-primary btn-sm" onClick={handleSave}>Guardar cambios</button>
          )}
        </div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16 }}>
        Variables disponibles: {VARS.map((v) => (
          <code key={v} style={{ background: 'var(--primary-soft)', color: 'var(--primary)', padding: '1px 5px', borderRadius: 4, marginRight: 4, fontSize: 12 }}>{v}</code>
        ))}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {templates.map((t, i) => (
          <div key={t.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              {editing === i ? (
                <input
                  value={t.name}
                  onChange={(e) => handleChange(i, 'name', e.target.value)}
                  style={{ fontWeight: 600, fontSize: 14, border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', background: 'var(--surface)', color: 'var(--ink)' }}
                />
              ) : (
                <span style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</span>
              )}
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setEditing(editing === i ? null : i)}
                style={{ fontSize: 12 }}
              >
                {editing === i ? 'Cerrar' : 'Editar'}
              </button>
            </div>
            {editing === i ? (
              <textarea
                value={t.text}
                onChange={(e) => handleChange(i, 'text', e.target.value)}
                rows={3}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
                  fontSize: 13, lineHeight: 1.5, resize: 'vertical', background: 'var(--surface)', color: 'var(--ink)',
                  boxSizing: 'border-box',
                }}
              />
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{t.text}</p>
            )}
          </div>
        ))}
      </div>
      {editing !== null && (
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={handleSave}>Guardar todas las plantillas</button>
        </div>
      )}
    </div>
  );
}

function UserModal({ user, onClose, onSaved }) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || 'staff',
    password: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { name: form.name, email: form.email, role: form.role };
      if (form.password) payload.password = form.password;
      if (isEdit) {
        await api.put(`/users/${user.id}`, payload);
      } else {
        if (!form.password) { setError('La contraseña es requerida'); setSaving(false); return; }
        await api.post('/users', payload);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? 'Editar usuario' : 'Nuevo usuario'}</h2>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nombre</label>
            <input value={form.name} onChange={set('name')} required />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={set('email')} required disabled={isEdit} />
          </div>
          <div className="field">
            <label>Rol</label>
            <select value={form.role} onChange={set('role')}>
              <option value="staff">Personal</option>
              <option value="admin">Administrador</option>
              <option value="owner">Propietario</option>
            </select>
          </div>
          <div className="field">
            <label>{isEdit ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}</label>
            <input type="password" value={form.password} onChange={set('password')} minLength={isEdit ? 0 : 6} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
