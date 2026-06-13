import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';

const links = [
  { to: '/', label: 'Inicio', icon: '🏠' },
  { to: '/actividades', label: 'Actividades', icon: '🏃' },
  { to: '/clientes', label: 'Clientes', icon: '👥' },
  { to: '/cobranza', label: 'Cobranza', icon: '💳' },
  { to: '/empleados', label: 'Empleados', icon: '👤' },
  { to: '/gastos', label: 'Gastos', icon: '📋' },
  { to: '/proveedores', label: 'Proveedores', icon: '🏢' },
  { to: '/agenda', label: 'Agenda', icon: '📝' },
  { to: '/caja', label: 'Caja del día', icon: '💰' },
  { to: '/reportes', label: 'Reportes', icon: '📊' },
  { to: '/ajustes', label: 'Ajustes', icon: '⚙️' },
];

export default function Layout() {
  const { business, logout, user } = useAuth();
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

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
          aria-label="Abrir menú"
        >
          <span /><span /><span />
        </button>
        <span className="mobile-brand">{business?.name || 'Mi Negocio'}</span>
        <button
          className="mobile-theme-btn"
          onClick={() => setDark(!dark)}
          aria-label="Cambiar tema"
        >
          {dark ? '🌙' : '☀️'}
        </button>
      </header>

      {/* Overlay */}
      {menuOpen && (
        <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar${menuOpen ? ' sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">{business?.name || 'Mi Negocio'}</div>
          <button
            className="sidebar-close-btn"
            onClick={() => setMenuOpen(false)}
            aria-label="Cerrar menú"
          >
            ✕
          </button>
        </div>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
           