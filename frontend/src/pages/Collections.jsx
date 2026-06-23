import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSectionPerms } from '../config/permissions';

export const DEFAULT_TEMPLATES = [
  {
    id: 'cobranza',
    name: 'Recordatorio de pago',
    text: 'Hola {nombre}! Te recordamos que tenés pendiente el pago de {actividad} por {monto}. Vencimiento: {vencimiento}. Cualquier consulta estamos a disposición. Gracias!',
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
// Formatter seguro para URLs de WhatsApp (sin caracteres Unicode especiales)
const fmtWA = (v) => '$ ' + Math.round(v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const fmtDate = (d) => d ? new Date(d + (d.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('es-AR', { timeZone: 'UTC' }) : '-';
const statusLabels = { paid: 'Pagado', pending: 'Pendiente', overdue: 'Vencido' };



export default function Collections() {
  const [view, setView] = useState('pending'); // 'pending' | 'paid' | 'otros' | 'recordatorios'
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const can = useSectionPerms('cobranza');
  const [cobrarModal, setCobrarModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [waModal, setWaModal] = useState(null);
  const [recibo, setRecibo] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [pendingAppts, setPendingAppts] = useState([]);
  const [cobrarApptModal, setCobrarApptModal] = useState(null);
  const { business } = useAuth();

  function load() {
    setLoading(true);
    if (view === 'paid') {
      Promise.all([
        api.get('/enrollments?status=paid'),
        api.get('/appointments?status=completed&paymentStatus=paid').catch(() => ({ data: [] })),
      ]).then(([enrR, apptR]) => {
        setEnrollments(enrR.data);
        setPendingAppts(apptR.data || []);
      }).finally(() => setLoading(false));
    } else {
      Promise.all([
        api.get('/enrollments?status=pending'),
        api.get('/enrollments?status=overdue'),
        api.get('/enrollments?partial=true'),
        api.get('/appointments?status=completed&paymentStatus=pending').catch(() => ({ data: [] })),
      ]).then(([p, o, part, apptR]) => {
        const all = [...p.data, ...o.data, ...part.data];
        const seen = new Set();
        setEnrollments(all.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; }));
        setPendingAppts(apptR.data || []);
      }).finally(() => setLoading(false));
    }
  }

  useEffect(() => { load(); }, [view]);

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

  const tabStyle = (active) => ({
    padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 15,
    background: active ? 'var(--primary)' : 'var(--surface)',
    color: active ? '#fff' : 'var(--ink-soft)',
    transition: 'all .15s',
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Cobranza</h1>
          <p className="page-subtitle" style={{ fontSize: 13 }}>
            {view === 'pending'
              ? `${filtered.length} ${filtered.length === 1 ? 'cliente' : 'clientes'} con deuda`
              : `${filtered.length} ${filtered.length === 1 ? 'cliente' : 'clientes'} cobrados`}
            {' · '}Total: <strong>{fmt(totalGeneral)}</strong>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="cobranza-tabs">
        <button style={tabStyle(view === 'pending')} onClick={() => { setView('pending'); setSearch(''); }}>
          ⏳ Pendientes
        </button>
        <button style={tabStyle(view === 'paid')} onClick={() => { setView('paid'); setSearch(''); }}>
          ✅ Cobradas
        </button>
        <button style={tabStyle(view === 'otros')} onClick={() => { setView('otros'); setSearch(''); }}>
          💰 Otros ingresos
        </button>
        <button style={tabStyle(view === 'recordatorios')} onClick={() => { setView('recordatorios'); setSearch(''); }}>
          📱 Recordatorios
        </button>
      </div>

      {view !== 'otros' && <>
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
        <div className="page-spinner"><div className="spinner spinner-lg"></div><span>Cargando...</span></div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--ink-soft)' }}>
          
          <p style={{ fontSize: 17 }}>
            {search ? 'No hay resultados.' : view === 'paid' ? 'No hay cobros registrados.' : '¡No hay deudas pendientes!'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(g => {
            const cid = g.client.id;
            const isOpen = expanded[cid] !== false;
            const overdue = g.enrollments.some(e => e.paymentStatus === 'overdue');
            return (
              <div key={cid} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div onClick={() => toggleExpand(cid)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 20 }}>{isOpen ? '▾' : '▸'}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Link to={`/clientes/${cid}`} style={{ fontWeight: 700, fontSize: 16 }} onClick={e => e.stopPropagation()}>
                          {g.client.name}
                        </Link>
                        {view === 'pending' && overdue && (
                          <span className="pill" style={{ background: '#fee2e2', color: '#dc2626', fontSize: 12 }}>Vencido</span>
                        )}
                        {view === 'paid' && (
                          <span className="pill" style={{ background: '#d1fae5', color: '#065f46', fontSize: 12 }}>Pagado</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 18, color: view === 'paid' ? '#10b981' : overdue ? '#dc2626' : 'var(--ink)' }}>
                      {fmt(g.total)}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                      {g.enrollments.length} {g.enrollments.length === 1 ? 'cuota' : 'cuotas'}
                    </div>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    {g.enrollments.map(e => {
                      const lastPayment = e.payments?.[0];
                      return (
                        <div key={e.id} className="cuota-row">
                          <div className="cuota-row-info">
                            <div style={{ fontWeight: 600, fontSize: 15 }}>{e.activity?.name}</div>
                            <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2 }}>
                              {view === 'paid' ? (
                                <>
                                  {lastPayment ? `Cobrado el ${fmtDate(lastPayment.date)} · ${lastPayment.method || 'Efectivo'}` : fmtDate(e.dueDate)}
                                </>
                              ) : (
                                <>
                                  Vence: {fmtDate(e.dueDate)}
                                  {e.discount > 0 && <span style={{ marginLeft: 8, color: '#6366f1' }}>Desc: {fmt(e.discount)}</span>}
                                </>
                              )}
                            </div>
                          </div>
                          <div className="cuota-row-actions">
                            <strong className="cuota-row-monto" style={{ fontSize: 16, minWidth: 60, textAlign: 'right' }}>{fmt(e.net)}</strong>
                            {view === 'paid' ? (
                              <>
                                <button
                                  className="btn btn-sm btn-secondary"
                                  title="Reimprimir recibo"
                                  onClick={() => setRecibo({ ...e, metodoPago: lastPayment?.method || 'Efectivo', amountDue: lastPayment?.amount || e.amountDue })}
                                >🖨️ Recibo</button>
                                {g.client.phone && (
                                  <button
                                    className="btn btn-sm btn-secondary"
                                    style={{ color: '#25d366' }}
                                    title="Enviar comprobante por WhatsApp"
                                    onClick={() => setWaModal({ ...e, waRecibo: true, lastPayment })}
                                  >📱 WA</button>
                                )}
                              </>
                            ) : (
                              <>
                                <span className={`pill pill-${e.paymentStatus}`}>{statusLabels[e.paymentStatus]}</span>
                                {can.editar_cuota && <button className="btn btn-sm btn-secondary" onClick={() => setEditModal(e)} title="Editar cuota">✏️</button>}
                                {g.client.phone && (
                                  <button className="btn btn-sm btn-secondary" style={{ color: '#25d366' }} onClick={() => setWaModal(e)} title="WhatsApp">📱</button>
                                )}
                                {can.cobrar && <button className="btn btn-sm btn-primary" onClick={() => setCobrarModal(e)}>Cobrar</button>}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Turnos sin cobrar ──────────────────────────────────── */}
      {view === 'pending' && pendingAppts.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            🔧 Turnos y trabajos sin cobrar
            <span style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 20, padding: '2px 10px', fontSize: 13 }}>
              {pendingAppts.length}
            </span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingAppts.map(a => (
              <div key={a.id} className="card appt-card">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{a.client?.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2 }}>
                    {apptLabel(a)} · {apptDetail(a)}
                    {a.employee ? ` · ${a.employee.name}` : ''}
                  </div>
                </div>
                <div className="appt-card-actions">
                  <strong style={{ fontSize: 17 }}>{fmt(a.price)}</strong>
                  {a.client?.phone && (
                    <button className="btn btn-sm btn-secondary" style={{ color: '#25d366' }}
                      onClick={() => {
                        const phone = a.client.phone.replace(/\D/g, '');
                        const msg = `Hola ${a.client.name}! Te recordamos que tenes pendiente el cobro de ${apptLabel(a)} del ${new Date(a.date + 'T12:00:00').toLocaleDateString('es-AR')} por ${fmtWA(a.price)}. Gracias!`;
                        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                      }}>📱 WA</button>
                  )}
                  {can.cobrar && <button className="btn btn-sm btn-primary" onClick={() => setCobrarApptModal(a)}>Cobrar</button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'paid' && pendingAppts.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>🔧 Turnos y trabajos cobrados</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingAppts.map(a => (
              <div key={a.id} className="card appt-card" style={{ opacity: 0.85 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{a.client?.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2 }}>
                    {apptLabel(a)} · {apptDetail(a)}
                  </div>
                </div>
                <div className="appt-card-actions">
                  <span style={{ background: '#d1fae5', color: '#065f46', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>Cobrado</span>
                  <strong style={{ fontSize: 17, color: '#10b981' }}>{fmt(a.price)}</strong>
                  <button className="btn btn-sm btn-secondary" title="Reimprimir recibo"
                    onClick={() => setRecibo({ client: a.client, activity: { name: apptLabel(a) }, startDate: a.date, dueDate: null, amountDue: a.price, discount: 0, metodoPago: 'Efectivo', id: a.id, isAppointment: true, appointmentDate: a.date, startTime: a.startTime, endTime: a.endTime, employeeName: a.employee?.name || null })}>
                    🖨️ Recibo
                  </button>
                  {a.client?.phone && (
                    <button className="btn btn-sm btn-secondary" style={{ color: '#25d366' }} title="WhatsApp"
                      onClick={() => {
                        const phone = a.client.phone.replace(/\D/g, '');
                        const num = phone.startsWith('0') ? '549' + phone.slice(1) : phone.startsWith('54') ? phone : '549' + phone;
                        const msg = `Hola ${a.client.name}! Te enviamos el comprobante de ${apptLabel(a)} del ${new Date(a.date + 'T12:00:00').toLocaleDateString('es-AR')} por ${fmtWA(a.price)}. Gracias!`;
                        window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
                      }}>📱 WA</button>
                  )}
                </div>
              </div>
            ))}
          </div>
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
      {cobrarApptModal && (
        <CobrarApptModal
          appointment={cobrarApptModal}
          onClose={() => setCobrarApptModal(null)}
          onSaved={(data) => { setCobrarApptModal(null); load(); if (data) setRecibo(data); }}
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
      </>
      }

      {view === 'otros' && <OtrosIngresos />}

      {view === 'recordatorios' && <Recordatorios />}

      {recibo && (
        <ReciboModal recibo={recibo} business={business} onClose={() => setRecibo(null)} />
      )}
    </div>
  );
}

function apptLabel(a) {
  if (a.isQuickWork) return a.description || 'Trabajo realizado';
  return a.service?.name || 'Servicio';
}
function apptDetail(a) {
  const d = new Date(a.date + 'T12:00:00').toLocaleDateString('es-AR');
  if (a.isQuickWork) return d;
  return `${d}${a.startTime ? ' · ' + a.startTime + '–' + a.endTime : ''}`;
}

/* ── Cobrar turno (appointment) ────────────────────────────────── */
function CobrarApptModal({ appointment, onClose, onSaved }) {
  const a = appointment;
  const [monto, setMonto] = useState(a.price || 0);
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.put(`/appointments/${a.id}`, { paymentStatus: 'paid' });
      onSaved({
        client: a.client,
        activity: { name: apptLabel(a) },
        startDate: a.date,
        dueDate: null,
        amountDue: Number(monto),
        discount: 0,
        metodoPago,
        id: a.id,
        isAppointment: true,
        appointmentDate: a.date,
        startTime: a.startTime,
        endTime: a.endTime,
        employeeName: a.employee?.name || null,
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar el cobro');
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Cobrar turno</h2>
        <p style={{ color: 'var(--ink-soft)', marginBottom: 16, fontSize: 15 }}>
          <strong>{a.client?.name}</strong> — {apptLabel(a)}
        </p>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16 }}>
          {apptDetail(a)}{a.employee ? ` · ${a.employee.name}` : ''}
        </p>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Monto cobrado ($)</label>
            <input type="number" min="0" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} required />
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
      const res = await api.post(`/enrollments/cuotas/${enrollment.id}/pay`, {
        amount: Number(monto),
        method: metodoPago,
      });
      onSaved({ ...enrollment, ...res.data.cuota, metodoPago, amountDue: Number(monto) });
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar el cobro');
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
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
      await api.patch(`/enrollments/cuotas/${enrollment.id}`, {
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
    <div className="modal-overlay">
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
  const fmt2 = (v) => '$ ' + Math.round(v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const net = Math.max(0, (e.amountDue || 0) - (e.discount || 0));
  const fmtD = (d) => d ? new Date(d + (d.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('es-AR', { timeZone: 'UTC' }) : '-';

  function buildMsg(tpl) {
    return tpl.text
      .replace('{nombre}', e.client?.name || '')
      .replace('{actividad}', e.activity?.name || '')
      .replace('{monto}', fmt2(net))
      .replace('{vencimiento}', fmtD(e.dueDate));
  }

  const defaultMsg = e.waRecibo
    ? `Hola ${e.client?.name}! Tu pago de ${e.activity?.name} por ${fmt2(e.lastPayment?.amount || net)} fue registrado. ${e.lastPayment?.method ? `Forma de pago: ${e.lastPayment.method}.` : ''} Gracias!`
    : `Hola ${e.client?.name}! Te recordamos que tenes pendiente el pago de ${e.activity?.name} por ${fmt2(net)}. Vencimiento: ${fmtD(e.dueDate)}. Gracias!`;
  const phone = e.client?.phone?.replace(/\D/g, '');

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={ev => ev.stopPropagation()}>
        <h2>Mensaje WhatsApp</h2>
        <p style={{ color: 'var(--ink-soft)', marginBottom: 12, fontSize: 14 }}>
          {e.client?.name} — {e.activity?.name}
        </p>
        {e.waRecibo ? (
          <div>
            <p style={{ fontSize: 14, marginBottom: 12 }}>{defaultMsg}</p>
            <a href={`https://wa.me/${phone}?text=${encodeURIComponent(defaultMsg)}`} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ background: '#25d366', color: '#fff', border: 'none' }}>
              Enviar comprobante
            </a>
          </div>
        ) : templates.length > 0 ? (
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

/* ── Helpers ──────────────────────────────────────────────────── */
function buildWaReceiptLink(recibo, net, nroRecibo, business) {
  const fmtR = (v) => '$ ' + Math.round(v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const fmtD2 = (d) => d ? new Date(d + (d.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('es-AR', { timeZone: 'UTC' }) : '-';
  const lineDetalle = recibo.isAppointment
    ? `Turno: ${fmtD2(recibo.appointmentDate)} · ${recibo.startTime || ''}–${recibo.endTime || ''}`
    : `Actividad: ${recibo.activity?.name || '-'}`;
  const msg = `Hola ${recibo.client?.name}! Te enviamos el comprobante de pago N° ${nroRecibo}.\n\n` +
    `Servicio: ${recibo.activity?.name || '-'}\n` +
    `${lineDetalle}\n` +
    `Monto abonado: ${fmtR(net)}\n` +
    `Forma de pago: ${recibo.metodoPago || 'Efectivo'}\n\n` +
    `Gracias por tu pago! ${business?.name || ''}`;
  const phone = recibo.client?.phone?.replace(/\D/g, '');
  const num = phone?.startsWith('0') ? '549' + phone.slice(1) : phone?.startsWith('54') ? phone : '549' + phone;
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}

/* ── Recibo de pago ────────────────────────────────────────────── */
function ReciboModal({ recibo, business, onClose }) {
  const [waStep, setWaStep] = useState(null); // null | 'guide'
  const fmtR = (v) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v || 0);
  const fmtD = (d) => d ? new Date(d + (d.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('es-AR', { timeZone: 'UTC' }) : '-';
  const net = Math.max(0, (recibo.amountDue || 0) - (recibo.discount || 0));
  const nroRecibo = `${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}${String(new Date().getDate()).padStart(2,'0')}-${recibo.id?.slice(-5).toUpperCase()}`;
  const token = localStorage.getItem('token');

  function buildHtml() {
    const logoUrl = `${window.location.origin}/api/business/logo?token=${token}`;
    const fecha = fmtD(new Date().toISOString().slice(0,10));
    return `<!DOCTYPE html>
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
  @media print { @page { margin: 1.5cm; } }
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
${recibo.isAppointment
  ? `<div class="row"><span class="label">Fecha del turno</span><span class="value">${fmtD(recibo.appointmentDate)} · ${recibo.startTime || ''}–${recibo.endTime || ''}</span></div>
${recibo.employeeName ? `<div class="row"><span class="label">Prestador</span><span class="value">${recibo.employeeName}</span></div>` : ''}`
  : `<div class="row"><span class="label">Período</span><span class="value">${fmtD(recibo.startDate)} – ${fmtD(recibo.dueDate)}</span></div>`
}
<div class="row"><span class="label">Forma de pago</span><span class="value">${recibo.metodoPago || 'Efectivo'}</span></div>
<hr/>
<div class="row"><span class="label">${recibo.isAppointment ? 'Servicio' : 'Cuota'}</span><span class="value">${fmtR(recibo.amountDue)}</span></div>
${(!recibo.isAppointment && recibo.discount > 0) ? `<div class="row"><span class="label">Descuento</span><span class="value" style="color:#10b981">- ${fmtR(recibo.discount)}</span></div>` : ''}
<div class="total-row"><span>TOTAL ABONADO</span><span>${fmtR(net)}</span></div>
<hr/>
<div class="firmas">
  <div class="firma-box"><div class="firma-line"></div><div class="firma-label">Firma y sello</div></div>
  <div class="firma-box"><div class="firma-line"></div><div class="firma-label">Recibí conforme</div></div>
</div>
<div class="footer">Este recibo es comprobante válido de pago.</div>
</body>
</html>`;
  }

  function handlePrint() {
    const html = buildHtml();
    // Usar iframe oculto — evita el bloqueador de popups del navegador
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
    document.body.appendChild(iframe);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(url);
        }, 2000);
      }, 400);
    };
    iframe.src = url;
  }

  function handleSendWA() {
    // Abrir el recibo en nueva pestaña para guardar como PDF
    const html = buildHtml();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const pdfUrl = URL.createObjectURL(blob);
    window.open(pdfUrl, '_blank');
    // Mostrar guia y abrir WhatsApp despues de un momento
    setWaStep('guide');
    setTimeout(() => {
      window.open(buildWaReceiptLink(recibo, net, nroRecibo, business), '_blank');
    }, 800);
  }

  return (
    <div className="modal-overlay">
      <div className="modal recibo-modal" onClick={e => e.stopPropagation()}>
        <div className="recibo-screen-header">
          <h2 style={{ margin: 0 }}>Recibo de pago</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handlePrint}>🖨️ Imprimir</button>
            {recibo.client?.phone && (
              <button
                className="btn"
                style={{ background: '#25d366', color: '#fff', border: 'none' }}
                onClick={handleSendWA}
              >📱 Enviar WA + PDF</button>
            )}
            <button className="btn" onClick={onClose}>Cerrar</button>
          </div>
        </div>
        {waStep === 'guide' && (
          <div style={{
            background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10,
            padding: '14px 18px', margin: '0 0 0 0',
          }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#166534', marginBottom: 8 }}>
              📎 Cómo adjuntar el recibo en WhatsApp
            </div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#166534', lineHeight: 1.8 }}>
              <li>Se abrió una pestaña con el recibo — usá <strong>Ctrl+P</strong> (o Menú → Imprimir) y guardalo como <strong>PDF</strong></li>
              <li>En WhatsApp tocá el <strong>clip 📎</strong> y seleccioná ese PDF</li>
              <li>Enviá el mensaje de texto que ya se abrió en WhatsApp</li>
            </ol>
            <button
              onClick={() => setWaStep(null)}
              style={{ marginTop: 10, background: 'none', border: 'none', color: '#166534', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
            >✕ Cerrar guía</button>
          </div>
        )}
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


// ── OTROS INGRESOS ─────────────────────────────────────────────────────────
function OtrosIngresos() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterCat, setFilterCat] = useState('');
  const [search, setSearch] = useState('');

  function load() {
    setLoading(true);
    api.get('/manual-income').then(r => setItems(r.data)).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este ingreso?')) return;
    await api.delete(`/manual-income/${id}`);
    load();
  }

  const fmt = (n) => '$' + Math.round(n).toLocaleString('es-AR');
  const fmtD = (s) => { if (!s) return ''; const [y,m,d] = s.slice(0,10).split('-'); return `${d}/${m}/${y}`; };

  const cats = [...new Set(items.map(i => i.category).filter(Boolean))].sort();
  const filtered = items.filter(i => {
    if (filterCat && i.category !== filterCat) return false;
    if (search) {
      const q = search.toLowerCase();
      return i.description.toLowerCase().includes(q) ||
             i.category.toLowerCase().includes(q) ||
             (i.client?.name || '').toLowerCase().includes(q);
    }
    return true;
  });
  const total = filtered.reduce((s, i) => s + i.amount, 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 14 }}>
          {filtered.length} registro{filtered.length !== 1 ? 's' : ''} · Total: <strong style={{ color: 'var(--primary)' }}>{fmt(total)}</strong>
        </p>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nuevo ingreso</button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          placeholder="Buscar descripción, categoría o cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 160, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14 }}
        />
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14 }}
        >
          <option value=''>Todas las categorías</option>
          {cats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </div>

      {loading ? (
        <p style={{ color: 'var(--ink-soft)' }}>Cargando...</p>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ fontSize: 32, margin: '0 0 8px' }}>💰</p>
          <p style={{ color: 'var(--ink-soft)', margin: 0 }}>No hay ingresos registrados{filterCat ? ` en "${filterCat}"` : ''}.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table className="table otros-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Categoría</th>
                  <th>Cliente</th>
                  <th style={{ textAlign: 'right' }}>Monto</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--ink-soft)', fontSize: 13 }}>{fmtD(item.date)}</td>
                    <td>{item.description}</td>
                    <td>
                      <span style={{ background: 'var(--primary-soft)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                        {item.category}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: item.client ? 'var(--ink)' : 'var(--ink-soft)' }}>
                      {item.client?.name || '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{fmt(item.amount)}</td>
                    <td>
                      <button onClick={() => handleDelete(item.id)} className="btn-danger-text" style={{ fontSize: 12 }}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <NuevoIngresoModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />
      )}
    </div>
  );
}

function NuevoIngresoModal({ onClose, onSaved }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ amount: '', description: '', category: '', date: today, clientId: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDrop, setShowClientDrop] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  // Load clients once
  useEffect(() => {
    api.get('/clients').then(r => setClients(r.data)).catch(() => {});
  }, []);

  function set(field) { return (e) => setForm(f => ({ ...f, [field]: e.target.value })); }

  const filteredClients = clients.filter(c =>
    c.active !== false &&
    (c.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
     c.dni?.includes(clientSearch))
  ).slice(0, 8);

  function selectClient(c) {
    setSelectedClient(c);
    setForm(f => ({ ...f, clientId: c.id }));
    setClientSearch(c.name);
    setShowClientDrop(false);
  }

  function clearClient() {
    setSelectedClient(null);
    setForm(f => ({ ...f, clientId: '' }));
    setClientSearch('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.amount || !form.description || !form.date) { setError('Completá todos los campos obligatorios'); return; }
    setSaving(true);
    try {
      await api.post('/manual-income', {
        amount: parseFloat(String(form.amount).replace(',', '.')),
        description: form.description,
        category: form.category || 'Otro',
        date: form.date,
        clientId: form.clientId || null,
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Nuevo ingreso</h2>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Descripción <span style={{ color: 'var(--accent)', fontSize: 12 }}>*</span></label>
            <input value={form.description} onChange={set('description')} placeholder="Ej: Venta de suplementos" required />
          </div>

          <div className="field">
            <label>Categoría <span style={{ color: 'var(--ink-soft)', fontWeight: 400, fontSize: 12 }}>(escribí la que quieras)</span></label>
            <input value={form.category} onChange={set('category')} placeholder="Ej: Suplementos, Alquiler, Consultoría..." />
          </div>

          {/* Client picker */}
          <div className="field" style={{ position: 'relative' }}>
            <label>Cliente <span style={{ color: 'var(--ink-soft)', fontWeight: 400, fontSize: 12 }}>(opcional)</span></label>
            {selectedClient ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--primary)', background: 'var(--primary-soft)' }}>
                <span style={{ flex: 1, fontWeight: 600, color: 'var(--primary)', fontSize: 14 }}>👤 {selectedClient.name}</span>
                <button type="button" onClick={clearClient} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)', fontSize: 16, lineHeight: 1 }}>✕</button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input
                  value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setShowClientDrop(true); }}
                  onFocus={() => setShowClientDrop(true)}
                  onBlur={() => setTimeout(() => setShowClientDrop(false), 150)}
                  placeholder="Buscar cliente o dejar vacío..."
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
                {showClientDrop && filteredClients.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', maxHeight: 200, overflowY: 'auto' }}>
                    {filteredClients.map(c => (
                      <div
                        key={c.id}
                        onMouseDown={() => selectClient(c)}
                        style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-soft)'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}
                      >
                        <strong>{c.name}</strong>
                        {c.dni && <span style={{ color: 'var(--ink-soft)', fontSize: 12, marginLeft: 8 }}>DNI {c.dni}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Monto <span style={{ color: 'var(--accent)', fontSize: 12 }}>*</span></label>
              <input value={form.amount} onChange={set('amount')} placeholder="0" inputMode="decimal" required />
            </div>
            <div className="field">
              <label>Fecha <span style={{ color: 'var(--accent)', fontSize: 12 }}>*</span></label>
              <input type="date" value={form.date} onChange={set('date')} required />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar ingreso'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Recordatorios() {
  const { business } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(3);
  const [waTemplate, setWaTemplate] = useState('Hola {nombre}, te recordamos que tu cuota de {actividad} vence el {vencimiento}. ¡Comunicate con nosotros para renovar! 🙌');

  useEffect(() => {
    if (business?.waTemplate) setWaTemplate(business.waTemplate);
  }, [business]);

  useEffect(() => {
    setLoading(true);
    api.get(`/enrollments/expiring?days=${days}`)
      .then(r => setItems(r.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [days]);

  function buildWaUrl(item) {
    const phone = (item.clientPhone || '').replace(/\D/g, '');
    if (!phone) return null;
    const dueDate = item.dueDate ? new Date(item.dueDate).toLocaleDateString('es-AR') : '';
    const msg = waTemplate
      .replace('{nombre}', item.clientName || '')
      .replace('{actividad}', item.activityName || 'membresía')
      .replace('{vencimiento}', dueDate)
      .replace('{negocio}', business?.name || '');
    const intlPhone = phone.startsWith('54') ? phone : `54${phone}`;
    return `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`;
  }

  const dayBadge = (n) => {
    if (n === 0) return { label: 'Hoy', color: '#dc2626', bg: '#fee2e2' };
    if (n === 1) return { label: 'Mañana', color: '#d97706', bg: '#fef3c7' };
    return { label: `${n} días`, color: '#16a34a', bg: '#dcfce7' };
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>Cuotas por vencer en:</span>
        {[1, 3, 7].map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            style={{
              padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
              background: days === d ? 'var(--primary)' : 'var(--surface)',
              color: days === d ? '#fff' : 'var(--ink)',
              boxShadow: days === d ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
            }}
          >{d === 1 ? 'mañana' : `${d} días`}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-soft)' }}>Cargando...</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
          <p style={{ color: 'var(--ink-soft)', margin: 0 }}>
            No hay cuotas pendientes que venzan en los próximos {days} día{days > 1 ? 's' : ''}
          </p>
        </div>
      ) : (
        <>
          <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginBottom: 12 }}>
            {items.length} cuota{items.length > 1 ? 's' : ''} por vencer — hacé clic en 📱 para abrir WhatsApp con el mensaje listo
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Actividad</th>
                  <th>Vencimiento</th>
                  <th>Días</th>
                  <th>Importe</th>
                  <th>WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const badge = dayBadge(item.daysLeft);
                  const waUrl = buildWaUrl(item);
                  return (
                    <tr key={item.cuotaId}>
                      <td style={{ fontWeight: 600 }}>{item.clientName}</td>
                      <td style={{ color: 'var(--ink-soft)' }}>{item.activityName || '—'}</td>
                      <td>{item.dueDate ? new Date(item.dueDate).toLocaleDateString('es-AR') : '—'}</td>
                      <td>
                        <span style={{
                          display: 'inline-block', padding: '2px 10px', borderRadius: 12,
                          fontSize: 12, fontWeight: 700,
                          color: badge.color, background: badge.bg,
                        }}>{badge.label}</span>
                      </td>
                      <td>${(item.amountDue || 0).toLocaleString('es-AR')}</td>
                      <td>
                        {waUrl ? (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              padding: '6px 14px', borderRadius: 8, textDecoration: 'none',
                              background: '#25d366', color: '#fff', fontWeight: 700, fontSize: 13,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            📱 Enviar
                          </a>
                        ) : (
                          <span style={{ color: 'var(--ink-soft)', fontSize: 13 }}>Sin teléfono</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={{ color: 'var(--ink-soft)', fontSize: 12, marginTop: 12 }}>
            💡 El mensaje usa la plantilla configurada en Ajustes → WhatsApp. Podés editarla ahí.
          </p>
        </>
      )}
    </div>
  );
}
