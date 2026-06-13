import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cashData, setCashData] = useState(null);
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    api.get('/dashboard').then((res) => setData(res.data)).finally(() => setLoading(false));
    api.get('/daily-cash/today').then((res) => setCashData(res.data)).catch(() => {});
    api.get('/notes').then((res) => setNotes(res.data.filter((n) => !n.completed))).catch(() => {});
  }, []);

  if (loading) return <p>Cargando...</p>;
  if (!data) return <p>No se pudo cargar el resumen.</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Inicio</h1>
          <p className="page-subtitle">Resumen general de tu negocio</p>
        </div>
      </div>

      {data.overdue.count > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#991b1b', fontSize: 14 }}>
            🔴 <strong>{data.overdue.count}</strong> {data.overdue.count === 1 ? 'cuota vencida' : 'cuotas vencidas'} — {formatMoney(data.overdue.total)} sin cobrar
          </span>
          <Link to="/cobranza" className="btn btn-secondary btn-sm">Ver cobranza</Link>
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
              display: 'block', padding: '14px 16px', borderRadius: 12, background: 'white',
              border: '1px solid #e5e7eb', textDecoration: 'none', color: link.color,
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
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Cobrado hoy</p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#10b981' }}>{formatMoney(cashData.totalIncome)}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Gastado hoy</p>
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
              <div key={n.id} style={{ padding: '7px 0', borderBottom: '1px solid #f3f4f6', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: n.priority === 'high' ? '#f59e0b' : isOverdue ? '#ef4444' : '#9ca3af' }}>●</span>
                <span style={{ flex: 1 }}>{n.title}</span>
                {isOverdue && <span style={{ fontSize: 11, color: '#ef4444', background: '#fee2e2', padding: '1px 6px', borderRadius: 8 }}>Vencida</span>}
                {n.dueDate && !isOverdue && <span style={{ fontSize: 12, color: '#9ca3af' }}>{formatDate(n.dueDate)}</span>}
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
          <table className="table">
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
          </table>
        )}
      </div>
    </div>
  );
}
