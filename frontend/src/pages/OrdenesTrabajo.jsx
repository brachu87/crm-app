import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useSectionPerms } from '../config/permissions';
import confirmDialog from '../utils/confirm';

const fmt = (v) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(v || 0);
const fdate = (d) => d ? new Date(d + (String(d).length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-AR') : '-';
const ESTADOS = {
  pendiente: { label: 'Pendiente', cls: 'pill' },
  en_curso:  { label: 'En curso',  cls: 'pill pill-amber' },
  terminada: { label: 'Terminada', cls: 'pill pill-paid' },
  cancelada: { label: 'Cancelada', cls: 'pill pill-overdue' },
};

export default function OrdenesTrabajo() {
  const can = useSectionPerms('ordenes');
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  function load() {
    api.get('/work-orders').then(r => setList(Array.isArray(r.data) ? r.data : [])).catch(() => setList([])).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function setStatus(w, status) {
    try { await api.put(`/work-orders/${w.id}`, { status }); load(); } catch (e) { alert(e.response?.data?.error || 'Error'); }
  }
  async function cobrar(w) {
    if (!(await confirmDialog(`¿Registrar el cobro de ${fmt(w.total)} por la orden N° ${String(w.numero).padStart(6, '0')}? Se sumará como ingreso en la caja.`))) return;
    try { await api.post(`/work-orders/${w.id}/cobrar`); load(); } catch (e) { alert(e.response?.data?.error || 'No se pudo cobrar'); }
  }
  function facturar(w) {
    // Abre Facturación con el modal de Nueva factura ya cargado con los datos de la OT
    navigate('/comprobantes', { state: { prefillFactura: {
      workOrderId: w.id,
      razonSocial: w.clienteNombre || '',
      items: (w.items || []).map(it => ({ descripcion: it.descripcion, cantidad: Number(it.cantidad) || 1, precio: Number(it.precio) || 0, alicuota: 21 })),
    } } });
  }
  async function del(w) {
    if (!(await confirmDialog(`¿Eliminar la orden N° ${String(w.numero).padStart(6, '0')}?`))) return;
    try { await api.delete(`/work-orders/${w.id}`); load(); } catch (e) { alert(e.response?.data?.error || 'Error'); }
  }

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Órdenes de trabajo</h1>
          <p style={{ color: 'var(--ink-soft)', margin: '4px 0 0' }}>Asigná el trabajo a tu equipo y seguí su estado hasta terminarlo.</p>
        </div>
        {can.crear && <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>🛠️ Nueva orden</button>}
      </div>

      {loading ? <p style={{ color: 'var(--ink-soft)' }}>Cargando…</p> : list.length === 0 ? (
        <p style={{ color: 'var(--ink-soft)', padding: '20px 0' }}>Todavía no hay órdenes de trabajo. Podés crear una nueva o convertir un presupuesto aceptado.</p>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="table cards-mobile">
            <thead><tr><th>N°</th><th>Detalle</th><th>Cliente</th><th>Asignado</th><th style={{ textAlign: 'right' }}>Total</th><th>Estado</th><th>Fecha</th><th></th></tr></thead>
            <tbody>
              {list.map(w => (
                <tr key={w.id}>
                  <td data-label="N°">{String(w.numero).padStart(6, '0')}</td>
                  <td data-label="Detalle">{w.titulo || '—'}</td>
                  <td data-label="Cliente">{w.clienteNombre || '—'}</td>
                  <td data-label="Asignado">{w.employeeName || '—'}</td>
                  <td data-label="Total" style={{ textAlign: 'right' }}>{fmt(w.total)}</td>
                  <td data-label="Estado">
                    <span className={(ESTADOS[w.status] || ESTADOS.pendiente).cls}>{(ESTADOS[w.status] || ESTADOS.pendiente).label}</span>
                    {w.facturada && <span className="pill pill-paid" style={{ marginLeft: 4 }}>Facturada</span>}
                    {w.cobrada && <span className="pill pill-paid" style={{ marginLeft: 4 }}>Cobrada</span>}
                  </td>
                  <td data-label="Fecha">{w.scheduledDate ? fdate(w.scheduledDate) : '—'}</td>
                  <td data-label="" className="actions-cell">
                    <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                      {can.editar && w.status === 'pendiente' && <button className="btn btn-sm" onClick={() => setStatus(w, 'en_curso')} title="Marcar en curso">▶</button>}
                      {can.editar && (w.status === 'pendiente' || w.status === 'en_curso') && <button className="btn btn-sm" onClick={() => setStatus(w, 'terminada')} title="Marcar terminada" style={{ color: '#15803d' }}>✓</button>}
                      {can.facturar && w.status === 'terminada' && !w.facturada && <button className="btn btn-sm" onClick={() => facturar(w)} title="Facturar (AFIP)">🧾 Facturar</button>}
                      {can.cobrar && w.status === 'terminada' && !w.cobrada && <button className="btn btn-sm" onClick={() => cobrar(w)} title="Registrar cobro" style={{ color: '#15803d' }}>💵 Cobrar</button>}
                      {can.editar && <button className="btn btn-sm" onClick={() => { setEditing(w); setShowModal(true); }} title="Editar">✎</button>}
                      {can.editar && w.status !== 'cancelada' && w.status !== 'terminada' && <button className="btn btn-sm" onClick={() => setStatus(w, 'cancelada')} title="Cancelar" style={{ color: '#b91c1c' }}>✕</button>}
                      {can.eliminar && <button className="btn btn-sm" onClick={() => del(w)} title="Eliminar">🗑</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <OrdenModal wo={editing} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />}
    </div>
  );
}

function OrdenModal({ wo, onClose, onSaved }) {
  const isEdit = !!wo;
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [clientId, setClientId] = useState(wo?.clientId || '');
  const [clienteNombre, setClienteNombre] = useState(wo?.clienteNombre || '');
  const [titulo, setTitulo] = useState(wo?.titulo || '');
  const [employeeId, setEmployeeId] = useState(wo?.employeeId || '');
  const [items, setItems] = useState(wo?.items?.length ? wo.items : [{ descripcion: '', cantidad: 1, precio: '' }]);
  const [scheduledDate, setScheduledDate] = useState(wo?.scheduledDate || '');
  const [notas, setNotas] = useState(wo?.notas || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/clients').then(r => setClients(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    api.get('/employees').then(r => setEmployees(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  const total = items.reduce((s, it) => s + (Number(it.cantidad) || 0) * (Number(it.precio) || 0), 0);
  const setItem = (i, k, v) => setItems(arr => arr.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const addItem = () => setItems(arr => [...arr, { descripcion: '', cantidad: 1, precio: '' }]);
  const delItem = (i) => setItems(arr => arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr);

  async function save() {
    setError('');
    const its = items.filter(it => (it.descripcion || '').trim());
    setSaving(true);
    try {
      const payload = { clientId: clientId || null, clienteNombre, titulo, employeeId: employeeId || null, items: its, scheduledDate, notas };
      if (isEdit) await api.put(`/work-orders/${wo.id}`, payload);
      else await api.post('/work-orders', payload);
      onSaved();
    } catch (e) { setError(e.response?.data?.error || 'No se pudo guardar'); setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-header"><h2>{isEdit ? `Orden N° ${String(wo.numero).padStart(6, '0')}` : 'Nueva orden de trabajo'}</h2><button className="modal-close" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div className="field"><label>Título / descripción del trabajo</label><input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej: Instalación de aire acondicionado" /></div>
          <div className="two-col-grid">
            <div className="field">
              <label>Cliente (opcional)</label>
              <select value={clientId} onChange={e => { const id = e.target.value; setClientId(id); const c = clients.find(x => x.id === id); if (c) setClienteNombre(c.name); }}>
                <option value="">— Escribir manualmente —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Nombre del cliente</label><input value={clienteNombre} onChange={e => setClienteNombre(e.target.value)} /></div>
          </div>
          <div className="two-col-grid">
            <div className="field">
              <label>Asignar a</label>
              <select value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
                <option value="">— Sin asignar —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Fecha programada</label><input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} /></div>
          </div>

          <label style={{ fontWeight: 600, fontSize: 14, display: 'block', margin: '10px 0 6px' }}>Ítems / tareas (opcional)</label>
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

          <div className="field"><label>Notas (opcional)</label><textarea rows="2" value={notas} onChange={e => setNotas(e.target.value)} /></div>
          {isEdit && wo?.id && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <NotasHistorial entityType="workorder" entityId={wo.id} title="Historial de la orden" />
            </div>
          )}
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
