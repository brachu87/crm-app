import React, { useEffect, useState } from 'react';
import api from '../api/client';
import AuthImage from '../components/AuthImage';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { DEFAULT_TEMPLATES, getTemplates } from './Collections';
import { ALL_MODULES } from '../config/modules';
import { PERMISSION_TREE } from '../config/permissions';

// Secciones disponibles (mismo orden que el sidebar)
const ALL_SECTIONS = [
  { group: 'Negocio',        to: '/clientes',      label: 'Clientes' },
  { group: 'Negocio',        to: '/actividades',   label: 'Actividades/Servicios' },
  { group: 'Negocio',        to: '/agenda',        label: 'Agenda' },
  { group: 'Negocio',        to: '/proveedores',   label: 'Proveedores' },
  { group: 'Empleados',      to: '/empleados',     label: 'Empleados' },
  { group: 'Empleados',      to: '/asistencias',   label: 'Asistencias' },
  { group: 'Empleados',      to: '/liquidaciones', label: 'Liquidaciones' },
  { group: 'Empleados',      to: '/horarios',      label: 'Horarios' },
  { group: 'Finanzas',       to: '/cobranza',      label: 'Cobranza' },
  { group: 'Finanzas',       to: '/caja',          label: 'Caja del día' },
  { group: 'Finanzas',       to: '/reportes',      label: 'Reportes' },
  { group: 'Finanzas',       to: '/gastos',        label: 'Gastos' },
  { group: 'Configuración',  to: '/ajustes',       label: 'Ajustes' },
  { group: 'Configuración',  to: '/sedes',         label: 'Sedes' },
];

const GROUPS_ORDER = ['Negocio', 'Empleados', 'Finanzas', 'Configuración'];

export default function Settings() {
  const toast = useToast();
  const { user, business, updateBusiness } = useAuth();
  const isOwner = user?.role === 'owner';
  const canManage = user?.role === 'owner' || user?.role === 'admin';

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [permEditing, setPermEditing] = useState(null); // user id being edited for perms
  const [logoTs, setLogoTs] = useState(Date.now());
  const [logoError, setLogoError] = useState(false);
  const [billing, setBilling] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);

  // Business info form
  const [bizForm, setBizForm] = useState({
    name: business?.name || '',
    category: business?.category || 'otro',
    phone: '',
    cuit: '',
    address: '',
    email: '',
    website: '',
    instagram: '',
  });
  const [bizLoaded, setBizLoaded] = useState(false);
  const [savingBiz, setSavingBiz] = useState(false);
  const [activeTab, setActiveTab] = useState('negocio');
  const [modules, setModules] = useState(() => {
    // Inicializar desde el business guardado en localStorage
    const biz = JSON.parse(localStorage.getItem('business') || '{}');
    if (!biz.enabledModules) return ALL_MODULES.map(m => m.key); // todos habilitados
    try {
      const parsed = typeof biz.enabledModules === 'string'
        ? JSON.parse(biz.enabledModules) : biz.enabledModules;
      return parsed || ALL_MODULES.map(m => m.key);
    } catch { return ALL_MODULES.map(m => m.key); }
  });
  const [savingModules, setSavingModules] = useState(false);
  const [modulesSaved, setModulesSaved] = useState(false);
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

  async function saveModules() {
    setSavingModules(true);
    try {
      await api.put('/business/modules', { enabledModules: modules });
      // Actualizar business en localStorage para que Layout lo lea sin reload
      const biz = JSON.parse(localStorage.getItem('business') || '{}');
      biz.enabledModules = JSON.stringify(modules);
      localStorage.setItem('business', JSON.stringify(biz));
      updateBusiness(biz);
      setModulesSaved(true);
      setTimeout(() => setModulesSaved(false), 2000);
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar módulos');
    } finally { setSavingModules(false); }
  }

  function toggleModule(key) {
    setModules(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
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

  useEffect(() => {
    if (isOwner) {
      api.get('/billing/status').then(r => setBilling(r.data)).catch(() => {});
      api.get('/business/info').then(r => {
        setBizForm(f => ({
          ...f,
          name: r.data.name || f.name,
          category: r.data.category || f.category,
          phone: r.data.phone || '',
          cuit: r.data.cuit || '',
          address: r.data.address || '',
          email: r.data.email || '',
          website: r.data.website || '',
          instagram: r.data.instagram || '',
        }));
        setBizLoaded(true);
      }).catch(() => setBizLoaded(true));
    }
  }, [isOwner]);

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

  const TABS = [
    { id: 'negocio',     label: '🏢 Negocio' },
    { id: 'usuarios',    label: '👥 Usuarios' },
    { id: 'whatsapp',    label: '💬 WhatsApp' },
    { id: 'calendar',    label: '📅 Calendar' },
    { id: 'facturacion', label: '💳 Facturación' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Ajustes</h1>
          <p className="page-subtitle">Configuración del negocio</p>
        </div>
        {activeTab === 'usuarios' && isOwner && (
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

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid var(--border)', paddingBottom: 0, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 18px', fontSize: 14, fontWeight: 600,
              color: activeTab === t.id ? 'var(--primary)' : 'var(--ink-soft)',
              borderBottom: activeTab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -2, borderRadius: 0, whiteSpace: 'nowrap',
              transition: 'color .15s',
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* ── NEGOCIO ── */}
      {activeTab === 'negocio' && isOwner && (
        <>
          <div className="card" style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, marginBottom: 16 }}>Datos del negocio</h2>
            <div className="two-col-grid" style={{ marginBottom: 12 }}>
              <div className="field" style={{ margin: 0 }}>
                <label>Nombre del negocio *</label>
                <input value={bizForm.name} onChange={e => setBizForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre de tu negocio" />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Tipo de negocio *</label>
                <select value={bizForm.category} onChange={e => setBizForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div className="two-col-grid" style={{ marginBottom: 12 }}>
              <div className="field" style={{ margin: 0 }}>
                <label>Teléfono</label>
                <input type="tel" value={bizForm.phone} onChange={e => setBizForm(f => ({ ...f, phone: e.target.value }))} placeholder="Ej: 1176353062" />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>CUIT / CUIL</label>
                <input value={bizForm.cuit} onChange={e => setBizForm(f => ({ ...f, cuit: e.target.value }))} placeholder="Ej: 20-12345678-9" />
              </div>
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Dirección</label>
              <input value={bizForm.address} onChange={e => setBizForm(f => ({ ...f, address: e.target.value }))} placeholder="Ej: Av. Corrientes 1234, Buenos Aires" />
            </div>
            <div className="two-col-grid" style={{ marginBottom: 12 }}>
              <div className="field" style={{ margin: 0 }}>
                <label>Email de contacto</label>
                <input type="email" value={bizForm.email} onChange={e => setBizForm(f => ({ ...f, email: e.target.value }))} placeholder="Ej: info@tunegocio.com" />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Sitio web</label>
                <input type="url" value={bizForm.website} onChange={e => setBizForm(f => ({ ...f, website: e.target.value }))} placeholder="Ej: www.tunegocio.com" />
              </div>
            </div>
            <div className="field" style={{ marginBottom: 16 }}>
              <label>Instagram</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-soft)', fontSize: 14 }}>@</span>
                <input value={bizForm.instagram} onChange={e => setBizForm(f => ({ ...f, instagram: e.target.value.replace('@','') }))} placeholder="tunegocio" style={{ paddingLeft: 28 }} />
              </div>
            </div>
            <button className="btn btn-primary" onClick={saveBizInfo} disabled={savingBiz || !bizForm.name.trim()}>
              {savingBiz ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>

          <div className="card">
            <h2 style={{ fontSize: 16, marginBottom: 4 }}>Logo del negocio</h2>
            <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 16 }}>
              Aparece en la barra lateral. Recomendado: imagen cuadrada, mínimo 128×128px.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ width: 80, height: 80, borderRadius: 12, border: '2px solid var(--border)', overflow: 'hidden', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AuthImage path={`/business/logo`} cacheKey={logoTs} alt="Logo"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  fallback={<span style={{ fontSize: 28 }}>🏢</span>} />
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <label className="btn btn-secondary" style={{ cursor: 'pointer', marginBottom: 0 }}>
                  📷 {logoError ? 'Subir logo' : 'Cambiar logo'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && uploadLogo(e.target.files[0])} />
                </label>
                {!logoError && (
                  <button className="btn btn-secondary" onClick={deleteLogo} style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>Eliminar</button>
                )}
              </div>
            </div>
          </div>

          {/* ── Módulos activos ── */}
          <div className="card" style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div>
                <h2 style={{ fontSize: 16, margin: '0 0 2px' }}>Módulos activos</h2>
                <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>
                  Activá solo las secciones que usás. El menú lateral se actualiza al instante.
                </p>
              </div>
              <button className="btn btn-primary" onClick={saveModules} disabled={savingModules}>
                {modulesSaved ? '✓ Guardado' : savingModules ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ALL_MODULES.map(m => (
                <label key={m.key} style={{
                  display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
                  padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)',
                  background: modules.includes(m.key) ? 'var(--primary-soft)' : 'var(--surface)',
                  transition: 'background .15s',
                }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <input
                      type="checkbox"
                      checked={modules.includes(m.key)}
                      onChange={() => toggleModule(m.key)}
                      style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14,
                      color: modules.includes(m.key) ? 'var(--primary)' : 'var(--ink)' }}>
                      {m.label}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-soft)' }}>{m.desc}</p>
                  </div>
                </label>
              ))}
            </div>
            <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 12, marginBottom: 0 }}>
              ℹ️ Clientes, Cobranza y Ajustes siempre están disponibles.
            </p>
          </div>
        </>
      )}

      {/* ── USUARIOS ── */}
      {activeTab === 'usuarios' && (
        <>
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, margin: 0 }}>Usuarios del negocio</h2>
              <span style={{ fontSize: 12, color: 'var(--ink-soft)', background: 'var(--surface-2)', padding: '3px 10px', borderRadius: 20 }}>
                {users.length}/3 usuarios
              </span>
            </div>
            {loading ? (
              <div className="page-spinner"><div className="spinner spinner-lg"></div><span>Cargando...</span></div>
            ) : users.length === 0 ? (
              <p style={{ color: 'var(--ink-soft)' }}>No hay usuarios.</p>
            ) : (
              <div className="table-wrap"><table className="table">
                <thead>
                  <tr>
                    <th>Nombre</th><th>Email</th><th>Rol</th>
                    {isOwner && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <React.Fragment key={u.id}>
                      <tr>
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
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {isOwner && (
                                  <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(u); setShowModal(true); }}>Editar</button>
                                )}
                                {canManage && u.role !== 'owner' && (
                                  <button className="btn btn-secondary btn-sm" onClick={() => setPermEditing(permEditing === u.id ? null : u.id)} style={{ color: 'var(--primary)' }}>🔐 Permisos</button>
                                )}
                                {isOwner && (
                                  <button className="btn-danger-text" onClick={() => deleteUser(u.id)}>Eliminar</button>
                                )}
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                      {permEditing === u.id && (
                        <tr>
                          <td colSpan={isOwner ? 4 : 3} style={{ padding: 0, border: 'none' }}>
                            <PermissionsPanel u={u} onClose={() => setPermEditing(null)}
                              onSaved={(updated) => { setUsers(prev => prev.map(x => x.id === updated.id ? updated : x)); setPermEditing(null); setSuccess('Permisos actualizados'); }} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
        </>
      )}

      {/* ── WHATSAPP ── */}
      {activeTab === 'whatsapp' && (
        <>
          <WhatsAppAuto />
          <WhatsAppTemplates />
        </>
      )}

      {activeTab === 'calendar' && <GoogleCalendarCard />}

      {/* ── FACTURACIÓN ── */}
      {activeTab === 'facturacion' && (
        <>
          {isOwner && billing !== undefined && (
            <BillingCard billing={billing} onRefresh={() => api.get('/billing/status').then(r => setBilling(r.data)).catch(() => {})} />
          )}
          <div className="card" style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ fontSize: 36 }}>📖</div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>Manual de usuario <span style={{ fontSize: 11, background: 'var(--primary)', color: '#fff', borderRadius: 8, padding: '1px 7px', marginLeft: 6 }}>v2.1</span></h2>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)' }}>
                  Guía completa actualizada: WhatsApp automático, permisos por acción, módulos configurables, agenda de turnos y más.
                </p>
              </div>
              <a href="https://brachu87.github.io/-zentric-landing/manual-zentric.pdf" target="_blank" rel="noreferrer"
                download="Manual-Gestumio.pdf" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
                ⬇ Descargar PDF
              </a>
            </div>
          </div>
        </>
      )}

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



// ── Automatización WhatsApp vía Meta Cloud API ───────────────────────────────
function WhatsAppAuto() {
  const [status, setStatus] = useState(null);
  const [qr, setQR] = useState(null);
  const [testPhone, setTestPhone] = useState('');
  const [testMsg, setTestMsg] = useState('Hola! Este es un mensaje de prueba desde Gestumio 🌿');
  const [testing, setTesting] = useState(false);
  const [running, setRunning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [templates, setTemplates] = useState({ expiring: '', overdue: '', appointment: '' });
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [templatesSaved, setTemplatesSaved] = useState(false);

  // Polling cada 2s
  useEffect(() => {
    let interval;
    function poll() {
      api.get('/whatsapp/status').then(r => setStatus(r.data)).catch(() => {});
    }
    poll();
    interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, []);

  // Cargar plantillas cuando está conectado
  useEffect(() => {
    if (status?.state === 'connected' && !templatesLoaded) {
      api.get('/whatsapp/templates').then(r => {
        setTemplates(r.data);
        setTemplatesLoaded(true);
      }).catch(() => {});
    }
  }, [status?.state, templatesLoaded]);

  async function handleSaveTemplates() {
    try {
      await api.put('/whatsapp/templates', templates);
      setTemplatesSaved(true);
      setTimeout(() => setTemplatesSaved(false), 2000);
    } catch (e) {
      setFeedback('❌ ' + (e.response?.data?.error || e.message));
    }
  }

  // Cuando hay QR disponible, pedirlo
  useEffect(() => {
    if (status?.state === 'qr_ready') {
      api.get('/whatsapp/qr').then(r => setQR(r.data.qr)).catch(() => {});
    } else if (status?.state === 'connected') {
      setQR(null); // solo limpiar QR cuando conectamos exitosamente
    }
    // en 'connecting' o 'disconnected' mantenemos el QR anterior si lo había
  }, [status?.state]);

  async function handleConnect() {
    setConnecting(true); setFeedback('');
    try {
      await api.post('/whatsapp/connect');
      setFeedback('');
    } catch (e) {
      setFeedback('❌ ' + (e.response?.data?.error || e.message));
    } finally { setConnecting(false); }
  }

  async function handleLogout() {
    if (!confirm('¿Cerrar sesión de WhatsApp? Tendrás que escanear el QR de nuevo.')) return;
    try {
      await api.post('/whatsapp/logout');
      setFeedback('Sesión cerrada.');
    } catch (e) {
      setFeedback('❌ ' + (e.response?.data?.error || e.message));
    }
  }

  async function handleTest() {
    if (!testPhone || !testMsg) return;
    setTesting(true); setFeedback('');
    try {
      await api.post('/whatsapp/test', { phone: testPhone, message: testMsg });
      setFeedback('✅ Mensaje enviado correctamente');
    } catch (e) {
      setFeedback('❌ ' + (e.response?.data?.error || e.message));
    } finally { setTesting(false); }
  }

  async function handleRunNow() {
    setRunning(true); setFeedback('');
    try {
      await api.post('/whatsapp/run-reminders');
      setFeedback('✅ Barrido iniciado en background');
    } catch (e) {
      setFeedback('❌ ' + (e.response?.data?.error || e.message));
    } finally { setRunning(false); }
  }

  const state = status?.state || 'disconnected';
  const stateLabel = {
    disconnected: 'Desconectado',
    connecting:   qr ? 'Actualizando QR...' : 'Conectando...',
    qr_ready:     'Esperando QR',
    connected:    'Conectado',
  }[state] || state;
  const stateColor = {
    disconnected: '#ef4444',
    connecting:   '#f59e0b',
    qr_ready:     '#f59e0b',
    connected:    '#22c55e',
  }[state] || '#94a3b8';

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 28 }}>🤖</span>
        <div>
          <h2 style={{ fontSize: 16, margin: '0 0 2px' }}>Recordatorios automáticos por WhatsApp</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)' }}>
            Vinculá tu WhatsApp — no requiere cuenta de empresa
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
            background: stateColor, boxShadow: `0 0 0 2px ${stateColor}33`,
          }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{stateLabel}</span>
        </div>
      </div>

      {/* Estado: desconectado — mostrar botón conectar */}
      {state === 'disconnected' && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 16 }}>
            Conectá tu WhatsApp para enviar recordatorios automáticos de cuotas.
          </p>
          <button className="btn btn-primary" onClick={handleConnect} disabled={connecting}>
            {connecting ? 'Iniciando...' : '📱 Conectar WhatsApp'}
          </button>
        </div>
      )}

      {/* Estado: conectando sin QR previo */}
      {state === 'connecting' && !qr && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--ink-soft)', fontSize: 14 }}>
          ⏳ Iniciando conexión...
        </div>
      )}

      {/* Estado: QR listo o reconectando con QR previo */}
      {(state === 'qr_ready' || (state === 'connecting' && qr)) && (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
            📱 Escaneá este código QR con WhatsApp
          </p>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16 }}>
            Abrí WhatsApp → Dispositivos vinculados → Vincular dispositivo
          </p>
          {qr ? (
            <img
              src={qr}
              alt="QR WhatsApp"
              style={{ width: 240, height: 240, borderRadius: 12, border: '2px solid var(--border)' }}
            />
          ) : (
            <div style={{ width: 240, height: 240, margin: '0 auto', borderRadius: 12,
              border: '2px dashed var(--border)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'var(--ink-soft)', fontSize: 13 }}>
              Cargando QR...
            </div>
          )}
          <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 12 }}>
            El QR se renueva automáticamente. Se actualiza en segundos.
          </p>
        </div>
      )}

      {/* Estado: conectado */}
      {state === 'connected' && (
        <>
          <div style={{
            background: '#f0fdf4', border: '1px solid #bbf7d0',
            borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: '#166534',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>
              ✅ WhatsApp conectado{status?.phone ? ` (${status.phone})` : ''}.
              Recordatorios automáticos todos los días a las <strong>09:00 hs</strong>.
            </span>
            <button
              onClick={handleLogout}
              style={{ background: 'none', border: '1px solid #16653444', color: '#166534',
                borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Desconectar
            </button>
          </div>

          <div style={{ marginBottom: 16 }}>
            <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Probar envío manual</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
                placeholder="Ej: 1123456789"
                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                  fontSize: 13, background: 'var(--surface)', color: 'var(--ink)' }}
              />
            </div>
            <textarea
              value={testMsg}
              onChange={e => setTestMsg(e.target.value)}
              rows={2}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                fontSize: 13, background: 'var(--surface)', color: 'var(--ink)', resize: 'vertical',
                boxSizing: 'border-box', marginBottom: 8 }}
            />
            <button className="btn btn-secondary" onClick={handleTest} disabled={testing || !testPhone}>
              {testing ? 'Enviando...' : '📤 Enviar mensaje de prueba'}
            </button>
          </div>

          <div>
            <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Ejecutar recordatorios ahora</p>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 8 }}>
              Dispará el barrido manualmente sin esperar al horario programado.
            </p>
            <button className="btn btn-primary" onClick={handleRunNow} disabled={running}>
              {running ? 'Ejecutando...' : '▶ Ejecutar recordatorios ahora'}
            </button>
          </div>

        </>
      )}

      {/* Plantillas automáticas — siempre visibles */}
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>📋 Plantillas de mensajes automáticos</h2>
          <button className="btn btn-primary btn-sm" onClick={handleSaveTemplates}>
            {templatesSaved ? '✓ Guardado' : 'Guardar'}
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16 }}>
          Podés personalizar el texto de cada recordatorio. Dejá el campo vacío para usar el mensaje por defecto.
        </p>
        {[
          {
            key: 'expiring',
            label: '📅 Cuota próxima a vencer',
            hint: 'Se envía 1, 3 y 7 días antes del vencimiento',
            vars: '{nombre} {actividad} {vencimiento} {monto} {negocio}',
            def: 'Hola {nombre}, te recordamos que tu cuota de {actividad} vence el {vencimiento}. ¡Muchas gracias! {negocio}',
          },
          {
            key: 'overdue',
            label: '⚠️ Cuota vencida',
            hint: 'Se envía el día después del vencimiento',
            vars: '{nombre} {actividad} {vencimiento} {monto} {negocio}',
            def: 'Hola {nombre}, tu cuota de {actividad} venció el {vencimiento}. Por favor regularizá tu situación. {negocio}',
          },
          {
            key: 'appointment',
            label: '📆 Recordatorio de turno',
            hint: 'Se envía un día antes del turno agendado',
            vars: '{nombre} {servicio} {hora} {fecha} {negocio}',
            def: 'Hola {nombre}, te recordamos que tenés un turno de {servicio} mañana a las {hora}. ¡Te esperamos! {negocio}',
          },
        ].map(({ key, label, hint, vars, def }) => (
          <div key={key} style={{ marginBottom: 16 }}>
            <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{label}</p>
            <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 4 }}>
              {hint} · Variables: <code style={{ fontSize: 11 }}>{vars}</code>
            </p>
            <textarea
              rows={2}
              value={templates[key] || ''}
              onChange={e => setTemplates(t => ({ ...t, [key]: e.target.value }))}
              placeholder={def}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 8,
                border: '1px solid var(--border)', fontSize: 13, lineHeight: 1.5,
                resize: 'vertical', background: 'var(--surface)', color: 'var(--ink)',
                boxSizing: 'border-box',
              }}
            />
          </div>
        ))}
      </div>

      {feedback && (
        <div style={{
          marginTop: 14, padding: '10px 14px', borderRadius: 8,
          background: feedback.startsWith('✅') ? '#f0fdf4' : '#fef2f2',
          color: feedback.startsWith('✅') ? '#166534' : '#991b1b',
          fontSize: 13, fontWeight: 500,
        }}>{feedback}</div>
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
    <div className="modal-overlay">
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


function PermissionsPanel({ u, onClose, onSaved }) {
  const defaultPerms = () => PERMISSION_TREE.flatMap(m => m.actions.map(a => `${m.key}.${a.key}`));

  // Detectar formato viejo (rutas como /clientes) y convertir
  function normalizePerms(raw) {
    if (!raw) return null;
    if (raw.some(p => p.startsWith('/'))) {
      // Formato viejo → expandir a todas las acciones de ese módulo
      const result = [];
      raw.forEach(route => {
        const key = route.replace('/', '');
        const mod = PERMISSION_TREE.find(m => m.key === key);
        if (mod) mod.actions.forEach(a => result.push(`${mod.key}.${a.key}`));
      });
      return result.length ? result : defaultPerms();
    }
    return raw;
  }

  const [perms, setPerms] = useState(() => normalizePerms(u.permissions ? [...u.permissions] : null));
  const [restricted, setRestricted] = useState(u.permissions !== null);
  const [saving, setSaving] = useState(false);

  function toggleRestricted(val) {
    setRestricted(val);
    if (!val) setPerms(null);
    else if (!perms) setPerms(defaultPerms());
  }

  function toggleAction(key) {
    setPerms(prev => {
      const base = prev || [];
      return base.includes(key) ? base.filter(x => x !== key) : [...base, key];
    });
  }

  function toggleModule(mod) {
    const keys = mod.actions.map(a => `${mod.key}.${a.key}`);
    const allOn = keys.every(k => perms?.includes(k));
    setPerms(prev => {
      const base = prev || [];
      return allOn ? base.filter(x => !keys.includes(x)) : [...new Set([...base, ...keys])];
    });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await import('../api/client').then(m => m.default.put(`/users/${u.id}`, { permissions: restricted ? perms : null }));
      onSaved(res.data);
    } catch (e) {
      alert(e.response?.data?.error || 'Error al guardar');
    } finally { setSaving(false); }
  }

  return (
    <div style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--border)', padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
          Permisos de <span style={{ color: 'var(--primary)' }}>{u.name}</span>
        </p>
        <button className="btn-danger-text" onClick={onClose} style={{ fontSize: 12 }}>Cerrar</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '10px 14px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
        <input type="checkbox" id={`restrict-${u.id}`} checked={restricted} onChange={e => toggleRestricted(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer' }} />
        <label htmlFor={`restrict-${u.id}`} style={{ fontSize: 13, cursor: 'pointer' }}>
          Restringir permisos de este usuario
          <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--ink-soft)' }}>(sin restricción ve y hace todo)</span>
        </label>
      </div>

      {restricted && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {PERMISSION_TREE.map(mod => {
            const modKeys = mod.actions.map(a => `${mod.key}.${a.key}`);
            const allOn   = modKeys.every(k => perms?.includes(k));
            const someOn  = modKeys.some(k => perms?.includes(k));
            return (
              <div key={mod.key} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                {/* Cabecera del módulo */}
                <div
                  onClick={() => toggleModule(mod)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
                    background: allOn ? 'var(--primary)' : someOn ? 'var(--primary-soft)' : 'var(--surface)',
                    cursor: 'pointer', userSelect: 'none',
                  }}
                >
                  <span style={{ fontSize: 16 }}>{mod.icon}</span>
                  <span style={{
                    fontWeight: 700, fontSize: 13,
                    color: allOn ? '#fff' : 'var(--ink)',
                    flex: 1,
                  }}>{mod.label}</span>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 10,
                    background: allOn ? 'rgba(255,255,255,0.25)' : 'var(--border)',
                    color: allOn ? '#fff' : 'var(--ink-soft)',
                  }}>
                    {allOn ? 'Todo habilitado' : someOn ? 'Parcial' : 'Sin acceso'}
                  </span>
                </div>
                {/* Acciones del módulo */}
                <div style={{ display: 'flex', flexWrap: 'wrap', padding: '8px 12px', gap: 6, background: 'var(--surface)' }}>
                  {mod.actions.map(a => {
                    const key = `${mod.key}.${a.key}`;
                    const on = perms?.includes(key) || false;
                    return (
                      <label key={key} style={{
                        display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                        padding: '5px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                        border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                        background: on ? 'var(--primary-soft)' : 'var(--bg)',
                        color: on ? 'var(--primary)' : 'var(--ink-soft)',
                        transition: 'all .15s',
                      }}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggleAction(key)}
                          style={{ display: 'none' }}
                        />
                        {on ? '✓' : '○'} {a.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar permisos'}
        </button>
      </div>
    </div>
  );
}

/* ── Facturación ─────────────────────────────────────────────── */
function BillingCard({ billing, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const status = billing?.status || 'trial';
  const expires = billing?.expires ? new Date(billing.expires) : null;

  // Check URL param after MP redirect
  const urlParams = new URLSearchParams(window.location.search);
  const paymentResult = urlParams.get('payment');

  const trialDaysLeft = billing?.trialDaysLeft ?? null;
  const trialEnds = billing?.trialEnds ? new Date(billing.trialEnds) : null;
  const bonificado = billing?.bonificado || false;

  const STATUS_INFO = {
    active:  { label: bonificado ? 'Acceso bonificado' : 'Activa', color: bonificado ? '#7c3aed' : '#10b981', icon: bonificado ? '🎁' : '✅' },
    trial:   { label: 'Prueba gratuita', color: '#f59e0b', icon: '🕐' },
    expired: { label: 'Vencida', color: '#ef4444', icon: '❌' },
    pending: { label: 'Pago pendiente', color: '#6366f1', icon: '⏳' },
  };

  const info = STATUS_INFO[status] || STATUS_INFO.trial;

  const fmtDate = (d) => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

  async function handlePay() {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/billing/preference');
      window.location.href = res.data.init_point;
    } catch (e) {
      setError(e.response?.data?.error || 'Error al generar el link de pago');
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 16, margin: '0 0 16px', fontWeight: 700 }}>💳 Facturación</h2>

      {paymentResult === 'success' && (
        <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#065f46', fontSize: 14 }}>
          ¡Pago recibido! Tu suscripción será activada en instantes.
          <button onClick={onRefresh} style={{ marginLeft: 12, fontSize: 12, background: 'none', border: 'none', color: '#065f46', cursor: 'pointer', textDecoration: 'underline' }}>Actualizar</button>
        </div>
      )}
      {paymentResult === 'failure' && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#991b1b', fontSize: 14 }}>
          El pago no pudo procesarse. Podés intentarlo nuevamente.
        </div>
      )}
      {paymentResult === 'pending' && (
        <div style={{ background: '#ede9fe', border: '1px solid #c4b5fd', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#5b21b6', fontSize: 14 }}>
          Tu pago está siendo procesado. Te notificaremos cuando se acredite.
        </div>
      )}

      {error && <div className="error-banner" style={{ marginBottom: 12 }}>{error}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        {/* Estado */}
        <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '14px 20px', flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Estado del plan</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>{info.icon}</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: info.color }}>{info.label}</span>
          </div>
          {expires && (
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
              {status === 'active' ? 'Vence el' : 'Venció el'}: {fmtDate(expires)}
            </div>
          )}
        </div>

        {/* Trial countdown (only when in trial) */}
        {status === 'trial' && trialDaysLeft !== null && (
          <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '14px 20px', flexBasis: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {trialDaysLeft > 0
                  ? `⏳ Quedan ${trialDaysLeft} días de prueba gratuita`
                  : '⚠️ Tu período de prueba venció'}
              </span>
              {trialEnds && (
                <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Vence: {fmtDate(trialEnds)}</span>
              )}
            </div>
            <div style={{ background: 'var(--border)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                borderRadius: 4,
                width: `${Math.min(100, Math.round((trialDaysLeft / 15) * 100))}%`,
                background: trialDaysLeft > 7 ? '#10b981' : trialDaysLeft > 3 ? '#f59e0b' : '#ef4444',
                transition: 'width 0.5s',
              }} />
            </div>
            {trialDaysLeft <= 5 && trialDaysLeft > 0 && (
              <div style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>
                ⚡ ¡Tu acceso se revocará automáticamente cuando venza el período de prueba!
              </div>
            )}
            {trialDaysLeft === 0 && (
              <div style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>
                Tu acceso ha sido suspendido. Realizá el pago para reactivar tu cuenta.
              </div>
            )}
          </div>
        )}

        {/* Plan */}
        <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '14px 20px', flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Plan</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Plan Mensual</div>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>$75.000 / mes</div>
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className="btn btn-primary"
          onClick={handlePay}
          disabled={loading}
          style={{ minWidth: 180 }}
        >
          {loading ? 'Generando link...' : status === 'active' ? '🔄 Renovar plan' : '💳 Pagar ahora'}
        </button>
        <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
          Serás redirigido a Mercado Pago para completar el pago de forma segura.
        </span>
      </div>
    </div>
  );
}


// ── Google Calendar ──────────────────────────────────────────────
function GcalToggle({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function GoogleCalendarCard() {
  const [st, setSt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  function load() {
    api.get('/google-calendar/status')
      .then((r) => setSt(r.data))
      .catch(() => setSt({ configured: false, connected: false }))
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
    const p = new URLSearchParams(window.location.search);
    const g = p.get('gcal');
    if (g === 'ok') setMsg('✅ Google Calendar conectado. Se creó el calendario "Gestumio".');
    else if (g === 'error') setMsg('❌ No se pudo conectar: ' + (p.get('msg') || 'revisá las credenciales') + '.');
    if (g) window.history.replaceState({}, '', '/ajustes');
  }, []);

  async function connect() {
    try {
      const r = await api.get('/google-calendar/connect');
      window.location.href = r.data.url;
    } catch (e) {
      setMsg(e.response?.data?.error || 'No se pudo iniciar la conexión con Google.');
    }
  }
  async function disconnect() {
    if (!confirm('¿Desconectar Google Calendar? Los eventos ya creados quedan en Google.')) return;
    try { await api.post('/google-calendar/disconnect'); } finally { load(); }
  }
  async function toggle(key, val) {
    setSt((s) => ({ ...s, [key]: val }));
    try { await api.post('/google-calendar/settings', { [key]: val }); } catch { load(); }
  }

  if (loading) return <div className="card" style={{ marginTop: 24 }}>Cargando…</div>;

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 26 }}>📅</span>
        <h2 style={{ fontSize: 16, margin: 0 }}>Google Calendar</h2>
        {st && st.connected && (
          <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: '#1BA84C', background: 'var(--primary-soft, #E4F6E9)', padding: '2px 10px', borderRadius: 12 }}>Conectado</span>
        )}
      </div>
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 14 }}>
        Sincronizá tus turnos, agenda y clases con un calendario dedicado <strong>"Gestumio"</strong> en tu cuenta de Google.
      </p>
      {msg && (
        <div style={{ fontSize: 13, marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--primary-soft, #eef6ee)' }}>{msg}</div>
      )}

      {!st || !st.configured ? (
        <div style={{ fontSize: 13, color: '#92400e', background: '#fef3c7', padding: '10px 12px', borderRadius: 8 }}>
          Falta configurar las credenciales de Google en el servidor (variables <strong>GOOGLE_CLIENT_SECRET</strong> y <strong>GOOGLE_CALENDAR_REDIRECT_URI</strong> en Railway).
        </div>
      ) : !st.connected ? (
        <button className="btn btn-primary" onClick={connect}>Conectar Google Calendar</button>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            <GcalToggle label="Sincronizar Turnos / citas" checked={!!st.syncTurnos} onChange={(v) => toggle('syncTurnos', v)} />
            <GcalToggle label="Sincronizar Agenda (notas / eventos)" checked={!!st.syncAgenda} onChange={(v) => toggle('syncAgenda', v)} />
            <GcalToggle label="Sincronizar Clases / actividades" checked={!!st.syncClases} onChange={(v) => toggle('syncClases', v)} />
          </div>
          <button className="btn btn-secondary" onClick={disconnect}>Desconectar</button>
        </>
      )}
    </div>
  );
}
