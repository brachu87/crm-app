import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState, useCallback, useRef } from 'react';

const NAV_GROUPS = [
  {
    label: 'Negocio',
    icon: '🏪',
    links: [
      { to: '/clientes', label: 'Clientes' },
      { to: '/actividades', label: 'Actividades/Servicios' },
      { to: '/agenda', label: 'Agenda' },
      { to: '/proveedores', label: 'Proveedores' },
    ],
  },
  {
    label: 'Empleados',
    icon: '👥',
    links: [
      { to: '/empleados', label: 'Empleados' },
      { to: '/asistencias', label: 'Asistencias' },
      { to: '/liquidaciones', label: 'Liquidaciones' },
      { to: '/horarios', label: 'Horarios' },
    ],
  },
  {
    label: 'Finanzas',
    icon: '💰',
    links: [
      { to: '/cobranza', label: 'Cobranza' },
      { to: '/caja', label: 'Caja del día' },
      { to: '/reportes', label: 'Reportes' },
      { to: '/gastos', label: 'Gastos' },
    ],
  },
  {
    label: 'Configuración',
    icon: '⚙️',
    links: [
      { to: '/ajustes', label: 'Ajustes' },
      { to: '/sedes', label: 'Sedes' },
    ],
  },
];

function activeGroup(pathname) {
  for (const g of NAV_GROUPS) {
    if (g.links.some(l => pathname === l.to || pathname.startsWith(l.to + '/'))) return g.label;
  }
  return null;
}

export default function Layout() {
  const { business, logout, user } = useAuth();
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoTs] = useState(Date.now());
  const [logoOk, setLogoOk] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchFocus, setSearchFocus] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Which accordion group is open
  const [openGroup, setOpenGroup] = useState(() => activeGroup(location.pathname));

  // When route changes, auto-open the relevant group
  useEffect(() => {
    const grp = activeGroup(location.pathname);
    if (grp) setOpenGroup(grp);
  }, [location.pathname]);

  useEffect(() => {
    if (searchQ.length < 2) { setSearchResults(null); return; }
    const timer = setTimeout(() => {
      import('../api/client').then(({ default: api }) => {
        api.get(`/search?q=${encodeURIComponent(searchQ)}`)
          .then((r) => setSearchResults(r.data))
          .catch(() => setSearchResults(null));
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQ]);

  function handleSearchSelect(path) {
    setSearchQ('');
    setSearchResults(null);
    setSearchFocus(false);
    navigate(path);
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  function toggleGroup(label) {
    setOpenGroup(prev => prev === label ? null : label);
  }

  // ── Auto-logout por inactividad (2 horas) ─────────────────────────────────
  const INACTIVITY_MS = 2 * 60 * 60 * 1000;   // 2 horas
  const WARN_BEFORE_MS = 60 * 1000;             // aviso 1 minuto antes
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const idleTimer    = useRef(null);
  const warnTimer    = useRef(null);

  const resetIdleTimer = useCallback(() => {
    setShowIdleWarning(false);
    clearTimeout(idleTimer.current);
    clearTimeout(warnTimer.current);
    warnTimer.current = setTimeout(() => setShowIdleWarning(true), INACTIVITY_MS - WARN_BEFORE_MS);
    idleTimer.current = setTimeout(() => {
      setShowIdleWarning(false);
      logout();
    }, INACTIVITY_MS);
  }, [logout]);

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }));
    resetIdleTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
      clearTimeout(idleTimer.current);
      clearTimeout(warnTimer.current);
    };
  }, [resetIdleTimer]);
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="app-shell">
      {showIdleWarning && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#92400e', color: '#fff',
          padding: '12px 20px', fontSize: 14, display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', gap: 16,
          boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        }}>
          <span>⏰ <strong>Sesión por vencer</strong> — Por inactividad, la sesión se cerrará en 1 minuto.</span>
          <button
            onClick={resetIdleTimer}
            style={{ background: '#fff', color: '#92400e', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
          >
            Seguir conectado
          </button>
        </div>
      )}
      {/* Mobile top header */}
      <header className="mobile-header">
        <button className="hamburger-btn" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">
          <span /><span /><span />
        </button>
        <span className="mobile-brand" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {logoOk && (
            <img
              src={`/api/business/logo?t=${logoTs}&token=${localStorage.getItem('token')}`}
              alt=""
              style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
              onError={() => setLogoOk(false)}
            />
          )}
          {business?.name || 'Mi Negocio'}
        </span>
        <div className="mobile-header-search" style={{ position: 'relative', flex: 1, maxWidth: 180, margin: '0 8px' }}>
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onFocus={() => setSearchFocus(true)}
            onBlur={() => setTimeout(() => setSearchFocus(false), 200)}
            placeholder="Buscar..."
            style={{ width: '100%', padding: '5px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, background: 'var(--bg-card)' }}
          />
          {searchFocus && searchResults && (searchResults.clients.length > 0 || searchResults.activities.length > 0) && (
            <SearchDropdown results={searchResults} onSelect={handleSearchSelect} />
          )}
        </div>
        <button className="mobile-theme-btn" onClick={() => setDark(!dark)} aria-label="Cambiar tema">
          {dark ? 'Oscuro' : 'Claro'}
        </button>
      </header>

      {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />}

      <aside className={`sidebar${menuOpen ? ' sidebar-open' : ''}`}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {logoOk && (
              <img
                src={`/api/business/logo?t=${logoTs}&token=${localStorage.getItem('token')}`}
                alt=""
                style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                onError={() => setLogoOk(false)}
              />
            )}
            <span>{business?.name || 'Mi Negocio'}</span>
          </div>
          <button className="sidebar-close-btn" onClick={() => setMenuOpen(false)} aria-label="Cerrar menu">X</button>
        </div>

        {/* Search */}
        <div style={{ padding: '8px 12px', position: 'relative' }}>
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onFocus={() => setSearchFocus(true)}
            onBlur={() => setTimeout(() => setSearchFocus(false), 200)}
            placeholder="🔍 Buscar..."
            style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, background: 'var(--bg)', color: 'var(--ink)', boxSizing: 'border-box' }}
          />
          {searchFocus && searchResults && (searchResults.clients.length > 0 || searchResults.activities.length > 0) && (
            <SearchDropdown results={searchResults} onSelect={handleSearchSelect} />
          )}
        </div>

        {/* Inicio */}
        <NavLink to="/" end className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          Inicio
        </NavLink>

        {/* Accordion groups */}
        {NAV_GROUPS.map((group) => {
          const isOpen = openGroup === group.label;
          const hasActive = group.links.some(l =>
            location.pathname === l.to || location.pathname.startsWith(l.to + '/')
          );
          return (
            <div key={group.label}>
              {/* Group header button */}
              <button
                onClick={() => toggleGroup(group.label)}
                className="sidebar-group-btn"
                style={{
                  color: hasActive ? 'var(--ink)' : 'var(--ink-soft)',
                  fontWeight: hasActive ? 700 : 500,
                }}
              >
                <span style={{ fontSize: 15 }}>{group.icon}</span>
                <span style={{ flex: 1 }}>{group.label}</span>
                <span style={{
                  fontSize: 11,
                  opacity: 0.7,
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                  display: 'inline-block',
                }}>▼</span>
              </button>

              {/* Sub-links */}
              {isOpen && (
                <div style={{ paddingBottom: 4 }}>
                  {group.links.map((link) => (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      className={({ isActive }) => `sidebar-link sidebar-sublink${isActive ? ' active' : ''}`}
                    >
                      {link.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Footer */}
        <div className="sidebar-footer">
          {business?.category && <div style={{ marginBottom: 4 }}>{business.category}</div>}
          {user?.name && <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>{user.name}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 12 }}>{dark ? 'Oscuro' : 'Claro'}</span>
            <button
              onClick={() => setDark(!dark)}
              style={{
                background: dark ? 'var(--primary)' : 'var(--border)',
                border: 'none', borderRadius: 12, width: 36, height: 20,
                cursor: 'pointer', position: 'relative', padding: 0, transition: 'background .2s',
              }}
              aria-label="Modo oscuro"
            >
              <span style={{
                position: 'absolute', top: 2, left: dark ? 18 : 2,
                width: 16, height: 16,
                background: dark ? '#e8e8e8' : 'white',
                borderRadius: '50%', transition: 'left .2s',
              }} />
            </button>
          </div>
          <button onClick={logout}>Cerrar sesion</button>
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
            <span style={{ fontSize: 11, opacity: 0.4, letterSpacing: '0.03em' }}>
              <span style={{ fontWeight: 700 }}>z</span>entric
            </span>
          </div>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

function SearchDropdown({ results, onSelect }) {
  const { clients = [], activities = [] } = results;
  return (
    <div style={{
      position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 9999,
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden', color: '#1f2937',
    }}>
      {clients.length > 0 && (
        <>
          <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--bg)' }}>Clientes</div>
          {clients.map((c) => (
            <button key={c.id} onClick={() => onSelect(`/clientes/${c.id}`)}
              style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column' }}
              onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'none'}
            >
              <span style={{ fontWeight: 600 }}>{c.name}</span>
              {c.phone && <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{c.phone}</span>}
            </button>
          ))}
        </>
      )}
      {activities.length > 0 && (
        <>
          <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--bg)' }}>Actividades</div>
          {activities.map((a) => (
            <button key={a.id} onClick={() => onSelect(`/actividades/${a.id}`)}
              style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #f3f4f6' }}
              onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'none'}
            >
              <span style={{ fontWeight: 600 }}>{a.name}</span>
            </button>
          ))}
        </>
      )}
    </div>
  );
}
