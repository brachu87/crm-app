import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

const statusLabels = {
  paid: 'Pagado',
  pending: 'Pendiente',
  overdue: 'Vencido',
};

function formatMoney(value) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value || 0);
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('es-AR');
}

function shortMonth(monthStr) {
  // monthStr = "2026-01"
  const [y, m] = monthStr.split('-');
  const names = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return names[parseInt(m, 10) - 1] || m;
}

function BarChart({ months }) {
  if (!months || months.length === 0) return <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>Sin datos</p>;
  const maxVal = Math.max(...months.map((m) => Math.max(m.income || 0, m.expenses || 0)), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 130, paddingBottom: 24, position: 'relative' }}>
      {months.map((m, i) => {
        const incH = Math.round(((m.income || 0) / maxVal) * 100);
        const expH = Math.round(((m.expenses || 0) / maxVal) * 100);
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, height: '100%', justifyContent: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, width: '100%', justifyContent: 'center', flex: 1 }}>
              <div
                title={`Ingresos: ${formatMoney(m.income)}`}
                style={{ width: '40%', height: `${incH}%`, minHeight: incH > 0 ? 3 : 0, background: '#10b981', borderRadius: '3px 3px 0 0', transition: 'height .3s' }}
              />
              <div
                title={`Gastos: ${formatMoney(m.expenses)}`}
                style={{ width: '40%', height: `${expH}%`, minHeight: expH > 0 ? 3 : 0, background: '#ef4444', borderRadius: '3px 3px 0 0', transition: 'height .3s' }}
              />
            </div>
            <div style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 4 }}>{shortMonth(m.month)}</div>
          </div>
        );
      })}
    </div>
  );
}

function DonutChart({ paid, pending, overdue }) {
  const total = paid + pending + overdue;
  if (total === 0) return <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>Sin inscripciones</p>;
  const paidPct = (paid / total) * 100;
  const pendingPct = (pending / total) * 100;
  const overduePct = (overdue / total) * 100;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 90, height: 90, borderRadius: '50%',
        background: `conic-gradient(#10b981 0% ${paidPct}%, #f59e0b ${paidPct}% ${paidPct + pendingPct}%, #ef4444 ${paidPct + pendingPct}% 100%)`,
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 52, height: 52, borderRadius: '50%', background: 'var(--surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: 'var(--ink)',
        }}>{total}</div>
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
        <span style={{ color: '#10b981', fontWeight: 600 }}>● {paid} pagados</span>
        <span style={{ color: '#f59e0b', fontWeight: 600 }}>● {pending} pend.</span>
        <span style={{ color: '#ef4444', fontWeight: 600 }}>● {overdue} venc.</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cashData, setCashData] = useState(null);
  const [notes, setNotes] = useState([]);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api.get('/dashboard').then((res) => setData(res.data)).finally(() => setLoading(false));
    api.get('/daily-cash/today').then((res) => setCashData(res.data)).catch(() => {});
    api.get('/notes').then((res) => setNotes(res.data.filter((n) => !n.completed))).catch(() => {});
    api.get('/reports/summary?months=6').then((res) => setSummary(res.data)).catch(() => {});
  }, []);

  if (loading) return <p>Cargando...</p>;
  if (!data) return <p>No se pudo cargar el resumen.</p>;

  // Proximas a vencer: pending enrollments with dueDate in next 7 days
  const proximas7 = (data.upcomingDueDates || []).filter((e) => {
    if (!e.dueDate || e.paymentStatus === 'paid') return false;
    const due = new Date(e.dueDate);
    const limit = new Date();
    limit.setDate(limit.getDate() + 7);
    return due >= new Date() && due <= limit;
  });

  // Estado de las inscripciones activas (lo provee el backend, una porción por membresía)
  const enrollmentStatus = data.enrollmentStatus || { paid: 0, pending: 0, overdue: 0 };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Inicio</h1>
          <p className="page-subtitle">Resumen general de tu negocio</p>
        </div>
      </div>

      {data.overdue.count > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 18px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ color: '#991b1b', fontSize: 14 }}>
            🔴 <strong>{data.overdue.count}</strong> {data.overdue.count === 1 ? 'cuota vencida' : 'cuotas vencidas'} — {formatMoney(data.overdue.total)} sin cobrar
          </span>
          <Link to="/cobranza" className="btn btn-secondary btn-sm">Ver cobranza</Link>
        </div>
      )}

      {proximas7.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ color: '#92400e', fontSize: 14 }}>
            ⏰ <strong>{proximas7.length}</strong> {proximas7.length === 1 ? 'cuota vence' : 'cuotas vencen'} en los próximos 7 días
          </span>
          <Link to="/cobranza" className="btn btn-secondary btn-sm">Ver próximas</Link>
        </div>
      )}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Clientes</div>
          <div className="stat-value">{data.clientsCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Actividades activas</div>
          <div className="stat-value">{data.activitiesCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pagos pendientes</div>
          <div className="stat-value warn">{data.pending.count}</div>
          <div className="page-subtitle">{formatMoney(data.pending.total)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pagos vencidos</div>
          <div className="stat-value accent">{data.overdue.count}</div>
          <div className="page-subtitle">{formatMoney(data.overdue.total)}</div>
        </div>
      </div>

      {/* Charts row */}
      <div className="chart-grid">
        {/* Bar chart */}
        <div className="card" style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, margin: 0 }}>Ingresos vs Gastos</h2>
            <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
              <span style={{ color: '#10b981', fontWeight: 600 }}>● Ingresos</span>
              <span style={{ color: '#ef4444', fontWeight: 600 }}>● Gastos</span>
            </div>
          </div>
          <BarChart months={summary?.monthlyData || []} />
          {summary?.monthlyData && summary.monthlyData.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-soft)', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <span>Total ingresos: <strong style={{ color: '#10b981' }}>{formatMoney(summary.monthlyData.reduce((a, m) => a + (m.income || 0), 0))}</strong></span>
              <span>Total gastos: <strong style={{ color: '#ef4444' }}>{formatMoney(summary.monthlyData.reduce((a, m) => a + (m.expenses || 0), 0))}</strong></span>
            </div>
          )}
        </div>

        {/* Donut chart */}
        <div className="card donut-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 200 }}>
          <h2 style={{ fontSize: 15, margin: '0 0 16px' }}>Inscripciones</h2>
          <DonutChart
            paid={enrollmentStatus.paid}
            pending={enrollmentStatus.pending}
            overdue={enrollmentStatus.overdue}
          />
        </div>
      </div>

      {/* Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { to: '/reportes', label: '📊 Reportes', color: '#6366f1' },
          { to: '/caja', label: '💰 Caja del día', color: '#10b981' },
          { to: '/empleados', label: '👤 Empleados', color: '#f59e0b' },
          { to: '/gastos', label: '📋 Gastos', color: '#ef4444' },
          { to: '/proveedores', label: '🏢 Proveedores', color: '#3b82f6' },
          { to: '/agenda', label: '📝 Agenda', color: '#8b5cf6' },
        ].map((link) => (
          <Link
            key={link.to}
            to={link.to}
            style={{
              display: 'block', padding: '14px 16px', borderRadius: 12, background: 'var(--surface)',
              border: '1px solid var(--border)', textDecoration: 'none', color: link.color,
              fontWeight: 600, fontSize: 14, transition: 'box-shadow .15s',
            }}
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* Caja del día mini-summary */}
      {cashData && (cashData.totalIncome > 0 || cashData.totalExpenses > 0) && (
        <div className="card" style={{ marginBottom: 20, display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-soft)' }}>Cobrado hoy</p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#10b981' }}>{formatMoney(cashData.totalIncome)}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-soft)' }}>Gastado hoy</p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#ef4444' }}>{formatMoney(cashData.totalExpenses)}</p>
          </div>
          <Link to="/caja" className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }}>Ver caja completa</Link>
        </div>
      )}

      {/* Pending notes */}
      {notes.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>📝 Tareas pendientes ({notes.length})</h2>
            <Link to="/agenda" className="btn btn-secondary btn-sm">Ver todas</Link>
          </div>
          {notes.slice(0, 3).map((n) => {
            const isOverdue = n.dueDate && new Date(n.dueDate) < new Date();
            return (
              <div key={n.id} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: n.priority === 'high' ? '#f59e0b' : isOverdue ? '#ef4444' : 'var(--ink-soft)' }}>●</span>
                <span style={{ flex: 1 }}>{n.title}</span>
                {isOverdue && <span style={{ fontSize: 11, color: '#ef4444', background: '#fee2e2', padding: '1px 6px', borderRadius: 8 }}>Vencida</span>}
                {n.dueDate && !isOverdue && <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{formatDate(n.dueDate)}</span>}
              </div>
            );
          })}
        </div>
      )}

      <div className="card">
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Próximos vencimientos</h2>
        {data.upcomingDueDates.length === 0 ? (
          <div className="empty-state">
            <h3>Sin vencimientos pendientes</h3>
            <p>Cuando inscribas clientes con fecha de vencimiento, los vas a ver acá.</p>
          </div>
        ) : (
          <div className="table-wrap"><table className="table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Actividad</th>
                <th>Vence</th>
                <th>Monto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.upcomingDueDates.map((e) => (
                <tr key={e.id}>
                  <td><Link to={`/clientes/${e.clientId}`}>{e.client.name}</Link></td>
                  <td>{e.activity.name}</td>
                  <td>{formatDate(e.dueDate)}</td>
                  <td>{formatMoney(e.amountDue)}</td>
                  <td><span className={`pill pill-${e.paymentStatus}`}>{statusLabels[e.paymentStatus]}</span></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
