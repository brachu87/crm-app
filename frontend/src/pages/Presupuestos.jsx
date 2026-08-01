import { useEffect, useState } from 'react';
import api from '../api/client';
import { useSectionPerms } from '../config/permissions';
import confirmDialog from '../utils/confirm';

const fmt = (v) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(v || 0);
const fdate = (d) => d ? new Date(d).toLocaleDateString('es-AR') : '-';
const ESTADOS = {
  borrador:  { label: 'Borrador',  cls: 'pill' },
  enviado:   { label: 'Enviado',   cls: 'pill pill-amber' },
  aceptado:  { label: 'Aceptado',  cls: 'pill pill-paid' },
  rechazado: { label: 'Rechazado', cls: 'pill pill-overdue' },
};

async function downloadPdf(id, numero) {
  try {
    const res = await api.get(`/budgets/${id}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noreferrer';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch { alert('No se pudo generar el PDF'); }
}

export default function Presupuestos() {
  const can = useSectionPerms('presupuestos');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  function load() {
    api.get('/budgets').then(r => setList(Array.isArray(r.data) ? r.data : [])).catch(() => setList([])).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function setStatus(b, status) {
    try { await api.put(`/budgets/${b.id}`, { status }); load(); } catch (e) { alert(e.response?.data?.error || 'Error'); }
  }
  async function del(b) {
    if (!(await confirmDialog(`¿Eliminar el presupuesto N° ${String(b.numero).padStart(6, '0')}?`))) return;
    try { await api.delete(`/budgets/${b.id}`); load(); } catch (e) { alert(e.response?.data?.error || 'Error'); }
  }
  async function sendWa(b) {
    let phone = '';
    try {
      const r = await api.post(`/budgets/${b.id}/whatsapp`, {});
      if (r.data.ok) { alert('✅ Presupuesto enviado por WhatsApp'); load(); return; }
    } catch (e) {
      const msg = e.response?.data?.error || '';
      if (/tel[eé]fono/i.test(msg)) {
        phone = window.prompt('Número de WhatsApp del cliente (con código de área):', '');
        if (!phone) return;
        try { await api.post(`/budgets/${b.id}/whatsapp`, { phone }); alert('✅ Enviado'); load(); }
        catch (e2) { alert(e2.response?.data?.error || 'No se pudo enviar'); }
      } else { alert(msg || 'No se pudo enviar'); }
    }
  }
  async function convertirOT(b) {
    if (!(await confirmDialog(`¿Convertir el presupuesto N° ${String(b.numero).padStart(6,'0')} en una orden de trabajo?`))) return;
    try { await api.post(`/work-orders/from-budget/${b.id}`); alert('✅ Orden de trabajo creada. La ves en Comprobantes → Órdenes de trabajo.'); load(); }
    catch (e) { alert(e.response?.data?.error || 'No se pudo crear la orden'); load(); }
  }

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Presupuestos</h1>
          <p style={{ color: 'var(--ink-soft)', margin: '4px 0 0' }}>Armá presupuestos, mandalos por WhatsApp y seguí su estado.</p>
        </div>
        {can.crear && <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>📄 Nuevo presupuesto</button>}
      </div>

      {loading ? <p style={{ color: 'var(--ink-soft)' }}>Cargando…</p> : list.length === 0 ? (
        <p style={{ color: 'var(--ink-soft)', padding: '20px 0' }}>Todavía no cargaste presupuestos.</p>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="table cards-mobile">
            <thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th style={{ textAlign: 'right' }}>Total</th><th>Estado</th><th>Válido hasta</th><th></th></tr></thead>
            <tbody>
              {list.map(b => (
                <tr key={b.id}>
                  <td data-label="N°">{String(b.numero).padStart(6, '0')}</td>
                  <td data-label="Fecha">{fdate(b.createdAt)}</td>
                  <td data-label="Cliente">{b.clienteNombre || '—'}</td>
                  <td data-label="Total" style={{ textAlign: 'right' }}>{fmt(b.total)}</td>
                  <td data-label="Estado"><span className={(ESTADOS[b.status] || ESTADOS.borrador).cls}>{(ESTADOS[b.status] || ESTADOS.borrador).label}</span></td>
                  <td data-label="Válido hasta">{fdate(b.validoHasta)}</td>
                  <td data-label="" className="actions-cell">
                    <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn btn-sm" onClick={() => downloadPdf(b.id, b.numero)} title="Descargar PDF">PDF</button>
                      {can.enviar && <button className="btn btn-sm" onClick={() => sendWa(b)} title="Enviar por WhatsApp">📲</button>}
                      {can.editar && b.status !== 'aceptado' && <button className="btn btn-sm" onClick={() => setStatus(b, 'aceptado')} title="Marcar aceptado" style={{ color: '#15803d' }}>✓</button>}
                      {can.convertir_ot && b.status === 'aceptado' && !b.tieneOT && <button className="btn btn-sm" onClick={() => convertirOT(b)} title="Convertir en orden de trabajo">🛠️ OT</button>}
                      {b.tieneOT && <span className="pill pill-paid" title="Ya tiene orden de trabajo">OT ✓</span>}
                      {can.editar && b.status !== 'rechazado' && <button className="btn btn-sm" onClick={() => setStatus(b, 'rechazado')} title="Marcar rechazado" style={{ color: '#b91c1c' }}>✕</button>}
                      {can.editar && <button className="btn btn-sm" onClick={() => { setEditing(b); setShowModal(true); }} title="Editar">✎</button>}
                      {can.eliminar && <button className="btn btn-sm" onClick={() => del(b)} title="Eliminar">🗑</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <PresupuestoModal budget={editing} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />}
    </div>
  );
}

function PresupuestoModal({ budget, onClose, onSaved }) {
  const isEdit = !!budget;
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState(budget?.clientId || '');
  const [clienteNombre, setClienteNombre] = useState(budget?.clienteNombre || '');
  const [clienteDoc, setClienteDoc] = useState(budget?.clienteDoc || '');
  const [items, setItems] = useState(budget?.items?.length ? budget.items : [{ descripcion: '', cantidad: 1, precio: '' }]);
  const [validezDias, setValidezDias] = useState(budget?.validezDias ?? 15);
  const [notas, setNotas] = useState(budget?.notas || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api.get('/clients').then(r => setClients(Array.isArray(r.data) ? r.data : [])).catch(() => {}); }, []);

  const total = items.reduce((s, it) => s + (Number(it.cantidad) || 0) * (Number(it.precio) || 0), 0);
  const setItem = (i, k, v) => setItems(arr => arr.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const addItem = () => setItems(arr => [...arr, { descripcion: '', cantidad: 1, precio: '' }]);
  const delItem = (i) => setItems(arr => arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr);

  async function save() {
    setError('');
    const its = items.filter(it => (it.descripcion || '').trim());
    if (!its.length) { setError('Agregá al menos un ítem.'); return; }
    setSaving(true);
    try {
      const payload = { clientId: clientId || null, clienteNombre, clienteDoc, items: its, validezDias, notas };
      if (isEdit) await api.put(`/budgets/${budget.id}`, payload);
      else await api.post('/budgets', payload);
      onSaved();
    } catch (e) { setError(e.response?.data?.error || 'No se pudo guardar'); setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-header"><h2>{isEdit ? `Presupuesto N° ${String(budget.numero).padStart(6, '0')}` : 'Nuevo presupuesto'}</h2><button className="modal-close" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div className="two-col-grid">
            <div className="field">
              <label>Cliente (opcional)</label>
              <select value={clientId} onChange={e => { const id = e.target.value; setClientId(id); const c = clients.find(x => x.id === id); if (c) { setClienteNombre(c.name); setClienteDoc(c.cuit || c.dni || ''); } }}>
                <option value="">— Escribir manualmente —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Nombre en el presupuesto</label><input value={clienteNombre} onChange={e => setClienteNombre(e.target.value)} placeholder="Consumidor final" /></div>
          </div>
          <div className="two-col-grid">
            <div className="field"><label>CUIT / DNI (opcional)</label><input value={clienteDoc} onChange={e => setClienteDoc(e.target.value)} /></div>
            <div className="field"><label>Validez (días)</label><input type="number" min="0" value={validezDias} onChange={e => setValidezDias(e.target.value)} /></div>
          </div>

          <label style={{ fontWeight: 600, fontSize: 14, display: 'block', margin: '10px 0 6px' }}>Ítems</label>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <input style={{ flex: 3 }} placeholder="Descripción" value={it.descripcion} onChange={e => setItem(i, 'descripcion', e.target.value)} />
              <input style={{ flex: 1 }} type="number" min="0" placeholder="Cant." value={it.cantidad} onChange={e => setItem(i, 'cantidad', e.target.value)} />
              <input style={{ flex: 1.4 }} type="number" min="0" step="0.01" placeholder="Precio" value={it.precio} onChange={e => setItem(i, 'precio', e.target.value)} />
              <button type="button" className="btn btn-sm" onClick={() => delItem(i)} title="Quitar">✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>+ Agregar ítem</button>

          <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 18, margin: '12px 0' }}>Total: {fmt(total)}</div>

          <div className="field"><label>Notas (opcional)</label><textarea rows="2" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Condiciones, formas de pago, etc." /></div>

          {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando…' : isEdit ? 'Guardar' : 'Crear'}</button>
        </div>
      </div>
    </div>
  );
}
