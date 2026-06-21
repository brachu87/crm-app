import { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const FREQ_LABELS = { weekly: 'Semanal', biweekly: 'Quincenal', monthly: 'Mensual' };
const STATUS_COLORS = { pending: '#f59e0b', paid: '#10b981' };

function fmtMoney(n) { return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0); }
function fmtDate(d) { return new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }); }
function toISO(d) { return d.toISOString().split('T')[0]; }

function getPeriodRange(freq, refDate = new Date()) {
  const d = new Date(refDate);
  if (freq === 'weekly') {
    const day = d.getDay();
    const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { from: toISO(mon), to: toISO(sun) };
  }
  if (freq === 'biweekly') {
    const dom = d.getDate();
    if (dom <= 15) return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, to: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15` };
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-16`, to: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${last}` };
  }
  const y = d.getFullYear(), m = d.getMonth() + 1;
  const last = new Date(y, m, 0).getDate();
  return { from: `${y}-${String(m).padStart(2, '0')}-01`, to: `${y}-${String(m).padStart(2, '0')}-${last}` };
}

function buildReceiptHTML(r, businessName) {
  const emp = r.employee;
  const from = fmtDate(r.periodStart);
  const to = fmtDate(r.periodEnd);
  const issued = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
  const rateLabel = r.payType === 'hourly' ? `${fmtMoney(r.payRate)}/h` : `Sueldo fijo: ${fmtMoney(r.payRate)}`;
  const hoursLine = r.payType === 'hourly' ? `<tr><td>Horas trabajadas</td><td>${r.totalHours.toFixed(1)} h</td></tr>` : '';
  const paidLine = r.paidAt ? `<tr><td>Fecha de pago</td><td>${fmtDate(r.paidAt)}</td></tr>` : '';
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Recibo de Sueldo</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 0 24px; color: #222; }
  .header { text-align: center; border-bottom: 2px solid #222; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { font-size: 22px; margin: 0 0 4px; }
  .header p { margin: 2px 0; font-size: 13px; color: #555; }
  h2 { font-size: 16px; margin: 0 0 4px; }
  .badge { display: inline-block; padding: 2px 12px; border-radius: 12px; font-size: 12px; font-weight: 700;
    background: ${r.status === 'paid' ? '#d1fae5' : '#fef3c7'}; color: ${r.status === 'paid' ? '#065f46' : '#92400e'}; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  td { padding: 8px 4px; border-bottom: 1px solid #eee; font-size: 14px; }
  td:last-child { text-align: right; font-weight: 600; }
  .total-row td { font-size: 18px; font-weight: 900; border-bottom: none; border-top: 2px solid #222; padding-top: 12px; }
  .total-row td:last-child { color: #059669; }
  .footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 16px; font-size: 12px; color: #999; text-align: center; }
  .sign-row { display: flex; justify-content: space-between; margin-top: 60px; font-size: 13px; }
  .sign-line { border-top: 1px solid #222; width: 200px; text-align: center; padding-top: 4px; }
  @media print { body { margin: 20px; } button { display: none; } }
</style></head><body>
<div class="header">
  <h1>${businessName || 'Mi Negocio'}</h1>
  <p>Recibo de Haberes</p>
  <p>Emitido: ${issued}</p>
</div>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
  <div>
    <h2>${emp?.name || ''}</h2>
    <p style="font-size:13px;color:#555;margin:2px 0">${emp?.role || ''}</p>
  </div>
  <span class="badge">${r.status === 'paid' ? 'PAGADO' : 'PENDIENTE'}</span>
</div>
<table>
  <tr><td>Período</td><td>${from} al ${to}</td></tr>
  <tr><td>Tipo de pago</td><td>${r.payType === 'hourly' ? 'Por hora' : 'Sueldo fijo'}</td></tr>
  <tr><td>Tarifa</td><td>${rateLabel}</td></tr>
  ${hoursLine}
  ${paidLine}
  <tr class="total-row"><td>TOTAL A PAGAR</td><td>${fmtMoney(r.totalAmount)}</td></tr>
</table>
${r.notes ? `<p style="font-size:13px;color:#555;margin-top:8px">Notas: ${r.notes}</p>` : ''}
<div class="sign-row">
  <div class="sign-line">Empleador</div>
  <div class="sign-line">Empleado / Recibí conforme</div>
</div>
<div class="footer">Este recibo fue generado digitalmente · ${businessName || ''}</div>
</body></html>`;
}

function printReceipt(r, businessName) {
  const html = buildReceiptHTML(r, businessName);
  const w = window.open('', '_blank', 'width=700,height=900');
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 500);
}

function sendWhatsApp(r, businessName) {
  const emp = r.employee;
  const from = new Date(r.periodStart).toLocaleDateString('es-AR');
  const to = new Date(r.periodEnd).toLocaleDateString('es-AR');
  const lines = [
    `🏢 *${businessName || 'Mi Negocio'}*`,
    `📋 *Recibo de Haberes*`,
    ``,
    `👤 Empleado: *${emp?.name || ''}*`,
    `📅 Período: ${from} al ${to}`,
    `⏱ Tipo de pago: ${r.payType === 'hourly' ? 'Por hora' : 'Sueldo fijo'}`,
    r.payType === 'hourly' ? `🕐 Horas: ${r.totalHours.toFixed(1)} h × ${fmtMoney(r.payRate)}/h` : `💰 Sueldo fijo: ${fmtMoney(r.payRate)}`,
    ``,
    `💵 *TOTAL: ${fmtMoney(r.totalAmount)}*`,
    `✅ Estado: ${r.status === 'paid' ? 'Pagado' : 'Pendiente'}`,
    r.notes ? `\n📝 ${r.notes}` : '',
  ].filter(l => l !== null && l !== undefined).join('\n');

  const phone = (emp?.phone || '').replace(/\D/g, '');
  const url = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(lines)}`
    : `https://wa.me/?text=${encodeURIComponent(lines)}`;
  window.open(url, '_blank');
}

export default function Payroll() {
  const { business } = useAuth();
  const businessName = business?.name || '';
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  const [filterEmp, setFilterEmp] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState({ employeeId: '', from: '', to: '' });
  const [loading, setLoading] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [newRecord, setNewRecord] = useState(null); // just-created record for quick actions

  useEffect(() => {
    api.get('/employees').then(r => setEmployees(r.data.filter(e => e.active !== false)));
    loadRecords();
  }, []);

  function loadRecords() {
    setLoading(true);
    api.get('/payroll').then(r => setRecords(r.data)).finally(() => setLoading(false));
  }

  function initForm(emp) {
    const range = getPeriodRange(emp.payFrequency || 'monthly');
    setForm({ employeeId: emp.id, from: range.from, to: range.to });
    setPreview(null);
  }

  async function calcPreview() {
    if (!form.employeeId || !form.from || !form.to) return;
    setLoadingPreview(true);
    try {
      const r = await api.post('/payroll/preview', { employeeId: form.employeeId, periodStart: form.from, periodEnd: form.to });
      setPreview(r.data);
    } catch (e) {
      alert(e.response?.data?.error || 'Error al calcular');
    } finally {
      setLoadingPreview(false);
    }
  }

  async function createRecord() {
    if (!preview) return;
    try {
      const res = await api.post('/payroll', {
        employeeId: preview.employee.id,
        periodStart: form.from,
        periodEnd: form.to,
        totalHours: preview.totalHours,
        payRate: preview.payRate,
        payType: preview.payType,
        totalAmount: preview.totalAmount,
      });
      setNewRecord(res.data);
      setShowForm(false);
      setPreview(null);
      loadRecords();
    } catch (e) {
      alert(e.response?.data?.error || 'Error al crear liquidación');
    }
  }

  async function markPaid(id) {
    await api.put(`/payroll/${id}`, { status: 'paid' });
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status: 'paid', paidAt: new Date().toISOString() } : r));
    if (newRecord?.id === id) setNewRecord(prev => ({ ...prev, status: 'paid', paidAt: new Date().toISOString() }));
  }

  async function deleteRecord(id) {
    if (!confirm('¿Eliminar liquidación?')) return;
    await api.delete(`/payroll/${id}`);
    setRecords(prev => prev.filter(r => r.id !== id));
    if (newRecord?.id === id) setNewRecord(null);
  }

  const filtered = records.filter(r => !filterEmp || r.employeeId === filterEmp);
  const pending = filtered.filter(r => r.status === 'pending');
  const paid = filtered.filter(r => r.status === 'paid');

  return (
    <div style={{ padding: '24px 20px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>Liquidaciones</h1>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }}
          onClick={() => { setShowForm(true); setPreview(null); setNewRecord(null); setForm({ employeeId: '', from: '', to: '' }); }}>
          + Nueva liquidación
        </button>
      </div>
      <p style={{ color: 'var(--muted)', marginBottom: 20, fontSize: 14 }}>Calculá y registrá el pago de sueldos y horas</p>

      {/* Quick actions after creation */}
      {newRecord && (
        <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#065f46', flex: 1 }}>
            ✅ Liquidación creada para {newRecord.employee?.name} — {fmtMoney(newRecord.totalAmount)}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={() => printReceipt(newRecord, businessName)}>🖨️ Imprimir recibo</button>
          <button className="btn btn-secondary btn-sm" style={{ background: '#25d366', color: '#fff', borderColor: '#25d366' }}
            onClick={() => sendWhatsApp(newRecord, businessName)}>📲 Enviar por WhatsApp</button>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065f46', fontSize: 18, lineHeight: 1 }}
            onClick={() => setNewRecord(null)}>×</button>
        </div>
      )}

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)} className="input" style={{ maxWidth: 220 }}>
          <option value="">Todos los empleados</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: '#f59e0b' }}>⏳ Pendientes de pago</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pending.map(r => <RecordRow key={r.id} r={r} onPay={markPaid} onDelete={deleteRecord} businessName={businessName} />)}
          </div>
        </section>
      )}

      {/* Paid */}
      <section>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: '#10b981' }}>✅ Pagados</h2>
        {loading ? <div style={{ color: 'var(--muted)', fontSize: 14 }}>Cargando...</div>
          : paid.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 14 }}>No hay liquidaciones pagadas.</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {paid.map(r => <RecordRow key={r.id} r={r} onPay={markPaid} onDelete={deleteRecord} businessName={businessName} />)}
            </div>}
      </section>

      {/* New payroll modal */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 style={{ marginBottom: 20, fontSize: 18, fontWeight: 800 }}>Nueva liquidación</h3>

            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Empleado</span>
              <select value={form.employeeId} onChange={e => {
                const emp = employees.find(em => em.id === e.target.value);
                if (emp) initForm(emp); else setForm(f => ({ ...f, employeeId: e.target.value }));
              }} className="input" style={{ marginTop: 4 }}>
                <option value="">Seleccionar empleado...</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.payType === 'hourly' ? `${fmtMoney(e.salary)}/h` : `Fijo ${fmtMoney(e.salary)}`}</option>)}
              </select>
            </label>

            {form.employeeId && (() => {
              const emp = employees.find(e => e.id === form.employeeId);
              return emp ? (
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>Frecuencia: </span><strong>{FREQ_LABELS[emp.payFrequency] || emp.payFrequency}</strong>
                  <span style={{ marginLeft: 16, color: 'var(--muted)' }}>Tipo: </span><strong>{emp.payType === 'hourly' ? 'Por hora' : 'Sueldo fijo'}</strong>
                </div>
              ) : null;
            })()}

            <div className="two-col-grid" style={{ marginBottom: 12 }}>
              <label>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Desde</span>
                <input type="date" value={form.from} onChange={e => setForm(f => ({ ...f, from: e.target.value }))} className="input" style={{ marginTop: 4 }} />
              </label>
              <label>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Hasta</span>
                <input type="date" value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))} className="input" style={{ marginTop: 4 }} />
              </label>
            </div>

            <button className="btn btn-secondary" style={{ width: '100%', marginBottom: 16 }} onClick={calcPreview} disabled={!form.employeeId || !form.from || !form.to || loadingPreview}>
              {loadingPreview ? 'Calculando...' : '🔢 Calcular'}
            </button>

            {preview && (
              <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Resumen del período</div>
                <div className="two-col-grid" style={{ fontSize: 13 }}>
                  <div><span style={{ color: 'var(--muted)' }}>Días presentes</span><br /><strong>{preview.presentDays}</strong></div>
                  <div><span style={{ color: 'var(--muted)' }}>Días ausentes</span><br /><strong style={{ color: '#ef4444' }}>{preview.absentDays}</strong></div>
                  <div><span style={{ color: 'var(--muted)' }}>Horas totales</span><br /><strong>{preview.totalHours.toFixed(1)} h</strong></div>
                  <div><span style={{ color: 'var(--muted)' }}>{preview.payType === 'hourly' ? 'Valor hora' : 'Sueldo fijo'}</span><br /><strong>{fmtMoney(preview.payRate)}</strong></div>
                </div>
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>Total a pagar</span>
                  <span style={{ fontSize: 22, fontWeight: 900, color: '#10b981' }}>{fmtMoney(preview.totalAmount)}</span>
                </div>
                {preview.attendances.length === 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#f59e0b' }}>⚠️ No hay asistencias registradas en este período.</div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => { setShowForm(false); setPreview(null); }}>Cancelar</button>
              <button className="btn btn-primary" onClick={createRecord} disabled={!preview}>Crear liquidación</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecordRow({ r, onPay, onDelete, businessName }) {
  const [open, setOpen] = useState(false);
  const emp = r.employee;
  const from = new Date(r.periodStart).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  const to = new Date(r.periodEnd).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{emp?.name}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{from} — {to} · {r.totalHours.toFixed(1)}h · {r.payType === 'hourly' ? `${new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(r.payRate)}/h` : 'Fijo'}</div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, color: r.status === 'paid' ? '#10b981' : '#f59e0b' }}>
          {new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(r.totalAmount)}
        </div>
        <span style={{ background: STATUS_COLORS[r.status] + '22', color: STATUS_COLORS[r.status], padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
          {r.status === 'paid' ? 'Pagado' : 'Pendiente'}
        </span>
        <span style={{ fontSize: 14, color: 'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
          {r.notes && <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>{r.notes}</p>}
          {r.status === 'paid' && r.paidAt && (
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>Pagado el {new Date(r.paidAt).toLocaleDateString('es-AR')}</p>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => printReceipt(r, businessName)}>🖨️ Imprimir recibo</button>
            <button className="btn btn-secondary btn-sm" style={{ background: '#25d366', color: '#fff', borderColor: '#25d366' }}
              onClick={() => sendWhatsApp(r, businessName)}>📲 WhatsApp</button>
            {r.status === 'pending' && (
              <button className="btn btn-primary btn-sm" onClick={() => onPay(r.id)}>✅ Marcar pagado</button>
            )}
            <button className="btn btn-secondary btn-sm" style={{ color: '#ef4444', marginLeft: 'auto' }} onClick={() => onDelete(r.id)}>Eliminar</button>
          </div>
        </div>
      )}
    </div>
  );
}
