import { useEffect, useState } from 'react';
import confirmDialog from '../utils/confirm';

const TOKEN_KEY = 'portal_token';
function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
function fmtMoney(v) { return '$' + Number(v || 0).toLocaleString('es-AR'); }
function fmtDate(d) { if (!d) return ''; const s = String(d); return new Date(s.includes('T') ? s : s + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }

async function portalFetch(path, options = {}) {
  const res = await fetch('/api/portal' + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}), ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error');
  return data;
}

// ── Logo de Gestumio (G abierta + barras navy + punto verde) ──────────────
function Logo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-label="Gestumio">
      <defs>
        <linearGradient id="gLogoGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3BC559" />
          <stop offset="1" stopColor="#159B57" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="35" fill="none" stroke="url(#gLogoGrad)" strokeWidth="11" strokeLinecap="round" strokeDasharray="178 42" transform="rotate(28 50 50)" />
      <rect x="47" y="40" width="35" height="10" rx="5" fill="#1E2A38" />
      <rect x="47" y="55" width="35" height="10" rx="5" fill="#1E2A38" />
      <circle cx="53" cy="75" r="6" fill="#22C55E" />
    </svg>
  );
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
      <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 8px 30px rgba(0,0,0,0.10)', width: '100%', maxWidth: 400, overflow: 'hidden' }}>
        <div style={{ background: '#fff', padding: '32px 32px 8px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Logo size={64} /></div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1E2A38', letterSpacing: '-0.5px' }}>Gestumio</div>
          <div style={{ fontSize: 12, color: '#159B57', marginTop: 2, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>Portal del socio</div>
        </div>
        <form onSubmit={submit} style={{ padding: '16px 32px 32px' }}>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: '#4B5563', textAlign: 'center' }}>Ingresá con tu <strong>número de socio</strong> y tu <strong>DNI</strong> (la primera vez).</p>
          {error && <div style={{ background: '#fef2f2', color: '#991b1b', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 14 }}>{error}</div>}
          <label style={lbl}>Número de socio</label>
          <input style={inp} value={memberNumber} onChange={(e) => setMemberNumber(e.target.value)} placeholder="Ej: 123456" autoFocus />
          <label style={lbl}>Contraseña (tu DNI la primera vez)</label>
          <input style={inp} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" disabled={loading} style={{ ...btn, width: '100%', marginTop: 10 }}>{loading ? 'Ingresando...' : 'Ingresar'}</button>
        </form>
      </div>
    </div>
  );
}

const NAV = [
  { key: 'inicio', label: 'Inicio', icon: '🏠' },
  { key: 'turnos', label: 'Turnos', icon: '📅' },
  { key: 'clases', label: 'Clases', icon: '🏋️' },
  { key: 'perfil', label: 'Perfil', icon: '👤' },
];

function PortalDashboard({ me, onLogout, onReload }) {
  const [section, setSection] = useState('inicio');
  const [showPass, setShowPass] = useState(false);
  const [showReserva, setShowReserva] = useState(false);
  const [appts, setAppts] = useState([]);
  const [classes, setClasses] = useState([]);
  const [myClasses, setMyClasses] = useState([]);
  const [reserving, setReserving] = useState(null);

  const statusColor = { paid: '#16a34a', pending: '#d97706', overdue: '#dc2626' };
  const statusLabel = { paid: 'Al día', pending: 'Pendiente', overdue: 'Vencida' };

  function loadAppts() { portalFetch('/appointments').then(setAppts).catch(() => {}); }
  function loadClasses() {
    portalFetch('/classes').then(setClasses).catch(() => {});
    portalFetch('/my-classes').then(setMyClasses).catch(() => {});
  }
  useEffect(() => { loadAppts(); loadClasses(); }, []);

  async function cancelAppt(id) {
    if (!await confirmDialog('¿Cancelar este turno?')) return;
    try { await portalFetch('/appointments/' + id + '/cancel', { method: 'POST' }); loadAppts(); } catch (_) {}
  }
  async function reserveClass(id) {
    setReserving(id);
    try { await portalFetch('/classes/' + id + '/reserve', { method: 'POST' }); loadClasses(); }
    catch (e) { alert(e.message); } finally { setReserving(null); }
  }
  async function cancelClass(id) {
    if (!await confirmDialog('¿Cancelar tu reserva de clase?')) return;
    try { await portalFetch('/class-reservations/' + id + '/cancel', { method: 'POST' }); loadClasses(); } catch (_) {}
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: '#1E2A38', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ background: '#fff', borderRadius: 10, padding: 4, display: 'flex' }}><Logo size={30} /></span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', lineHeight: 1 }}>Gestumio</div>
            <div style={{ fontSize: 11, color: '#7DD3A0' }}>{me.businessName}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>Salir</button>
      </div>

      {/* Navbar de secciones */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', maxWidth: 620, width: '100%' }}>
          {NAV.map(n => {
            const active = section === n.key;
            return (
              <button key={n.key} onClick={() => setSection(n.key)}
                style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '12px 4px 10px', fontSize: 13, fontWeight: active ? 700 : 500,
                  color: active ? '#159B57' : '#64748b', borderBottom: active ? '3px solid #159B57' : '3px solid transparent' }}>
                <div style={{ fontSize: 18, lineHeight: 1, marginBottom: 3 }}>{n.icon}</div>
                {n.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ maxWidth: 620, margin: '0 auto', padding: 20 }}>

        {section === 'inicio' && (
          <>
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
          </>
        )}

        {section === 'turnos' && (
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
                    {a.status === 'pending' && <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', marginTop: 3 }}>⏳ Pendiente de confirmación</div>}
                  </div>
                  <button onClick={() => cancelAppt(a.id)} style={btnCancel}>Cancelar</button>
                </div>
              ))
            )}
          </div>
        )}

        {section === 'clases' && (
          <div style={cardS}>
            <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>Reservar cupo en clases</h2>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#64748b' }}>Próxima fecha de cada clase.</p>
            {classes.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>No hay clases con horario disponibles.</p>
            ) : (
              classes.map((c, i) => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < classes.length - 1 ? '1px solid #eef2f7' : 'none' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{c.activity}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{c.dayLabel} {fmtDate(c.date)} · {c.startTime}–{c.endTime}{c.maxCapacity ? ` · ${c.spotsLeft} cupos libres` : ''}</div>
                  </div>
                  {c.alreadyReserved ? (
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>Reservado ✓</span>
                  ) : (c.maxCapacity && c.spotsLeft <= 0) ? (
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>Sin cupos</span>
                  ) : (
                    <button onClick={() => reserveClass(c.id)} disabled={reserving === c.id} style={{ ...btn, padding: '6px 12px', fontSize: 12 }}>{reserving === c.id ? '...' : 'Reservar'}</button>
                  )}
                </div>
              ))
            )}
            {myClasses.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
                <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700 }}>Mis clases reservadas</p>
                {myClasses.map((r) => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                    <div style={{ fontSize: 13 }}>{r.activity} · {fmtDate(r.date)} {r.startTime}</div>
                    <button onClick={() => cancelClass(r.id)} style={btnCancel}>Cancelar</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {section === 'perfil' && (
          <div style={cardS}>
            <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Mi perfil</h2>
            <Field label="Nombre" value={me.name} />
            <Field label="Número de socio" value={me.memberNumber} />
            <Field label="Negocio" value={me.businessName} />
            <div style={{ marginTop: 16 }}>
              <button onClick={() => setShowPass(true)} style={{ ...btn, background: '#1E2A38' }}>Cambiar contraseña</button>
            </div>
          </div>
        )}
      </div>

      {showReserva && <ReservarTurnoModal onClose={() => setShowReserva(false)} onDone={() => { setShowReserva(false); loadAppts(); }} />}
      {showPass && <ChangePasswordModal onClose={() => setShowPass(false)} onDone={() => { setShowPass(false); onReload(); }} />}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid #eef2f7' }}>
      <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{value || '—'}</div>
    </div>
  );
}

function ymd(dt) {
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}
const DOW_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function ReservarTurnoModal({ onClose, onDone }) {
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState(null);      // null = aún no cargó
  const [selected, setSelected] = useState('');  // startTime elegido
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { portalFetch('/services').then(setServices).catch(() => {}); }, []);

  const service = services.find(s => s.id === serviceId);
  const serviceDays = service?.days || [];

  // Próximos 21 días; habilitados solo los que el servicio atiende
  const days = [];
  { const base = new Date(); base.setHours(0, 0, 0, 0);
    for (let i = 0; i < 21; i++) {
      const dt = new Date(base); dt.setDate(base.getDate() + i);
      days.push({ str: ymd(dt), dow: dt.getDay(), dayNum: dt.getDate(), month: dt.getMonth(), enabled: serviceDays.includes(dt.getDay()) });
    }
  }

  // Al elegir servicio, seleccionar el primer día disponible
  useEffect(() => {
    setSelected(''); setSlots(null);
    if (!service) { setDate(''); return; }
    const first = days.find(d => d.enabled);
    setDate(first ? first.str : '');
  }, [serviceId]); // eslint-disable-line

  // Cargar disponibilidad al cambiar servicio o fecha
  useEffect(() => {
    if (!serviceId || !date) { setSlots(null); return; }
    setLoadingSlots(true); setSelected('');
    portalFetch('/availability?serviceId=' + encodeURIComponent(serviceId) + '&date=' + encodeURIComponent(date))
      .then(r => setSlots(r.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [serviceId, date]);

  async function reservar() {
    if (!serviceId || !date || !selected) return;
    setSaving(true); setError('');
    try {
      await portalFetch('/appointments', { method: 'POST', body: JSON.stringify({ serviceId, date, startTime: selected }) });
      onDone();
    } catch (err) { setError(err.message); setSaving(false); }
  }

  return (
    <div style={overlay}>
      <div style={{ ...modalBox, maxWidth: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Reservar turno</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, lineHeight: 1, color: '#94a3b8', cursor: 'pointer' }}>×</button>
        </div>
        {error && <div style={errBox}>{error}</div>}
        {services.length === 0 && <p style={{ fontSize: 13, color: '#64748b' }}>El negocio todavía no cargó servicios para reservar.</p>}

        <label style={lbl}>Servicio</label>
        <select style={inp} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value="">Elegí un servicio...</option>
          {services.map(s => (<option key={s.id} value={s.id}>{s.name}{s.price ? ' — ' + fmtMoney(s.price) : ''}</option>))}
        </select>

        {service && serviceDays.length === 0 && (
          <p style={{ fontSize: 13, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px', marginTop: 12 }}>
            Este servicio todavía no tiene horarios de atención cargados. Pedile al negocio que los configure.
          </p>
        )}

        {service && serviceDays.length > 0 && (
          <>
            <label style={lbl}>Día</label>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, WebkitOverflowScrolling: 'touch' }}>
              {days.map(d => {
                const active = d.str === date;
                return (
                  <button key={d.str} type="button" disabled={!d.enabled} onClick={() => setDate(d.str)}
                    style={{
                      flex: '0 0 auto', width: 54, padding: '8px 0', borderRadius: 10, cursor: d.enabled ? 'pointer' : 'not-allowed',
                      border: active ? '2px solid #159B57' : '1px solid #e2e8f0',
                      background: active ? '#ecfdf5' : (d.enabled ? '#fff' : '#f8fafc'),
                      color: d.enabled ? '#1E2A38' : '#cbd5e1', textAlign: 'center',
                    }}>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{DOW_SHORT[d.dow]}</div>
                    <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.1 }}>{d.dayNum}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>{MONTH_SHORT[d.month]}</div>
                  </button>
                );
              })}
            </div>

            <label style={lbl}>Horario</label>
            {loadingSlots ? (
              <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0' }}>Cargando horarios...</p>
            ) : !slots || slots.length === 0 ? (
              <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0' }}>No hay turnos para este día.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 8, marginTop: 4 }}>
                {slots.map(sl => {
                  const isSel = selected === sl.startTime;
                  return (
                    <button key={sl.startTime} type="button" disabled={sl.occupied}
                      onClick={() => setSelected(sl.startTime)}
                      title={sl.occupied ? 'Ocupado' : sl.startTime + '–' + sl.endTime}
                      style={{
                        padding: '10px 4px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                        cursor: sl.occupied ? 'not-allowed' : 'pointer',
                        border: isSel ? '2px solid #159B57' : '1px solid #e2e8f0',
                        background: sl.occupied ? '#f1f5f9' : (isSel ? '#159B57' : '#fff'),
                        color: sl.occupied ? '#94a3b8' : (isSel ? '#fff' : '#1E2A38'),
                        textDecoration: sl.occupied ? 'line-through' : 'none',
                      }}>
                      {sl.startTime}
                      {sl.occupied && <div style={{ fontSize: 9, fontWeight: 600, textDecoration: 'none' }}>ocupado</div>}
                    </button>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button type="button" onClick={onClose} style={{ ...btn, background: '#e2e8f0', color: '#334155', flex: 1 }}>Cancelar</button>
              <button type="button" onClick={reservar} disabled={!selected || saving} style={{ ...btn, flex: 1, opacity: (!selected || saving) ? 0.6 : 1 }}>
                {saving ? 'Reservando...' : selected ? ('Reservar ' + selected) : 'Elegí un horario'}
              </button>
            </div>
          </>
        )}
      </div>
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
    <div style={overlay}>
      <div style={modalBox}>
        <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Cambiar contraseña</h2>
        {error && <div style={errBox}>{error}</div>}
        <form onSubmit={submit}>
          <label style={lbl}>Nueva contraseña</label>
          <input style={inp} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
          <label style={lbl}>Repetir contraseña</label>
          <input style={inp} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" onClick={onClose} style={{ ...btn, background: '#e2e8f0', color: '#334155', flex: 1 }}>Cancelar</button>
            <button type="submit" disabled={saving} style={{ ...btn, flex: 1 }}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', margin: '10px 0 4px' };
const inp = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' };
const btn = { background: '#159B57', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' };
const btnCancel = { background: 'none', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' };
const cardS = { background: '#fff', borderRadius: 14, padding: 18, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100, overflowY: 'auto', boxSizing: 'border-box' };
const modalBox = { background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 380, maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' };
const errBox = { background: '#fef2f2', color: '#991b1b', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 12 };
