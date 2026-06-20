import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

function formatMoney(value) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value || 0);
}
function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('es-AR');
}
function shortMonth(monthStr) {
  const [, m] = monthStr.split('-');
  return ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(m,10)-1] || m;
}

// ─── Widget catalog ──────────────────────────────────────────────────────────
const WIDGET_CATALOG = [
  { id: 'clientes',       label: 'Clientes activos',      icon: '👥', color: 'var(--primary)',  dataKey: 'clientsCount',    sub: null },
  { id: 'actividades',    label: 'Actividades activas',   icon: '🏷️',  color: '#6366f1',          dataKey: 'activitiesCount', sub: null },
  { id: 'servicios',      label: 'Turnos/trabajos del mes', icon: '🔧', color: '#0ea5e9',        dataKey: 'servicesCount',   sub: null },
  { id: 'empleados',      label: 'Empleados activos',     icon: '👤', color: '#f59e0b',          dataKey: 'employeesCount',  sub: null },
  { id: 'proveedores',    label: 'Proveedores',           icon: '🏢', color: '#8b5cf6',          dataKey: 'suppliersCount',  sub: null },
  { id: 'ingresos_mes',   label: 'Ingresos del mes',      icon: '💰', color: '#10b981',          dataKey: 'ingresosDelMes',  money: true, sub: null },
  { id: 'gastos_mes',     label: 'Gastos del mes',        icon: '📋', color: '#ef4444',          dataKey: 'gastosDelMes',    money: true, sub: null },
  { id: 'pendientes',     label: 'Cobros pendientes',     icon: '⏳', color: '#f59e0b',          dataKey: 'pending',         isBucket: true },
  { id: 'vencidos',       label: 'Cobros vencidos',       icon: '🔴', color: '#ef4444',          dataKey: 'overdue',         isBucket: true },
];

const DEFAULT_WIDGETS = ['clientes', 'ingresos_mes', 'pendientes', 'vencidos'];

function loadWidgetPrefs() {
  try {
    const v = localStorage.getItem('dashboard_widgets');
    if (v) return JSON.parse(v);
  } catch {}
  return DEFAULT_WIDGETS;
}
function saveWidgetPrefs(ids) {
  localStorage.setItem('dashboard_widgets', JSON.stringify(ids));
}

// ─── Bar chart ───────────────────────────────────────────────────────────────
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
              <div title={`Ingresos: ${formatMoney(m.income)}`} style={{ width: '40%', height: `${incH}%`, minHeight: incH > 0 ? 3 : 0, background: '#10b981', borderRadius: '3px 3px 0 0', transition: 'height .3s' }} />
              <div title={`Gastos: ${formatMoney(m.expenses)}`} style={{ width: '40%', height: `${expH}%`, minHeight: expH > 0 ? 3 : 0, background: '#ef4444', borderRadius: '3px 3px 0 0', transition: 'height .3s' }} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 4 }}>{shortMonth(m.month)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ widget, data }) {
  const raw = data[widget.dataKey];
  let value, sub;
  if (widget.isBucket) {
    value = raw?.count ?? 0;
    sub = formatMoney(raw?.total);
  } else if (widget.money) {
    value = formatMoney(raw);
    sub = null;
  } else {
    value = raw ?? 0;
    sub = null;
  }
  return (
    <div className="stat-card" style={{ borderTop: `3px solid ${widget.color}` }}>
      <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{widget.icon}</span> {widget.label}
      </div>
      <div className="stat-value" style={{ color: widget.color, fontSize: widget.money ? 24 : 32 }}>
        {value}
      </div>
      {sub && <div className="page-subtitle" style={{ fontSize: 13 }}>{sub}</div>}
    </div>
  );
}

// ─── Customize panel ─────────────────────────────────────────────────────────
function CustomizePanel({ selected, onChange, onClose }) {
  const [local, setLocal] = useState(selected);

  function toggle(id) {
    setLocal(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function save() {
    onChange(local);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <h2>Personalizar inicio</h2>
        <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginBottom: 20, marginTop: -8 }}>
          Elegí las tarjetas que querés ver en tu dashboard. Podés seleccionar las que mejor se adapten a tu negocio.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 10 }}>
          {WIDGET_CATALOG.map(w => {
            const on = local.includes(w.id);
            return (
              <button
                key={w.id}
                onClick={() => toggle(w.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                  background: on ? w.color + '18' : 'var(--bg)',
                  border: `2px solid ${on ? w.color : 'var(--border)'}`,
                  color: 'var(--ink)', textAlign: 'left', transition: 'all .15s',
                }}
              >
                <span style={{ fontSize: 20 }}>{w.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{w.label}</div>
                </div>
                {on && <span style={{ marginLeft: 'auto', color: w.color, fontSize: 16 }}>✓</span>}
              </button>
            );
          })}
        </div>
        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [summary, setSummary] = useState(null);
  const [notes, setNotes]     = useState([]);
  const [apptTasks, setApptTasks] = useState([]);
  const [cashData, setCashData] = useState(null);
  const [showCustomize, setShowCustomize] = useState(false);
  const [activeWidgets, setActiveWidgets] = useState(loadWidgetPrefs);

  useEffect(() => {
    api.get('/dashboard')
      .then(r => setData(r.data))
      .catch(() => setError('No se pudo cargar el resumen del negocio.'))
      .finally(() => setLoading(false));
    api.get('/daily-cash/today').then(r => setCashData(r.data)).catch(() => {});
    api.get('/notes').then(r => setNotes(r.data.filter(n => !n.completed))).catch(() => {});
    // Fetch turnos de hoy + próximos 7 días no completados
    const today = new Date();
    const in7 = new Date(); in7.setDate(today.getDate() + 7);
    const fmt = d => d.toISOString().slice(0,10);
    api.get(`/appointments?from=${fmt(today)}&to=${fmt(in7)}&status=scheduled`).then(r => {
      const appts = (r.data || []).filter(a => a.status !== 'completed');
      setApptTasks(appts);
    }).catch(() => {});
    api.get('/reports/summary?months=6').then(r => setSummary(r.data)).catch(() => {});
  }, []);

  function handleWidgetChange(ids) {
    saveWidgetPrefs(ids);
    setActiveWidgets(ids);
  }

  if (loading) return <p>Cargando...</p>;
  if (error)   return <div className="error-banner">{error}</div>;
  if (!data)   return <p>No se pudo cargar el resumen.</p>;

  const visibleWidgets = WIDGET_CATALOG.filter(w => activeWidgets.includes(w.id));

  const proximas7 = (data.upcomingDueDates || []).filter(e => {
    if (!e.dueDate || e.paymentStatus === 'paid') return false;
    const due   = new Date(e.dueDate);
    const limit = new Date(); limit.setDate(limit.getDate() + 7);
    return due >= new Date() && due <= limit;
  });

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Inicio</h1>
          <p className="page-subtitle">Resumen general de tu negocio</p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => setShowCustomize(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ⚙️ Personalizar
        </button>
      </div>

      {/* Alerts */}
      {data.overdue?.count > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 18px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ color: '#991b1b', fontSize: 14 }}>
            🔴 <strong>{data.overdue.count}</strong> {data.overdue.count === 1 ? 'cobro vencido' : 'cobros vencidos'} — {formatMoney(data.overdue.total)} sin cobrar
          </span>
          <Link to="/cobranza" className="btn btn-secondary btn-sm">Ver cobranza</Link>
        </div>
      )}
      {proximas7.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 18px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ color: '#92400e', fontSize: 14 }}>
            ⏰ <strong>{proximas7.length}</strong> {proximas7.length === 1 ? 'vencimiento' : 'vencimientos'} en los próximos 7 días
          </span>
          <Link to="/cobranza" className="btn btn-secondary btn-sm">Ver próximas</Link>
        </div>
      )}
      {data.pendingAppts?.count > 0 && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ color: '#9a3412', fontSize: 14 }}>
            🔧 <strong>{data.pendingAppts.count}</strong> {data.pendingAppts.count === 1 ? 'trabajo/turno sin cobrar' : 'trabajos/turnos sin cobrar'} — {formatMoney(data.pendingAppts.total)}
          </span>
          <Link to="/cobranza" className="btn btn-secondary btn-sm">Ir a Cobranza</Link>
        </div>
      )}

      {/* Stat cards — selected widgets */}
      {visibleWidgets.length > 0 ? (
        <div className="stat-grid">
          {visibleWidgets.map(w => <StatCard key={w.id} widget={w} data={data} />)}
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 20, padding: 24, textAlign: 'center', color: 'var(--ink-soft)' }}>
          <p>No hay tarjetas seleccionadas. <button style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }} onClick={() => setShowCustomize(true)}>Personalizar →</button></p>
        </div>
      )}

      {/* Charts */}
      <div className="chart-grid" style={{ marginBottom: 20 }}>
        <div className="card" style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, margin: 0 }}>Ingresos vs Gastos (6 meses)</h2>
            <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
              <span style={{ color: '#10b981', fontWeight: 600 }}>● Ingresos</span>
              <span style={{ color: '#ef4444', fontWeight: 600 }}>● Gastos</span>
            </div>
          </div>
          <BarChart months={summary?.monthlyData || []} />
          {summary?.monthlyData?.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-soft)', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <span>Total: <strong style={{ color: '#10b981' }}>{formatMoney(summary.monthlyData.reduce((a,m)=>a+(m.income||0),0))}</strong></span>
              <span>Gastos: <strong style={{ color: '#ef4444' }}>{formatMoney(summary.monthlyData.reduce((a,m)=>a+(m.expenses||0),0))}</strong></span>
            </div>
          )}
        </div>

        {/* Caja hoy */}
        {cashData && (cashData.totalIncome > 0 || cashData.totalExpenses > 0) && (
          <div className="card donut-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
            <h2 style={{ fontSize: 15, margin: 0, textAlign: 'center' }}>Caja de hoy</h2>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Cobrado</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#10b981' }}>{formatMoney(cashData.totalIncome)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Gastado</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#ef4444' }}>{formatMoney(cashData.totalExpenses)}</div>
            </div>
            <div style={{ textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Resultado</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: (cashData.totalIncome - cashData.totalExpenses) >= 0 ? '#10b981' : '#ef4444' }}>
                {formatMoney(cashData.totalIncome - cashData.totalExpenses)}
              </div>
            </div>
            <Link to="/caja" className="btn btn-secondary btn-sm" style={{ textAlign: 'center' }}>Ver caja</Link>
          </div>
        )}
      </div>

      {/* Accesos rápidos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { to: '/clientes',   label: '👥 Clientes',       color: 'var(--primary)' },
          { to: '/cobranza',   label: '💰 Cobranza',        color: '#10b981' },
          { to: '/caja',       label: '🏦 Caja del día',    color: '#0ea5e9' },
          { to: '/reportes',   label: '📊 Reportes',        color: '#6366f1' },
          { to: '/gastos',     label: '📋 Gastos',          color: '#ef4444' },
          { to: '/agenda',     label: '📝 Agenda',          color: '#8b5cf6' },
        ].map(link => (
          <Link key={link.to} to={link.to} style={{
            display: 'block', padding: '13px 14px', borderRadius: 10,
            background: 'var(--surface)', border: '1px solid var(--border)',
            textDecoration: 'none', color: link.color, fontWeight: 600, fontSize: 14,
          }}>
            {link.label}
          </Link>
        ))}
      </div>

      {/* Tareas pendientes + Turnos */}
      {(notes.length > 0 || apptTasks.length > 0) && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>📝 Pendientes ({notes.length + apptTasks.length})</h2>
            <Link to="/agenda" className="btn btn-secondary btn-sm">Ver agenda</Link>
          </div>
          {notes.slice(0, 5).map(n => {
            const isOverdue = n.dueDate && new Date(n.dueDate) < new Date();
            return (
              <div key={`note-${n.id}`} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: n.priority === 'high' ? '#f59e0b' : isOverdue ? '#ef4444' : 'var(--ink-soft)' }}>●</span>
                <span style={{ flex: 1 }}>{n.title}</span>
                {isOverdue && <span style={{ fontSize: 11, color: '#ef4444', background: '#fee2e2', padding: '1px 6px', borderRadius: 8 }}>Vencida</span>}
                {n.dueDate && !isOverdue && <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{formatDate(n.dueDate)}</span>}
              </div>
            );
          })}
          {apptTasks.slice(0, 5).map(a => {
            const isToday = a.date === new Date().toISOString().slice(0,10);
            return (
              <div key={`appt-${a.id}`} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#6366f1' }}>●</span>
                <span style={{ flex: 1 }}>
                  🗓 {a.service?.name || a.description || 'Turno'}
                  {a.client?.name ? ` — ${a.client.name}` : ''}
                </span>
                {isToday
                  ? <span style={{ fontSize: 11, color: '#fff', background: '#6366f1', padding: '1px 6px', borderRadius: 8 }}>Hoy{a.startTime ? ' ' + a.startTime : ''}</span>
                  : <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{a.date}{a.startTime ? ' ' + a.startTime : ''}</span>
                }
              </div>
            );
          })}
        </div>
      )}

      {/* Próximos vencimientos */}
      {data.upcomingDueDates?.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>Próximos vencimientos</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Cliente</th><th>Actividad</th><th>Vence</th><th>Monto</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {data.upcomingDueDates.map(e => (
                  <tr key={e.id}>
                    <td><Link to={`/clientes/${e.clientId}`}>{e.client.name}</Link></td>
                    <td>{e.activity?.name || '-'}</td>
                    <td>{formatDate(e.dueDate)}</td>
                    <td>{formatMoney(e.amountDue)}</td>
                    <td><span className={`pill pill-${e.paymentStatus}`}>{{ paid:'Pagado', pending:'Pendiente', overdue:'Vencido' }[e.paymentStatus]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customize modal */}
      {showCustomize && (
        <CustomizePanel
          selected={activeWidgets}
          onChange={handleWidgetChange}
          onClose={() => setShowCustomize(false)}
        />
      )}
    </div>
  );
}
