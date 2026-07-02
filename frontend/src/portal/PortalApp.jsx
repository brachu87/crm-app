import { useEffect, useState } from 'react';

const TOKEN_KEY = 'portal_token';
function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
function fmtMoney(v) { return '$' + Number(v || 0).toLocaleString('es-AR'); }
function fmtDate(d) { if (!d) return ''; return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }

async function portalFetch(path, options = {}) {
  const res = await fetch('/api/portal' + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}), ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error');
  return data;
}

export default function PortalApp() {
  const [booted, setBooted] = useState(false);
  const [me, setMe] = useState(null);

  useEffect(() => {
    if (!getToken()) { setBooted(true); return; }
    portalFetch('/me').then(setMe).catch(() => { localStorage.removeItem(TOKEN_KEY); }).finally(() => setBooted(true));
  }, []);

  function onLogin() { portalFetch('/me').then(setMe).catch(() => {}); }
  function logout() { localStorage.removeItem(TOKEN_KEY); setMe(null); }

  if (!booted) return <div style={wrap}><p style={{ color: '#64748b' }}>Cargando...</p></div>;
  if (!me) return <PortalLogin onLogin={onLogin} />;
  return <PortalDashboard me={me} onLogout={logout} onReload={() => portalFetch('/me').then(setMe).catch(() => {})} />;
}

const wrap = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F1F5F9', fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif", padding: 16 };

function PortalLogin({ onLogin }) {
  const [memberNumber, setMemberNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const r = await portalFetch('/login', { method: 'POST', body: JSON.stringify({ memberNumber: memberNumber.trim(), password }) });
      localStorage.setItem(TOKEN_KEY, r.token);
      onLogin(r);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  return (
    <div style={wrap}>
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', width: '100%', maxWidth: 400, overflow: 'hidden' }}>
        <div style={{ background: '#1E2A38', padding: '28px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>Gestumio</div>
          <div style={{ fontSize: 12, color: '#7DD3A0', marginTop: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Portal del socio</div>
        </div>
        <form onSubmit={submit} style={{ padding: '28px 32px' }}>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: '#4B5563' }}>Ingresá con tu <strong>número de socio</strong> y tu <strong>DNI</strong> (la primera vez).</p>
          {error && <div style={{ background: '#fef2f2', color: '#991b1b', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 14 }}>{error}</div>}
          <label style={lbl}>Número de socio</label>
          <input style={inp} value={memberNumber} onChange={(e) => setMemberNumber(e.target.value)} placeholder="Ej: 123456" autoFocus />
          <label style={lbl}>Contraseña (tu DNI la primera vez)</label>
          <input style={inp} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" disabled={loading} style={{ ...btn, width: '100%', marginTop: 8 }}>{loading ? 'Ingresando...' : 'Ingresar'}</button>
        </form>
      </div>
    </div>
  );
}

function PortalDashboard({ me, onLogout, onReload }) {
  const [showPass, setShowPass] = useState(false);
  const [showReserva, setShowReserva] = useState(false);
  const [appts, setAppts] = useState([]);
  const statusColor = { paid: '#16a34a', pending: '#d97706', overdue: '#dc2626' };
  const statusLabel = { paid: 'Al día', pending: 'Pendiente', overdue: 'Vencida' };

  function loadAppts() { portalFetch('/appointments').then(setAppts).catch(() => {}); }
  useEffect(() => { loadAppts(); }, []);

  async function cancelAppt(id) {
    if (!confirm('¿Cancelar este turno?')) return;
    try { await portalFetch('/appointments/' + id + '/cancel', { method: 'POST' }); loadAppts(); } catch (_) {}
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
      <div style={{ background: '#1E2A38', padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Gestumio</div>
          <div style={{ fontSize: 12, color: '#7DD3A0' }}>{me.businessName}</div>
        </div>
        <button onClick={onLogout} style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>Salir</button>
      </div>

      <div style={{ maxWidth: 620, margin: '0 auto', padding: 20 }}>
        <div style={cardS}>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Hola,</p>
          <h1 style={{ margin: '2px 0 4px', fontSize: 22 }}>{me.name}</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Socio N° <strong>{me.memberNumber}</strong></p>
        </div>

        <div style={{ ...cardS, background: me.balance > 0 ? '#fff7ed' : '#f0fdf4', border: `1px solid ${me.balance > 0 ? '#fed7aa' : '#bbf7d0'}` }}>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Saldo de cuenta</p>
          <div style={{ fontSize: 28, fontWeight: 800, color: me.balance > 0 ? '#c2410c' : '#15803d', marginTop: 4 }}>{fmtMoney(me.balance)}</div>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>{me.balance > 0 ? 'Tenés un saldo pendiente.' : 'Estás al día. ¡Gracias!'}</p>
        </div>

        <div style={cardS}>
          <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Mis actividades</h2>
          {me.activities.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>No estás inscripto en ninguna actividad.</p>
          ) : (
            me.activities.map((a, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < me.activities.length - 1 ? '1px solid #eef2f7' : 'none' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{fmtMoney(a.amount)} / mes{a.dueDate ? ` · vence ${fmtDate(a.dueDate)}` : ''}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: statusColor[a.status] || '#64748b' }}>{statusLabel[a.status] || a.status}</span>
              </div>
            ))
          )}
        </div>

        <div style={cardS}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Mis turnos</h2>
            <button onClick={() => setShowReserva(true)} style={{ ...btn, padding: '8px 14px', fontSize: 13 }}>+ Reservar turno</button>
          </div>
          {appts.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>No tenés turnos reservados.</p>
          ) : (
            appts.map((a, i) => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < appts.length - 1 ? '1px solid #eef2f7' : 'none' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{a.service}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{fmtDate(a.date)} · {a.startTime}{a.endTime ? '–' + a.endTime : ''}{a.price ? ' · ' + fmtMoney(a.price) : ''}</div>
                </div>
                <button onClick={() => cancelAppt(a.id)} style={{ background: 'none', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
              </div>
            ))
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <button onClick={() => setShowPass(true)} style={{ background: 'none', border: 'none', color: '#1BA84C', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>Cambiar contraseña</button>
        </div>
      </div>

      {showReserva && <ReservarTurnoModal onClose={() => setShowReserva(false)} onDone={() => { setShowReserva(false); loadAppts(); }} />}
      {showPass && <ChangePasswordModal onClose={() => setShowPass(false)} onDone={() => { setShowPass(false); onReload(); }} />}
    </div>
  );
}

function ChangePasswordModal({ onClose, onDone }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault(); setError('');
    if (pw.length < 4) return setError('Mínimo 4 caracteres');
    if (pw !== pw2) return setError('Las contraseñas no coinciden');
    setSaving(true);
    try { await portalFetch('/change-password', { method: 'POST', body: JSON.stringify({ newPassword: pw }) }); onDone(); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 360 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Cambiar contraseña</h2>
        {error && <div style={{ background: '#fef2f2', color: '#991b1b', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <form onSubmit={submit}>
          <label style={lbl}>Nueva contraseña</label>
          <input style={inp} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
          <label style={lbl}>Repetir contraseña</label>
          <input style={inp} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{ ...btn, background: '#e2e8f0', color: '#334155', flex: 1 }}>Cancelar</button>
            <button type="submit" disabled={saving} style={{ ...btn, flex: 1 }}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReservarTurnoModal({ onClose, onDone }) {
  const [services, setServices] = useState([]);
  const [form, setForm] = useState({ serviceId: '', date: new Date().toISOString().slice(0, 10), startTime: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { portalFetch('/services').then(setServices).catch(() => {}); }, []);

  async function submit(e) {
    e.preventDefault(); setError('');
    if (!form.serviceId || !form.date || !form.startTime) return setError('Elegí servicio, fecha y horario');
    setSaving(true);
    try {
      await portalFetch('/appointments', { method: 'POST', body: JSON.stringify(form) });
      onDone();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 380 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Reservar turno</h2>
        {error && <div style={{ background: '#fef2f2', color: '#991b1b', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        {services.length === 0 && <p style={{ fontSize: 13, color: '#64748b' }}>El negocio todavía no cargó servicios para reservar.</p>}
        <form onSubmit={submit}>
          <label style={lbl}>Servicio</label>
          <select style={inp} value={form.serviceId} onChange={(e) => setForm(f => ({ ...f, serviceId: e.target.value }))}>
            <option value="">Elegí un servicio...</option>
            {services.map(s => (<option key={s.id} value={s.id}>{s.name}{s.price ? ' — ' + fmtMoney(s.price) : ''}</option>))}
          </select>
          <label style={lbl}>Fecha</label>
          <input style={inp} type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} />
          <label style={lbl}>Horario</label>
          <input style={inp} type="time" value={form.startTime} onChange={(e) => setForm(f => ({ ...f, startTime: e.target.value }))} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" onClick={onClose} style={{ ...btn, background: '#e2e8f0', color: '#334155', flex: 1 }}>Cancelar</button>
            <button type="submit" disabled={saving} style={{ ...btn, flex: 1 }}>{saving ? 'Reservando...' : 'Reservar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', margin: '10px 0 4px' };
const inp = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' };
const btn = { background: '#1BA84C', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' };
const cardS = { background: '#fff', borderRadius: 14, padding: 18, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' };
