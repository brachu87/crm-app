import { useState } from 'react';

// Ícono de ojo (mostrar) y ojo tachado (ocultar)
const EyeIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOffIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);

// Input de contraseña con botón para mostrar/ocultar. Acepta las mismas props que <input>.
export default function PasswordInput({ style, ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        {...props}
        type={show ? 'text' : 'password'}
        style={{ ...(style || {}), width: '100%', paddingRight: 42, boxSizing: 'border-box' }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        tabIndex={-1}
        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        title={show ? 'Ocultar' : 'Mostrar'}
        style={{
          position: 'absolute', right: 6, top: 0, bottom: 0, width: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          color: 'var(--ink-soft, #64748b)',
        }}
      >
        {show ? EyeOffIcon : EyeIcon}
      </button>
    </div>
  );
}
