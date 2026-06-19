import { useEffect, useState } from 'react';
import api from '../api/client';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function fmt(n) {
  return '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0 });
}

function BarChart({ data }) {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.flatMap((d) => [d.income, d.expenses]), 1);
  const W = 680, H = 220, PAD = 40, barW = 18, gap = 8;
  const groupW = barW * 2 + gap;
  const totalGroupW = data.length * (groupW + 20);
  const chartW = Math.max(W, totalGroupW + PAD * 2);
  const scaleY = (v) => PAD + (H - PAD * 2) * (1 - v / maxVal);

  return (
    <svg viewBox={`0 0 ${chartW} ${H + 40}`} style={{ width: '100%', maxHeight: 280 }}>
      {/* Y grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = scaleY(t * maxVal);
        return (
          <g key={t}>
            <line x1={PAD} y1={y} x2={chartW - PAD} y2={y} stroke="#e5e7eb" strokeWidth="1" />
            <text x={PAD - 4} y={y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
              {fmt(t * maxVal)}
            </text>
          </g>
        );
      })}
      {/* Bars */}
      {data.map((d, i) => {
        const x = PAD + i * (groupW + 20) + 10;
        const [yr, mo] = d.month.split('-');
        const label = MONTH_NAMES[parseInt(mo) - 1] + ' ' + yr.slice(2);
        return (
          <g key={d.month}>
            {/* Income bar */}
            <rect
              x={x}
              y={scaleY(d.income)}
              width={barW}
              height={(H - PAD) - scaleY(d.income)}
              fill="#10b981"
              rx="3"
            />
            {/* Expense bar */}
            <rect
              x={x + barW + gap}
              y={scaleY(d.expenses)}
              width={barW}
              height={(H - PAD) - scaleY(d.expenses)}
              fill="#ef4444"
              rx="3"
            />
            <text x={x + barW + gap / 2} y={H + 14} textAnchor="middle" fontSize="10" fill="#6b7280">
              {label}
            </text>
          </g>
        );
      })}
      {/* Legend */}
      <rect x={PAD} y={H + 24} width={10} height={10} fill="#10b981" rx="2" />
      <text x={PAD + 14} y={H + 33} fontSize="11" fill="#374151">Ingresos</text>
      <rect x={PAD + 80} y={H + 24} width={10} height={10} fill="#ef4444" rx="2" />
      <text x={PAD + 94} y={H + 33} fontSize="11" fill="#374151">Gastos</text>
    </svg>
  );
}

function DonutChart({ data }) {
  if (!data || data.length === 0) return null;
  const total = data.reduce((s, d) => s + d.total, 0);
  const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6'];
  const cx = 100, cy = 100, r = 80, innerR = 50;
  let angle = -Math.PI / 2;
  const slices = data.slice(0, 8).map((d, i) => {
    const sweep = (d.total / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const ix1 = cx + innerR * Math.cos(angle - sweep);
    const iy1 = cy + innerR * Math.sin(angle - sweep);
    const ix2 = cx + innerR * Math.cos(angle);
    const iy2 = cy + innerR * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    return {
      path: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${large} 0 ${ix1} ${iy1} Z`,
      color: COLORS[i % COLORS.length],
      label: d.category,
      pct: ((d.total / total) * 100).toFixed(1),
      total: d.total,
    };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
      <svg viewBox="0 0 200 200" style={{ width: 160, flexShrink: 0 }}>
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} />)}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="12" fill="#374151" fontWeight="600">Total</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="10" fill="#6b7280">{fmt(total)}</text>
      </svg>
      <div style={{ flex: 1 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 13, flex: 1 }}>{s.label}</span>
            <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{s.pct}%</span>
            <span style={{ fontSize: 13, fontWeight: 600, minWidth: 70, textAlign: 'right' }}>{fmt(s.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Reports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(6);
  const [activities, setActivities] = useState([]);
  const [activityFilter, setActivityFilter] = useState('');

  function load(m) {
    setLoading(true);
    api.get(`/reports/summary?months=${m}`)
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(months);
    api.get('/activities').then((res) => setActivities(res.data)).catch(() => {});
  }, [months]);

  const totalIncome = data?.monthlyData?.reduce((s, d) => s + d.income, 0) || 0;
  const totalExpenses = data?.monthlyData?.reduce((s, d) => s + d.expenses, 0) || 0;
  const balance = totalIncome - totalExpenses;
  const filteredTopClients = activityFilter
    ? (data?.topClients || [])
    : (data?.topClients || []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reportes</h1>
          <p className="page-subtitle">Resumen financiero del negocio</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }}
          >
            <option value="">Todas las actividades</option>
            {activities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }}
          >
            <option value={3}>Últimos 3 meses</option>
            <option value={6}>Últimos 6 meses</option>
            <option value={12}>Últimos 12 meses</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p>Calculando...</p>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
            <KPICard label="Ingresos totales" value={fmt(totalIncome)} color="#10b981" />
            <KPICard label="Gastos totales" value={fmt(totalExpenses)} color="#ef4444" />
            <KPICard label="Resultado" value={fmt(balance)} color={balance >= 0 ? '#10b981' : '#ef4444'} />
            <KPICard label="Costo sueldos/mes" value={fmt(data.totalSalaries)} color="#6366f1" />
            {data.overdueCount > 0 && (
              <KPICard label="Cuotas vencidas" value={data.overdueCount} color="#f59e0b" />
            )}
          </div>

          {/* Monthly chart */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 16 }}>Ingresos vs Gastos por mes</h3>
            <BarChart data={data.monthlyData} />
          </div>

          <div className="two-col-grid" style={{ gap: 20, marginBottom: 20 }}>
            {/* Expenses by category */}
            <div className="card">
              <h3 style={{ marginBottom: 16 }}>Gastos por categoría</h3>
              {data.expensesByCategory.length === 0 ? (
                <p style={{ color: 'var(--ink-soft)' }}>Sin gastos registrados</p>
              ) : (
                <DonutChart data={data.expensesByCategory} />
              )}
            </div>

            {/* Top clients */}
            <div className="card">
              <h3 style={{ marginBottom: 16 }}>Top clientes por ingreso</h3>
              {data.topClients.length === 0 ? (
                <p style={{ color: 'var(--ink-soft)' }}>Sin pagos registrados</p>
              ) : (
                <div className="table-wrap"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', paddingBottom: 8, color: 'var(--ink-soft)', fontWeight: 500 }}>#</th>
                      <th style={{ textAlign: 'left', paddingBottom: 8, color: 'var(--ink-soft)', fontWeight: 500 }}>Cliente</th>
                      <th style={{ textAlign: 'right', paddingBottom: 8, color: 'var(--ink-soft)', fontWeight: 500 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topClients.map((c, i) => (
                      <tr key={c.name} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 0', color: 'var(--ink-soft)' }}>{i + 1}</td>
                        <td style={{ padding: '8px 0' }}>{c.name}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600 }}>{fmt(c.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </div>
          </div>

          {/* Employees salary breakdown */}
          {data.employees.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: 16 }}>Nómina de empleados activos</h3>
              <div className="table-wrap"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', paddingBottom: 8, color: 'var(--ink-soft)', fontWeight: 500 }}>Empleado</th>
                    <th style={{ textAlign: 'left', paddingBottom: 8, color: 'var(--ink-soft)', fontWeight: 500 }}>Rol</th>
                    <th style={{ textAlign: 'right', paddingBottom: 8, color: 'var(--ink-soft)', fontWeight: 500 }}>Sueldo mensual</th>
                  </tr>
                </thead>
                <tbody>
                  {data.employees.map((e) => (
                    <tr key={e.name} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 0' }}>{e.name}</td>
                      <td style={{ padding: '8px 0', color: 'var(--ink-soft)' }}>{e.role}</td>
                      <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600 }}>
                        {e.salary ? fmt(e.salary) : <span style={{ color: 'var(--ink-soft)' }}>-</span>}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid #e5e7eb' }}>
                    <td colSpan={2} style={{ padding: '8px 0', fontWeight: 600 }}>Total nómina</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#6366f1' }}>{fmt(data.totalSalaries)}</td>
                  </tr>
                </tbody>
              </table></div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function KPICard({ label, value, color }) {
  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-soft)', marginBottom: 4 }}>{label}</p>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}
