import { useEffect, useState } from 'react';
import api from '../api/client';

function fmt(n) {
  return '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2 });
}

function HistorialTab() {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/daily-cash/history').then((res) => setDays(res.data)).finally(() => setLoading(false));
  }, []);

  // Group by month
  const byMonth = {};
  for (const d of days) {
    const month = d.date.slice(0, 7);
    if (!byMonth[month]) byMonth[month] = { income: 0, expenses: 0, days: [] };
    byMonth[month].income += d.income;
    byMonth[month].expenses += d.expenses;
    byMonth[month].days.push(d);
  }
  const months = Object.keys(byMonth).sort((a, b) => b.localeCompare(a));

  if (loading) return <p>Cargando historial...</p>;
  if (days.length === 0) return <div className="empty-state"><h3>Sin movimientos registrados</h3></div>;

  return (
    <div>
      {months.map((m) => {
        const { income, expenses, days: mDays } = byMonth[m];
        const [yr, mo] = m.split('-');
        const monthName = new Date(yr, parseInt(mo) - 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
        return (
          <div key={m} className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, textTransform: 'capitalize' }}>{monthName}</h3>
              <div style={{ display: 'flex', gap: 20, fontSize: 14 }}>
                <span style={{ color: '#10b981', fontWeight: 600 }}>↑ {fmt(income)}</span>
                <span style={{ color: '#ef4444', fontWeight: 600 }}>↓ {fmt(expenses)}</span>
                <span style={{ fontWeight: 700, color: (income - expenses) >= 0 ? '#10b981' : '#ef4444' }}>
                  = {fmt(income - expenses)}
                </span>
              </div>
            </div>
            <div className="table-wrap"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '4px 0', color: '#6b7280', fontWeight: 500 }}>Fecha</th>
                  <th style={{ textAlign: 'right', padding: '4px 0', color: '#6b7280', fontWeight: 500 }}>Ingresos</th>
                  <th style={{ textAlign: 'right', padding: '4px 0', color: '#6b7280', fontWeight: 500 }}>Gastos</th>
                  <th style={{ textAlign: 'right', padding: '4px 0', color: '#6b7280', fontWeight: 500 }}>Balance</th>
                  <th style={{ textAlign: 'right', padding: '4px 0', color: '#6b7280', fontWeight: 500 }}>Cierre</th>
                </tr>
              </thead>
              <tbody>
                {mDays.map((d) => {
                  const bal = (d.cashRecord?.openingBalance || 0) + d.income - d.expenses;
                  return (
                    <tr key={d.date} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '6px 0' }}>{new Date(d.date + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                      <td style={{ padding: '6px 0', textAlign: 'right', color: '#10b981' }}>{d.income > 0 ? fmt(d.income) : '-'}</td>
                      <td style={{ padding: '6px 0', textAlign: 'right', color: '#ef4444' }}>{d.expenses > 0 ? fmt(d.expenses) : '-'}</td>
                      <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>{fmt(d.income - d.expenses)}</td>
                      <td style={{ padding: '6px 0', textAlign: 'right', color: '#9ca3af' }}>
                        {d.cashRecord?.closingBalance != null ? fmt(d.cashRecord.closingBalance) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </div>
        );
      })}
    </div>
  );
}

export default function DailyCash() {
  const [tab, setTab] = useState('today');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  function load() {
    setLoading(true);
    api.get('/daily-cash/today')
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const balance = data
    ? (data.cashRecord?.openingBalance || 0) + data.totalIncome - data.totalExpenses
    : 0;

  const diff = data?.cashRecord?.closingBalance != null
    ? data.cashRecord.closingBalance - balance
    : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Caja</h1>
          <p className="page-subtitle">{new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'today' && data && !data.cashRecord && (
            <button className="btn btn-primary" onClick={() => setShowOpenModal(true)}>Abrir caja</button>
          )}
          {tab === 'today' && data?.cashRecord && !data.cashRecord.closingBalance && (
            <button className="btn btn-secondary" onClick={() => setShowCloseModal(true)}>Cerrar caja</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[['today', 'Hoy'], ['history', 'Historial']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '7px 18px', borderRadius: 20, fontSize: 14, cursor: 'pointer', border: 'none',
              background: tab === key ? 'var(--primary)' : '#f3f4f6',
              color: tab === key ? 'white' : '#374151', fontWeight: 600,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'history' && <HistorialTab />}

      {tab === 'today' && loading ? (
        <p>Cargando...</p>
      ) : tab === 'today' ? (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div className="card" style={{ padding: '16px 20px' }}>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Saldo inicial</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
                {data.cashRecord ? fmt(data.cashRecord.openingBalance) : <span style={{ color: '#9ca3af', fontSize: 14 }}>Sin abrir</span>}
              </p>
            </div>
            <div className="card" style={{ padding: '16px 20px' }}>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Ingresos del día</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#10b981' }}>{fmt(data.totalIncome)}</p>
            </div>
            <div className="card" style={{ padding: '16px 20px' }}>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Gastos del día</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#ef4444' }}>{fmt(data.totalExpenses)}</p>
            </div>
            <div className="card" style={{ padding: '16px 20px', background: balance >= 0 ? '#f0fdf4' : '#fef2f2' }}>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Saldo esperado</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: balance >= 0 ? '#10b981' : '#ef4444' }}>{fmt(balance)}</p>
            </div>
            {data.cashRecord?.closingBalance != null && (
              <div className="card" style={{ padding: '16px 20px', background: diff === 0 ? '#f0fdf4' : '#fef3c7' }}>
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Diferencia al cierre</p>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: diff === 0 ? '#10b981' : '#f59e0b' }}>
                  {diff >= 0 ? '+' : ''}{fmt(diff)}
                </p>
              </div>
            )}
          </div>

          {!data.cashRecord && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="empty-state">
                <h3>Caja no abierta</h3>
                <p>Abrí la caja del día ingresando el saldo inicial en efectivo.</p>
                <button className="btn btn-primary" onClick={() => setShowOpenModal(true)} style={{ marginTop: 12 }}>
                  Abrir caja
                </button>
              </div>
            </div>
          )}

          <div className="two-col-grid" style={{ gap: 20 }}>
            {/* Cobros del día */}
            <div className="card">
              <h3 style={{ marginBottom: 16 }}>Cobros del día ({data.payments.length})</h3>
              {data.payments.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: 14 }}>Sin cobros registrados hoy</p>
              ) : (
                <div className="table-wrap"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', paddingBottom: 8, color: '#6b7280', fontWeight: 500 }}>Cliente</th>
                      <th style={{ textAlign: 'left', paddingBottom: 8, color: '#6b7280', fontWeight: 500 }}>Actividad</th>
                      <th style={{ textAlign: 'right', paddingBottom: 8, color: '#6b7280', fontWeight: 500 }}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((p) => (
                      <tr key={p.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '7px 0' }}>{p.enrollment.client.name}</td>
                        <td style={{ padding: '7px 0', color: '#6b7280' }}>{p.enrollment.activity.name}</td>
                        <td style={{ padding: '7px 0', textAlign: 'right', fontWeight: 600, color: '#10b981' }}>{fmt(p.amount)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '2px solid #e5e7eb' }}>
                      <td colSpan={2} style={{ padding: '7px 0', fontWeight: 600 }}>Total</td>
                      <td style={{ padding: '7px 0', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{fmt(data.totalIncome)}</td>
                    </tr>
                  </tbody>
                </table></div>
              )}
            </div>

            {/* Gastos del día */}
            <div className="card">
              <h3 style={{ marginBottom: 16 }}>Gastos del día ({data.expenses.length})</h3>
              {data.expenses.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: 14 }}>Sin gastos registrados hoy</p>
              ) : (
                <div className="table-wrap"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', paddingBottom: 8, color: '#6b7280', fontWeight: 500 }}>Descripción</th>
                      <th style={{ textAlign: 'left', paddingBottom: 8, color: '#6b7280', fontWeight: 500 }}>Categoría</th>
                      <th style={{ textAlign: 'right', paddingBottom: 8, color: '#6b7280', fontWeight: 500 }}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.expenses.map((e) => (
                      <tr key={e.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '7px 0' }}>{e.description || '-'}</td>
                        <td style={{ padding: '7px 0', color: '#6b7280' }}>{e.category}</td>
                        <td style={{ padding: '7px 0', textAlign: 'right', fontWeight: 600, color: '#ef4444' }}>{fmt(e.amount)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '2px solid #e5e7eb' }}>
                      <td colSpan={2} style={{ padding: '7px 0', fontWeight: 600 }}>Total</td>
                      <td style={{ padding: '7px 0', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{fmt(data.totalExpenses)}</td>
                    </tr>
                  </tbody>
                </table></div>
              )}
            </div>
          </div>
        </>
      ) : null}

      {showOpenModal && (
        <CashModal
          title="Abrir caja"
          field="openingBalance"
          fieldLabel="Saldo inicial en efectivo ($)"
          existingId={data?.cashRecord?.id}
          onClose={() => setShowOpenModal(false)}
          onSaved={() => { setShowOpenModal(false); load(); }}
        />
      )}
      {showCloseModal && (
        <CashModal
          title="Cerrar caja"
          field="closingBalance"
          fieldLabel="Saldo final real en efectivo ($)"
          existingId={data?.cashRecord?.id}
          isClose
          onClose={() => setShowCloseModal(false)}
          onSaved={() => { setShowCloseModal(false); load(); }}
        />
      )}
    </div>
  );
}

function CashModal({ title, field, fieldLabel, existingId, isClose, onClose, onSaved }) {
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (existingId && isClose) {
        await api.put(`/daily-cash/${existingId}`, { closingBalance: value, notes });
      } else if (existingId) {
        await api.put(`/daily-cash/${existingId}`, { openingBalance: value, notes });
      } else {
        await api.post('/daily-cash', { openingBalance: value, notes });
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <h2>{title}</h2>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>{fieldLabel}</label>
            <input type="number" min="0" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0.00" required />
          </div>
          <div className="field">
            <label>Observaciones</label>
            <textarea rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : title}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
