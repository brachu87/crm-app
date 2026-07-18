import { useEffect, useState } from 'react';
import api from '../api/client';

const ACTIONS = {
  cobro:             { label: 'Cobro registrado', icon: '💵', color: '#16a34a' },
  factura:           { label: 'Factura emitida', icon: '🧾', color: '#2563eb' },
  baja_cliente:      { label: 'Baja de cliente', icon: '⬇️', color: '#d97706' },
  reactivo_cliente:  { label: 'Reactivó cliente', icon: '⬆️', color: '#16a34a' },
  elimino_cliente:   { label: 'Eliminó cliente', icon: '🗑️', color: '#dc2626' },
  elimino_gasto:     { label: 'Eliminó gasto', icon: '🗑️', color: '#dc2626' },
};
const fmtDT = (d) => d ? new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

export default function Auditoria() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [fAction, setFAction] = useState('');

  useEffect(() => {
    api.get('/audit').then(r => setItems(Array.isArray(r.data) ? r.data : [])).catch(() => setItems([])).finally(() => setLoading(false));
  }, []);

  const filtered = items.filter(i => {
    if (fAction && i.action !== fAction) return false;
    if (q) {
      const hay = `${i.userName || ''} ${i.detail || ''} ${ACTIONS[i.action]?.label || i.action}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Historial de actividad</h1>
          <p className="page-subtitle">Quién hizo qué y cuándo — cobros, facturas, bajas y eliminaciones.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
        <input className="field-input" style={{ maxWidth: 260 }} placeholder="Buscar (usuario, detalle)…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="field-input" style={{ maxWidth: 220 }} value={fAction} onChange={e => setFAction(e.target.value)}>
          <option value="">Todas las acciones</option>
          {Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {loading ? <p style={{ color: 'var(--ink-soft)' }}>Cargando…</p> : filtered.length === 0 ? (
        <p style={{ color: 'var(--ink-soft)', padding: '20px 0' }}>Sin actividad registrada todavía.</p>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead>
            <tbody>
              {filtered.map(i => {
                const a = ACTIONS[i.action] || { label: i.action, icon: '•', color: 'var(--ink-soft)' };
                return (
                  <tr key={i.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{fmtDT(i.createdAt)}</td>
                    <td style={{ fontSize: 13 }}>{i.userName || '—'}</td>
                    <td><span style={{ color: a.color, fontWeight: 600, fontSize: 13 }}>{a.icon} {a.label}</span></td>
                    <td style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{i.detail || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
