import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export const DEFAULT_TEMPLATES = [
  {
    id: 'cobranza',
    name: 'Recordatorio de pago',
    text: 'Hola {nombre}! Te recordamos que tenés pendiente el pago de {actividad} por {monto}. Vencimiento: {vencimiento}. Cualquier consulta estamos a disposición. ¡Gracias!',
  },
];

export function getTemplates() {
  try {
    const stored = localStorage.getItem('wa_templates');
    return stored ? JSON.parse(stored) : DEFAULT_TEMPLATES;
  } catch {
    return DEFAULT_TEMPLATES;
  }
}


const fmt = (v) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v || 0);
const fmtDate = (d) => d ? new Date(d + (d.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('es-AR', { timeZone: 'UTC' }) : '-';
const statusLabels = { paid: 'Pagado', pending: 'Pendiente', overdue: 'Vencido' };



export default function Collections() {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cobrarModal, setCobrarModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [waModal, setWaModal] = useState(null);
  const [recibo, setRecibo] = useState(null);
  const [expanded, setExpanded] = useState({});
  const { business } = useAuth();

  function load() {
    setLoading(true);
    // fetch pending + overdue + partial (pagos parciales marcados como paid por error)
    Promise.all([
      api.get('/enrollments?status=pending'),
      api.get('/enrollments?status=overdue'),
      api.get('/enrollments?partial=true'),
    ]).then(([p, o, part]) => {
      const all = [...p.data, ...o.data, ...part.data];
      // deduplicate by id
      const seen = new Set();
      setEnrollments(all.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; }));
    }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  // Group by client
  const grouped = useMemo(() => {
    const map = {};
    enrollments.forEach(e => {
      if (!e.active) return;
      const cid = e.clientId;
      if (!map[cid]) map[cid] = { client: e.client, enrollments: [], total: 0 };
      const net = Math.max(0, (e.amountDue || 0) - (e.discount || 0));
      map[cid].enrollments.push({ ...e, net });
      map[cid].total += net;
    });
    return Object.values(map).filter(g => g.enrollments.length > 0);
  }, [enrollments]);

  const filtered = useMemo(() => {
    if (!search.trim()) return grouped;
    const q = search.toLowerCase();
    return grouped.filter(g => g.client?.name?.toLowerCase().includes(q) || g.client?.dni?.includes(q));
  }, [grouped, search]);

  const totalGeneral = filtered.reduce((s, g) => s + g.total, 0);

  function toggleExpand(cid) {
    setExpanded(prev => ({ ...prev, [cid]: !prev[cid] }));
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Cobranza</h1>
          <p className="page-subtitle">
            {filtered.length} {filtered.length === 1 ? 'cliente' : 'clientes'} con deuda · Total: <strong>{fmt(totalGeneral)}</strong>
          </p>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          className="field-input"
          style={{ maxWidth: 320 }}
          placeholder="Buscar cliente…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--ink-soft)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <p style={{ fontSize: 17 }}>{search ? 'No hay resultados.' : '¡No hay deudas pendientes!'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(g => {
            const cid = g.client.id;
            const isOpen = expanded[cid] !== false; // default open
            const overdue = g.enrollments.some(e => e.paymentStatus === 'overdue');
            return (
              <div key={cid} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Client header row */}
                <div
                  onClick={() => toggleExpand(cid)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer', gap: 12 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 20 }}>{isOpen ? '▾' : '▸'}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Link
                          to={`/clientes/${cid}`}
                          style={{ fontWeight: 700, fontSize: 16 }}
                          onClick={e => e.stopPropagation()}
                        >{g.client.name}</Link>
                        {overdue && <span className="pill" style={{ background: '#fee2e2', color: '#dc2626', fontSize: 12 }}>Vencido</span>}
                      </div>
                      {g.client.phone && (
                        <a
                          href={`https://wa.me/${g.client.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: 13, color: '#25d366' }}
                          onClick={e => e.stopPropagation()}
                        >📱 WhatsApp</a>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 18, color: overdue ? '#dc2626' : 'var(--ink)' }}>{fmt(g.total)}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{g.enrollments.length} {g.enrollments.length === 1 ? 'cuota' : 'cuotas'}</div>
                  </div>
                </div>

                {/* Enrollments detail */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    {g.enrollments.map(e => (
                      <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px 12px 40px', borderBottom: '1px solid var(--border)', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 15 }}>{e.activity?.name}</div>
                          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2 }}>
                            Vence: {fmtDate(e.dueDate)}
                            {e.discount > 0 && <span style={{ marginLeft: 8, color: '#6366f1' }}>Desc: {fmt(e.discount)}</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                          <span className={`pill pill-${e.paymentStatus}`}>{statusLabels[e.paymentStatus]}</span>
                          <strong style={{ fontSize: 16, minWidth: 80, textAlign: 'right' }}>{fmt(e.net)}</strong>
                          <button className="btn btn-sm btn-secondary" onClick={() => setEditModal(e)} title="Editar cuota">✏️</button>
                          {g.client.phone && (
                            <button className="btn btn-sm btn-secondary" style={{ color: '#25d366' }} onClick={() => setWaModal(e)} title="WhatsApp">📱</button>
                          )}
                          <button className="btn btn-sm btn-primary" onClick={() => setCobrarModal(e)}>Cobrar</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {cobrarModal && (
        <CobrarModal
          enrollment={cobrarModal}
          business={business}
          onClose={() => setCobrarModal(null)}
          onSaved={(data) => { setCobrarModal(null); load(); if (data) setRecibo(data); }}
        />
      )}
      {editModal && (
        <EditCuotaModal
          enrollment={editModal}
          onClose={() => setEditModal(null)}
          onSaved={() => { setEditModal(null); load(); }}
        />
      )}
      {waModal && (
        <WaModal enrollment={waModal} onClose={() => setWaModal(null)} />
      )}
      {recibo && (
        <ReciboModal recibo={recibo} business={business} onClose={() => setRecibo(null)} />
      )}
    </div>
  );
}

/* ── Cobrar Modal ──────────────────────────────────────────────── */
function CobrarModal({ enrollment, business, onClose, onSaved }) {
  const net = Math.max(0, (enrollment.amountDue || 0) - (enrollment.discount || 0));
  const [monto, setMonto] = useState(net);
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await api.post(`/enrollments/${enrollment.id}/pay`, {
        amount: Number(monto),
        method: metodoPago,
      });
      onSaved({ ...enrollment, ...res.data.enrollment, metodoPago, amountDue: Number(monto) });
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar el cobro');
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Registrar cobro</h2>
        <p style={{ color: 'var(--ink-soft)', marginBottom: 16, fontSize: 15 }}>
          <strong>{enrollment.client?.name}</strong> — {enrollment.activity?.name}
        </p>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Monto a cobrar ($)</label>
            <input type="number" min="0" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} required />
            {enrollment.discount > 0 && (
              <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                Cuota: {fmt(enrollment.amountDue)} · Descuento: {fmt(enrollment.discount)}
              </span>
            )}
          </div>
          <div className="field">
            <label>Forma de pago</label>
            <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)}>
              <option>Efectivo</option>
              <option>Transferencia</option>
              <option>Tarjeta débito</option>
              <option>Tarjeta crédito</option>
              <option>Mercado Pago</option>
              <option>Cheque</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : '✅ Confirmar cobro'}
            </button>
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Editar cuota (solo montos/fechas, no estado) ──────────────── */
function EditCuotaModal({ enrollment, onClose, onSaved }) {
  const [form, setForm] = useState({
    amountDue: enrollment.amountDue ?? '',
    discount: enrollment.discount ?? 0,
    startDate: enrollment.startDate ? enrollment.startDate.slice(0, 10) : '',
    dueDate: enrollment.dueDate ? enrollment.dueDate.slice(0, 10) : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.patch(`/enrollments/${enrollment.id}`, {
        amountDue: Number(form.amountDue),
        discount: Number(form.discount) || 0,
        startDate: form.startDate || undefined,
        dueDate: form.dueDate || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar');
      setSaving(false);
    }
  }

  const net = Math.max(0, Number(form.amountDue) - Number(form.discount || 0));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Editar cuota</h2>
        <p style={{ color: 'var(--ink-soft)', marginBottom: 16, fontSize: 15 }}>
          <strong>{enrollment.client?.name}</strong> — {enrollment.activity?.name}
        </p>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="two-col-grid">
            <div className="field">
              <label>Cuota ($)</label>
              <input type="number" min="0" step="0.01" value={form.amountDue} onChange={e => set('amountDue', e.target.value)} required />
            </div>
            <div className="field">
              <label>Descuento ($)</label>
              <input type="number" min="0" step="0.01" value={form.discount} onChange={e => set('discount', e.target.value)} />
            </div>
          </div>
          {Number(form.discount) > 0 && (
            <p style={{ fontSize: 13, color: '#6366f1', marginBottom: 10 }}>A cobrar: <strong>{fmt(net)}</strong></p>
          )}
          <div className="two-col-grid">
            <div className="field">
              <label>Inicio de membresía</label>
              <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>
            <div className="field">
              <label>Vencimiento</label>
              <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── WhatsApp template modal ───────────────────────────────────── */
function WaModal({ enrollment, onClose }) {
  const templates = getTemplates();
  const e = enrollment;
  const fmt2 = (v) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v || 0);
  const net = Math.max(0, (e.amountDue || 0) - (e.discount || 0));
  const fmtD = (d) => d ? new Date(d + (d.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('es-AR', { timeZone: 'UTC' }) : '-';

  function buildMsg(tpl) {
    return tpl.text
      .replace('{nombre}', e.client?.name || '')
      .replace('{actividad}', e.activity?.name || '')
      .replace('{monto}', fmt2(net))
      .replace('{vencimiento}', fmtD(e.dueDate));
  }

  const defaultMsg = `Hola ${e.client?.name}! Te recordamos que tenés pendiente el pago de ${e.activity?.name} por ${fmt2(net)}. Vencimiento: ${fmtD(e.dueDate)}. ¡Gracias!`;
  const phone = e.client?.phone?.replace(/\D/g, '');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={ev => ev.stopPropagation()}>
        <h2>Mensaje WhatsApp</h2>
        <p style={{ color: 'var(--ink-soft)', marginBottom: 12, fontSize: 14 }}>
          {e.client?.name} — {e.activity?.name}
        </p>
        {templates.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {templates.filter(t => t.id === 'cobranza' || t.id?.startsWith('custom')).map(t => (
              <div key={t.id} className="card" style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 6 }}>{t.name}</div>
                <p style={{ fontSize: 14, margin: '0 0 10px' }}>{buildMsg(t)}</p>
                <a href={`https://wa.me/${phone}?text=${encodeURIComponent(buildMsg(t))}`} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ background: '#25d366', color: '#fff', border: 'none' }}>
                  Enviar por WhatsApp
                </a>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 14, marginBottom: 12 }}>{defaultMsg}</p>
            <a href={`https://wa.me/${phone}?text=${encodeURIComponent(defaultMsg)}`} target="_blank" rel="noreferrer" className="btn btn-primary">
              Enviar por WhatsApp
            </a>
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <button className="btn" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

/* ── Recibo de pago ────────────────────────────────────────────── */
function ReciboModal({ recibo, business, onClose }) {
  const fmtR = (v) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v || 0);
  const fmtD = (d) => d ? new Date(d + (d.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('es-AR', { timeZone: 'UTC' }) : '-';
  const net = Math.max(0, (recibo.amountDue || 0) - (recibo.discount || 0));
  const nroRecibo = `${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}${String(new Date().getDate()).padStart(2,'0')}-${recibo.id?.slice(-5).toUpperCase()}`;
  const token = localStorage.getItem('token');

  function handlePrint() {
    const logoUrl = `${window.location.origin}/api/business/logo?token=${token}`;
    const fecha = fmtD(new Date().toISOString().slice(0,10));
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Recibo N° ${nroRecibo}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 14px; color: #111; background: white; padding: 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
  .logo-block { display: flex; align-items: center; gap: 12px; }
  .logo { max-height: 56px; max-width: 120px; object-fit: contain; }
  .biz-name { font-size: 18px; font-weight: 700; }
  .biz-sub { font-size: 13px; color: #555; margin-top: 2px; }
  .recibo-title { font-size: 22px; font-weight: 800; letter-spacing: 2px; color: #111; }
  .recibo-nro { font-size: 13px; color: #555; margin-top: 4px; }
  .recibo-date { font-size: 13px; color: #555; margin-top: 2px; }
  hr { border: none; border-top: 2px solid #e5e7eb; margin: 18px 0; }
  .row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
  .row .label { color: #6b7280; }
  .row .value { font-weight: 600; text-align: right; max-width: 60%; }
  .total-row { display: flex; justify-content: space-between; padding: 12px 0; font-size: 17px; font-weight: 800; margin-top: 4px; }
  .firmas { display: flex; gap: 40px; margin-top: 48px; }
  .firma-box { flex: 1; text-align: center; }
  .firma-line { border-top: 1px solid #9ca3af; margin-bottom: 6px; }
  .firma-label { font-size: 12px; color: #6b7280; }
  .footer { text-align: center; font-size: 12px; color: #9ca3af; margin-top: 32px; }
</style>
</head>
<body>
<div class="header">
  <div class="logo-block">
    <img class="logo" src="${logoUrl}" onerror="this.style.display='none'" alt=""/>
    <div>
      <div class="biz-name">${business?.name || 'Mi negocio'}</div>
      ${business?.phone ? `<div class="biz-sub">${business.phone}</div>` : ''}
    </div>
  </div>
  <div style="text-align:right">
    <div class="recibo-title">RECIBO</div>
    <div class="recibo-nro">N° ${nroRecibo}</div>
    <div class="recibo-date">Fecha: ${fecha}</div>
  </div>
</div>
<hr/>
<div class="row"><span class="label">Socio / Cliente</span><span class="value">${recibo.client?.name || '-'}</span></div>
${recibo.client?.dni ? `<div class="row"><span class="label">DNI</span><span class="value">${recibo.client.dni}</span></div>` : ''}
<div class="row"><span class="label">Actividad / Servicio</span><span class="value">${recibo.activity?.name || '-'}</span></div>
<div class="row"><span class="label">Período</span><span class="value">${fmtD(recibo.startDate)} – ${fmtD(recibo.dueDate)}</span></div>
<div class="row"><span class="label">Forma de pago</span><span class="value">${recibo.metodoPago || 'Efectivo'}</span></div>
<hr/>
<div class="row"><span class="label">Cuota</span><span class="value">${fmtR(recibo.amountDue)}</span></div>
${(recibo.discount > 0) ? `<div class="row"><span class="label">Descuento</span><span class="value" style="color:#10b981">- ${fmtR(recibo.discount)}</span></div>` : ''}
<div class="total-row"><span>TOTAL ABONADO</span><span>${fmtR(net)}</span></div>
<hr/>
<div class="firmas">
  <div class="firma-box"><div class="firma-line"></div><div class="firma-label">Firma y sello</div></div>
  <div class="firma-box"><div class="firma-line"></div><div class="firma-label">Recibí conforme</div></div>
</div>
<div class="footer">Este recibo es comprobante válido de pago.</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=700,height=600');
    win.document.write(html);
    win.document.close();
    // Esperar a que cargue el logo antes de imprimir
    win.onload = () => { win.focus(); win.print(); };
    setTimeout(() => { try { win.focus(); win.print(); } catch(e) {} }, 800);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal recibo-modal" onClick={e => e.stopPropagation()}>
        <div className="recibo-screen-header">
          <h2 style={{ margin: 0 }}>Recibo de pago</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={handlePrint}>🖨️ Imprimir</button>
            <button className="btn" onClick={onClose}>Cerrar</button>
          </div>
        </div>
        <div className="recibo-print-area">
          <div className="recibo-header">
            <div className="recibo-logo-block">
              <img src={`/api/business/logo?token=${token}&t=${Date.now()}`} alt="" className="recibo-logo" onError={e => { e.target.style.display='none' }} />
              <div>
                <div className="recibo-business-name">{business?.name || 'Mi negocio'}</div>
                {business?.phone && <div className="recibo-business-sub">{business.phone}</div>}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="recibo-title">RECIBO</div>
              <div className="recibo-nro">N° {nroRecibo}</div>
              <div className="recibo-date">Fecha: {fmtD(new Date().toISOString().slice(0,10))}</div>
            </div>
          </div>
          <div className="recibo-divider" />
          <div className="recibo-section">
            <div className="recibo-row"><span className="recibo-label">Socio / Cliente</span><span className="recibo-value">{recibo.client?.name || '-'}</span></div>
            {recibo.client?.dni && <div className="recibo-row"><span className="recibo-label">DNI</span><span className="recibo-value">{recibo.client.dni}</span></div>}
            <div className="recibo-row"><span className="recibo-label">Actividad / Servicio</span><span className="recibo-value">{recibo.activity?.name || '-'}</span></div>
            <div className="recibo-row"><span className="recibo-label">Período</span><span className="recibo-value">{fmtD(recibo.startDate)} – {fmtD(recibo.dueDate)}</span></div>
            <div className="recibo-row"><span className="recibo-label">Forma de pago</span><span className="recibo-value">{recibo.metodoPago || 'Efectivo'}</span></div>
          </div>
          <div className="recibo-divider" />
          <div className="recibo-montos">
            <div className="recibo-row"><span className="recibo-label">Cuota</span><span className="recibo-value">{fmtR(recibo.amountDue)}</span></div>
            {recibo.discount > 0 && <div className="recibo-row"><span className="recibo-label">Descuento</span><span className="recibo-value" style={{ color: '#10b981' }}>- {fmtR(recibo.discount)}</span></div>}
            <div className="recibo-row recibo-total"><span>TOTAL ABONADO</span><span>{fmtR(net)}</span></div>
          </div>
          <div className="recibo-divider" />
          <div className="recibo-firmas">
            <div className="recibo-firma-box"><div className="recibo-firma-line" /><div className="recibo-firma-label">Firma y sello</div></div>
            <div className="recibo-firma-box"><div className="recibo-firma-line" /><div className="recibo-firma-label">Recibí conforme</div></div>
          </div>
          <div className="recibo-footer">Este recibo es comprobante válido de pago.</div>
        </div>
      </div>
    </div>
  );
}
