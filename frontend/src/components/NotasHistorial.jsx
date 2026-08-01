import { useEffect, useState } from 'react';
import api from '../api/client';
import confirmDialog from '../utils/confirm';

const TIPOS = [
  { key: 'nota',    label: 'Nota',    color: '#6b7280' },
  { key: 'llamado', label: 'Llamado', color: '#2563eb' },
  { key: 'visita',  label: 'Visita',  color: '#7c3aed' },
  { key: 'reclamo', label: 'Reclamo', color: '#dc2626' },
  { key: 'pago',    label: 'Pago',    color: '#16a34a' },
  { key: 'otro',    label: 'Otro',    color: '#0891b2' },
];
const tipoInfo = (k) => TIPOS.find(t => t.key === k) || TIPOS[0];
const fmtDT = (d) => d ? new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

// Notas tipo "sucesos con historial". entityType: client | supplier | workorder
export default function NotasHistorial({ entityType, entityId, title = 'Historial / notas', canDelete = true }) {
  const [items, setItems] = useState([]);
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState('nota');
  const [filtro, setFiltro] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    if (!entityId) return;
    setLoading(true);
    api.get('/entity-notes', { params: { entityType, entityId } })
      .then(r => setItems(Array.isArray(r.data) ? r.data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [entityId, entityType]);

  async function add() {
    const t = texto.trim();
    if (!t) return;
    setSaving(true);
    try { await api.post('/entity-notes', { entityType, entityId, tipo, texto: t }); setTexto(''); setTipo('nota'); load(); }
    catch (e) { alert(e.response?.data?.error || 'No se pudo guardar la nota'); }
    finally { setSaving(false); }
  }
  async function del(id) {
    if (!(await confirmDialog('¿Eliminar esta nota del historial?'))) return;
    try { await api.delete(`/entity-notes/${id}`); load(); } catch (e) { alert('No se pudo eliminar'); }
  }

  if (!entityId) return null;
  const vis = filtro ? items.filter(i => i.tipo === filtro) : items;

  return (
    <div>
      {title && <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>{title}</h3>}

      {/* Alta de un suceso */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 12 }}>
        <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ flex: '0 0 120px' }}>
          {TIPOS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <textarea rows="1" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escribí un suceso o nota…"
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) add(); }}
          style={{ flex: 1, minWidth: 160, resize: 'vertical' }} />
        <button type="button" className="btn btn-primary btn-sm" onClick={add} disabled={saving || !texto.trim()}>{saving ? '…' : 'Agregar'}</button>
      </div>

      {/* Filtro por tipo */}
      {items.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <button type="button" className="btn btn-sm" style={{ opacity: filtro ? 0.6 : 1, fontWeight: filtro ? 400 : 700 }} onClick={() => setFiltro('')}>Todos</button>
          {TIPOS.filter(t => items.some(i => i.tipo === t.key)).map(t => (
            <button key={t.key} type="button" className="btn btn-sm" style={{ color: t.color, opacity: filtro && filtro !== t.key ? 0.6 : 1 }} onClick={() => setFiltro(filtro === t.key ? '' : t.key)}>{t.label}</button>
          ))}
        </div>
      )}

      {/* Línea de tiempo */}
      {loading ? <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>Cargando…</p>
        : vis.length === 0 ? <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>Todavía no hay sucesos registrados.</p>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {vis.map(n => {
              const ti = tipoInfo(n.tipo);
              return (
                <div key={n.id} style={{ borderLeft: `3px solid ${ti.color}`, background: 'var(--bg)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: ti.color, textTransform: 'uppercase', letterSpacing: 0.3 }}>{ti.label}</span>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{fmtDT(n.createdAt)}{n.userName ? ' · ' + n.userName : ''}</span>
                      {canDelete && <button type="button" onClick={() => del(n.id)} title="Eliminar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)', fontSize: 13, padding: 0 }}>🗑</button>}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{n.texto}</div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}
