import { useState, useEffect, useMemo } from 'react';
import api from '../api/client';

const fmt = v => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v || 0);

export default function Prices() {
  const [activities, setActivities] = useState([]);
  const [services, setServices]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState(new Set()); // "type:id"
  const [percent, setPercent]       = useState('');
  const [saving, setSaving]         = useState(false);
  const [success, setSuccess]       = useState('');
  const [error, setError]           = useState('');
  const [filter, setFilter]         = useState('all'); // all | activity | service
  const [search, setSearch]         = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/prices');
      setActivities(res.data.activities || []);
      setServices(res.data.services || []);
    } catch (e) {
      setError('Error al cargar precios');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const allItems = useMemo(() => {
    const combined = [
      ...activities.map(a => ({ ...a, type: 'activity', typeLabel: 'Actividad' })),
      ...services.map(s => ({ ...s, type: 'service', typeLabel: 'Servicio', extra: s.duration ? `${s.duration} min` : '' })),
    ];
    return combined.filter(item => {
      const matchFilter = filter === 'all' || item.type === filter;
      const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [activities, services, filter, search]);

  const pct = parseFloat(percent) || 0;
  const previewPrice = price => {
    if (!pct || !price) return null;
    return Math.round(price * (1 + pct / 100) * 100) / 100;
  };

  function key(item) { return `${item.type}:${item.id}`; }

  function toggleItem(item) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key(item))) next.delete(key(item));
      else next.add(key(item));
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === allItems.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allItems.map(key)));
    }
  }

  async function applyUpdate() {
    if (!pct) return setError('Ingresá un porcentaje');
    if (selected.size === 0) return setError('Seleccioná al menos un elemento');
    if (pct <= -100) return setError('El porcentaje no puede ser -100% o menor');
    if (!window.confirm(`¿Aplicar ${pct > 0 ? '+' : ''}${pct}% a ${selected.size} elemento(s)?`)) return;

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const items = [...selected].map(k => {
        const [type, id] = k.split(':');
        return { type, id };
      });
      const res = await api.put('/prices/bulk-update', { items, percent: pct });
      setSuccess(`✅ ${res.data.updated} precio(s) actualizados correctamente`);
      setSelected(new Set());
      setPercent('');
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al actualizar precios');
    } finally {
      setSaving(false);
    }
  }

  const allSelected = allItems.length > 0 && selected.size === allItems.length;
  const someSelected = selected.size > 0 && selected.size < allItems.length;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Grilla de precios</h1>
          <p style={{ color: 'var(--ink-soft)', fontSize: 14, margin: '4px 0 0' }}>
            Actividades y servicios — ajustá precios individualmente o en lote
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card" style={{ marginBottom: 16, padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, width: 200 }}
          />

          {/* Filter */}
          <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {[['all','Todos'],['activity','Actividades'],['service','Servicios']].map(([v,l]) => (
              <button key={v} onClick={() => setFilter(v)} style={{
                padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none',
                background: filter === v ? 'var(--primary)' : 'var(--surface)',
                color: filter === v ? '#fff' : 'var(--ink)',
              }}>{l}</button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {/* % adjustment panel */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 500 }}>
              {selected.size > 0 ? `${selected.size} seleccionado(s)` : 'Ninguno seleccionado'}
            </span>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                placeholder="% (ej: 10 o -5)"
                value={percent}
                onChange={e => setPercent(e.target.value)}
                style={{ padding: '8px 12px 8px 28px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, width: 160 }}
              />
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-soft)', fontSize: 14, fontWeight: 600, pointerEvents: 'none' }}>%</span>
            </div>
            <button
              className="btn btn-primary"
              onClick={applyUpdate}
              disabled={saving || selected.size === 0 || !percent}
              style={{ whiteSpace: 'nowrap' }}
            >
              {saving ? 'Aplicando...' : pct > 0 ? `▲ Aumentar ${pct}%` : pct < 0 ? `▼ Reducir ${Math.abs(pct)}%` : 'Aplicar cambio'}
            </button>
          </div>
        </div>

        {error && <div className="error-banner" style={{ marginTop: 12 }}>{error}</div>}
        {success && <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 8, padding: '10px 14px', marginTop: 12, color: '#065f46', fontSize: 14 }}>{success}</div>}
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-soft)' }}>Cargando...</div>
        ) : allItems.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-soft)' }}>
            {search ? 'Sin resultados para esa búsqueda' : 'No hay actividades ni servicios cargados'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '11px 16px', textAlign: 'left', width: 40 }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={el => { if (el) el.indeterminate = someSelected; }}
                      onChange={toggleAll}
                      style={{ cursor: 'pointer', width: 16, height: 16 }}
                    />
                  </th>
                  <th style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nombre</th>
                  <th style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tipo</th>
                  <th style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 600, fontSize: 12, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Precio actual</th>
                  <th style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 600, fontSize: 12, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Precio nuevo</th>
                </tr>
              </thead>
              <tbody>
                {allItems.map(item => {
                  const isSelected = selected.has(key(item));
                  const preview = isSelected ? previewPrice(item.price) : null;
                  const diff = preview !== null ? preview - item.price : 0;

                  return (
                    <tr
                      key={key(item)}
                      onClick={() => toggleItem(item)}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        background: isSelected ? 'color-mix(in srgb, var(--primary) 6%, transparent)' : 'transparent',
                        transition: 'background 0.1s',
                      }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleItem(item)}
                          onClick={e => e.stopPropagation()}
                          style={{ cursor: 'pointer', width: 16, height: 16 }}
                        />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600 }}>{item.name}</div>
                        {item.description && <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{item.description}</div>}
                        {item.extra && <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>⏱ {item.extra}</div>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                          background: item.type === 'activity' ? '#dbeafe' : '#ede9fe',
                          color: item.type === 'activity' ? '#1e40af' : '#6d28d9',
                        }}>
                          {item.typeLabel}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: 15 }}>
                        {fmt(item.price)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {preview !== null ? (
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 15, color: pct > 0 ? '#10b981' : '#ef4444' }}>
                              {fmt(preview)}
                            </div>
                            <div style={{ fontSize: 11, color: pct > 0 ? '#10b981' : '#ef4444', marginTop: 1 }}>
                              {pct > 0 ? '+' : ''}{fmt(diff)}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--ink-soft)', fontSize: 13 }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary footer when items selected */}
      {selected.size > 0 && pct !== '' && pct !== '0' && (
        <div className="card" style={{ marginTop: 16, padding: '14px 20px', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Elementos</span>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{selected.size}</div>
          </div>
          <div>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ajuste</span>
            <div style={{ fontWeight: 700, fontSize: 18, color: pct > 0 ? '#10b981' : '#ef4444' }}>
              {pct > 0 ? '+' : ''}{pct}%
            </div>
          </div>
          {(() => {
            const selItems = allItems.filter(i => selected.has(key(i)));
            const totalBefore = selItems.reduce((s, i) => s + i.price, 0);
            const totalAfter  = selItems.reduce((s, i) => s + (previewPrice(i.price) || i.price), 0);
            return (
              <>
                <div>
                  <span style={{ fontSize: 12, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total antes</span>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{fmt(totalBefore)}</div>
                </div>
                <div>
                  <span style={{ fontSize: 12, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total después</span>
                  <div style={{ fontWeight: 700, fontSize: 18, color: pct > 0 ? '#10b981' : '#ef4444' }}>{fmt(totalAfter)}</div>
                </div>
              </>
            );
          })()}
          <div style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={applyUpdate} disabled={saving}>
            {saving ? 'Aplicando...' : `Confirmar ${pct > 0 ? 'aumento' : 'reducción'} de ${Math.abs(pct)}%`}
          </button>
        </div>
      )}
    </div>
  );
}
