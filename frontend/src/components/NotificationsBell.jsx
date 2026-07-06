import { useState, useEffect, useRef } from 'react';

const BELL = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);
const ICON = { overdue: '🔴', upcoming: '🟠', 'appt-new': '📅', 'appt-cancel': '🚫', reminder: '⏰', confirmed: '✅', cancelled: '🚫' };

// Campanita de notificaciones reutilizable (app y portal).
// props: fetchItems() -> Promise<[{id,type,title,detail,ts}]>, storageKey (clave localStorage de "visto")
export default function NotificationsBell({ fetchItems, storageKey = 'notif_seen', bubble = false }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(() => Number(localStorage.getItem(storageKey) || 0));
  const ref = useRef(null);

  async function load() {
    try { const it = await fetchItems(); setItems(Array.isArray(it) ? it : []); } catch (_) {}
  }
  useEffect(() => { load(); const t = setInterval(load, 120000); return () => clearInterval(t); }, []); // eslint-disable-line
  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const unread = items.filter((i) => new Date(i.ts).getTime() > seen).length;
  function toggle() {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen) { const now = Date.now(); localStorage.setItem(storageKey, String(now)); setSeen(now); }
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button onClick={toggle} aria-label="Notificaciones" title="Notificaciones"
        style={bubble
          ? { position: 'relative', width: 46, height: 46, borderRadius: '50%', background: 'var(--surface, #fff)', border: '1px solid var(--border, #e5e7eb)', color: 'var(--ink, #1E2A38)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.18)' }
          : { position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: 6, lineHeight: 0, color: 'inherit' }}>
        {BELL}
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -2, right: -2, background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 800, minWidth: 16, height: 16, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 340, maxWidth: '90vw', maxHeight: 440, overflowY: 'auto', background: '#fff', color: '#1f2937', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.18)', border: '1px solid #e5e7eb', zIndex: 9999 }}>
          <div style={{ padding: '12px 16px', fontWeight: 700, borderBottom: '1px solid #eef2f7', position: 'sticky', top: 0, background: '#fff' }}>Notificaciones</div>
          {items.length === 0 ? (
            <div style={{ padding: 20, fontSize: 14, color: '#64748b', textAlign: 'center' }}>No hay novedades por ahora.</div>
          ) : (
            items.map((i) => (
              <div key={i.id} style={{ display: 'flex', gap: 10, padding: '10px 16px', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: 15, flexShrink: 0 }}>{ICON[i.type] || '🔔'}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{i.title}</div>
                  <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.4 }}>{i.detail}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
