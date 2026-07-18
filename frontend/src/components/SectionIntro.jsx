import { useEffect, useState } from 'react';
import api from '../api/client';

// Cache a nivel módulo: se consulta una sola vez por sesión.
let _seenCache = null;
let _seenPromise = null;
function loadSeen() {
  if (_seenCache) return Promise.resolve(_seenCache);
  if (!_seenPromise) {
    _seenPromise = api.get('/onboarding')
      .then(r => { _seenCache = (r.data && r.data.seen) || []; return _seenCache; })
      .catch(() => { _seenCache = []; return _seenCache; });
  }
  return _seenPromise;
}

// Cartel de bienvenida por sección. Se muestra una sola vez por usuario (persistido en el servidor).
export default function SectionIntro({ sectionKey, title, text }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let ok = true;
    setShow(false);
    loadSeen().then(seen => { if (ok) setShow(!seen.includes(sectionKey)); });
    return () => { ok = false; };
  }, [sectionKey]);

  function dismiss() {
    setShow(false);
    if (_seenCache && !_seenCache.includes(sectionKey)) _seenCache.push(sectionKey);
    api.post('/onboarding', { key: sectionKey }).catch(() => {});
  }

  if (!show) return null;
  return (
    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 22, lineHeight: 1 }}>💡</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{title}</p>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{text}</p>
      </div>
      <button onClick={dismiss} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>Entendido ✕</button>
    </div>
  );
}
