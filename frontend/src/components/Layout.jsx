import { NavLink, Outlet } from 'react-router-dom';
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
  { to: '/caja', label: 'Caja del día' },
  { to: '/reportes', label: 'Reportes' },
  { to: '/ajustes', label: 'Ajustes' },
];

export default function Layout() {
  const { business, logout, user } = useAuth();
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          {business?.name || 'Mi Negocio'}
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
            <span style={{ fontSize: 12 }}>{dark ? '🌙' : '☀️'}</span>
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
          <button onClick={logout}>Cerrar sesión</button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
