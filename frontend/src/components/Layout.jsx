import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';

const links = [
  { to: '/', label: 'Inicio' },
  { to: '/actividades', label: 'Actividades' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/cobranza', label: 'Cobranza' },
  { to: '/empleados', label: 'Empleados' },
  { to: '/gastos', label: 'Gastos' },
  { to: '/proveedores', label: 'Proveedores' },
  { to: '/agenda', label: 'Agenda' },
  { to: '/caja', label: 'Caja del dia' },
  { to: '/reportes', label: 'Reportes' },
  { to: '/ajustes', label: 'Ajustes' },
];

export default function Layout() {
  const { business, logout, user } = useAuth();
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchFocus, setSearchFocus] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

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

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <div className="app-shell">
      {/* Mobile top header */}
      <header className="mobile-header">
        <button
          className="hamburger-btn"
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menu"
        >
          <span /><span /><span />
        </button>
        <span className="mobile-brand">{business?.name || 'Mi Negocio'}</span>
        <div style={{ position: 'relative', flex: 1, maxWidth: 180, margin: '0 8px' }}>
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
        <button
          className="mobile-theme-btn"
          onClick={() => setDark(!dark)}
          aria-label="Cambiar tema"
        >
          {dark ? 'Oscuro' : 'Claro'}
        </button>
      </header>

      {/* Overlay */}
      {menuOpen && (
        <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />
      )}

      {/* Sidebar / drawer */}
      <aside className={`sidebar${menuOpen ? ' sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">{business?.name || 'Mi Negocio'}</div>
          <button
            className="sidebar-close-btn"
            onClick={() => setMenuOpen(false)}
            aria-label="Cerrar menu"
          >
            X
          </button>
        </div>

        <div style={{ padding: '8px 12px', position: 'relative' }}>
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onFocus={() => setSearchFocus(true)}
            onBlur={() => setTimeout(() => setSearchFocus(false), 200)}
            placeholder="🔍 Buscar..."
            style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', fontSize: 13, background: 'rgba(255,255,255,0.1)', color: 'inherit', boxSizing: 'border-box' }}
          />
          {searchFocus && searchResults && (searchResults.clients.length > 0 || searchResults.activities.length > 0) && (
            <SearchDropdown results={searchResults} onSelect={handleSearchSelect} />
          )}
        </div>

        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            {link.label}
          </NavLink>
        ))}

        <div className="sidebar-footer">
          {business?.category && <div style={{ marginBottom: 4 }}>{business.category}</div>}
          {user?.name && <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>{user.name}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 12 }}>{dark ? 'Oscuro' : 'Claro'}</span>
            <button
              onClick={() => setDark(!dark)}
              style={{
                background: dark ? 'var(--primary)' : '#e5e7eb',
                border: 'none',
                borderRadius: 12,
                width: 36,
                height: 20,
                cursor: 'pointer',
                position: 'relative',
                padding: 0,
                transition: 'background .2s',
              }}
              aria-label="Modo oscuro"
            >
              <span style={{
                position: 'absolute',
                top: 2,
                left: dark ? 18 : 2,
                width: 16,
                height: 16,
                background: 'white',
                borderRadius: '50%',
                transition: 'left .2s',
              }} />
            </button>
          </div>
          <button onClick={logout}>Cerrar sesion</button>
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
      background: 'white', border: '1px solid #e5e7eb', borderRadius: 10,
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden',
      color: '#1f2937',
    }}>
      {clients.length > 0 && (
        <>
          <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#f9fafb' }}>Clientes</div>
          {clients.map((c) => (
            <button key={c.id} onClick={() => onSelect(`/clientes/${c.id}`)}
              style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column' }}
              onMouseOver={(e) => e.currentTarget.style.background = '#f3f4f6'}
              onMouseOut={(e) => e.currentTarget.style.background = 'none'}
            >
              <span style={{ fontWeight: 600 }}>{c.name}</span>
              {c.phone && <span style={{ fontSize: 12, color: '#9ca3af' }}>{c.phone}</span>}
            </button>
          ))}
        </>
      )}
      {activities.length > 0 && (
        <>
          <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#f9fafb' }}>Actividades</div>
          {activities.map((a) => (
            <button key={a.id} onClick={() => onSelect(`/actividades/${a.id}`)}
              style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #f3f4f6' }}
              onMouseOver={(e) => e.currentTarget.style.background = '#f3f4f6'}
              onMouseOut={(e) => e.currentTarget.style.background = 'none'}
            >
              <span style={{ fontWeight: 600 }}>{a.name}</span>
              {a.schedule && <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 6 }}>{a.schedule}</span>}
            </button>
          ))}
        </>
      )}
    </div>
  );
}
