import { useState, useEffect } from 'react';
import api from '../api';

const FREQ_LABELS = { weekly: 'Semanal', biweekly: 'Quincenal', monthly: 'Mensual' };
const STATUS_COLORS = { pending: '#f59e0b', paid: '#10b981' };

function fmtMoney(n) { return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0); }
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
  // monthly
  const y = d.getFullYear(), m = d.getMonth() + 1;
  const last = new Date(y, m, 0).getDate();
  return { from: `${y}-${String(m).padStart(2, '0')}-01`, to: `${y}-${String(m).padStart(2, '0')}-${last}` };
}

export default function Payroll() {
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  const [filterEmp, setFilterEmp] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState({ employeeId: '', from: '', to: '' });
  const [loading, setLoading] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

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
    await api.post('/payroll', {
      employeeId: preview.employee.id,
      periodStart: form.from,
      periodEnd: form.to,
      totalHours: preview.totalHours,
      payRate: preview.payRate,
      payType: preview.payType,
      totalAmount: preview.totalAmount,
    });
    setShowForm(false);
    setPreview(null);
    loadRecords();
  }

  async function markPaid(id) {
    await api.put(`/payroll/${id}`, { status: 'paid' });
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status: 'paid', paidAt: new Date().toISOString() } : r));
  }

  async function deleteRecord(id) {
    if (!confirm('¿Eliminar liquidación?')) return;
    await api.delete(`/payroll/${id}`);
    setRecords(prev => prev.filter(r => r.id !== id));
  }

  const filtered = records.filter(r => !filterEmp || r.employeeId === filterEmp);
  const pending = filtered.filter(r => r.status === 'pending');
  const paid = filtered.filter(r => r.status === 'paid');

  return (
    <div style={{ padding: '24px 20px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>Liquidaciones</h1>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => { setShowForm(true); setPreview(null); setForm({ employeeId: '', from: '', to: '' }); }}>
          + Nueva liquidación
        </button>
      </div>
      <p style={{ color: 'var(--muted)', marginBottom: 20, fontSize: 14 }}>Calculá y registrá el pago de sueldos y horas</p>

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
            {pending.map(r => <RecordRow key={r.id} r={r} onPay={markPaid} onDelete={deleteRecord} />)}
          </div>
        </section>
      )}

      {/* Paid */}
      <section>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: '#10b981' }}>✅ Pagados</h2>
        {loading ? <div style={{ color: 'var(--muted)', fontSize: 14 }}>Cargando...</div>
          : paid.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 14 }}>No hay liquidaciones pagadas.</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {paid.map(r => <RecordRow key={r.id} r={r} onPay={markPaid} onDelete={deleteRecord} />)}
            </div>}
      </section>

      {/* New payroll modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: '#0008', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 16 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 8px 32px #0004', maxHeight: '90vh', overflowY: 'auto' }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
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

function RecordRow({ r, onPay, onDelete }) {
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
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {r.notes && <span style={{ fontSize: 13, color: 'var(--muted)', flex: 1 }}>{r.notes}</span>}
          {r.status === 'paid' && r.paidAt && (
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Pagado el {new Date(r.paidAt).toLocaleDateString('es-AR')}</span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {r.status === 'pending' && (
              <button className="btn btn-primary btn-sm" onClick={() => onPay(r.id)}>✅ Marcar pagado</button>
            )}
            <button className="btn btn-secondary btn-sm" style={{ color: '#ef4444' }} onClick={() => onDelete(r.id)}>Eliminar</button>
          </div>
        </div>
      )}
    </div>
  );
}
