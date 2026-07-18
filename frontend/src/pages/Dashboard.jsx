import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import AuthImage from '../components/AuthImage';

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
function fmt(n) { return '$' + Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function saludo() { const h = new Date().getHours(); return h < 12 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches'; }
function fmtChange(curr, prev) {
  if (!prev || prev === 0) return null;
  const delta = ((curr - prev) / prev) * 100;
  return { value: Math.abs(delta).toFixed(1), up: delta >= 0 };
}

// ── Inline Sparkline ──────────────────────────────────────────────────────────
function Sparkline({ data, field, color }) {
  if (!data || data.length < 2) return null;
  const vals = data.map(d => d[field] || 0);
  const max = Math.max(...vals, 1);
  const W = 80, H = 32;
  const pts = vals.map((v, i) => `${(i / (vals.length-1)) * W},${H - (v/max)*H}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:W, height:H }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

// ── Big KPI Card ──────────────────────────────────────────────────────────────
function BigKPI({ label, value, color, sparkData, sparkField, change, hint, icon }) {
  return (
    <div className="card dash-card" style={{ padding:'18px 20px', position:'relative', overflow:'hidden', borderTop:`3px solid ${color}` }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        {icon && <span style={{ width:38, height:38, borderRadius:10, background:color+'1a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:19 }}>{icon}</span>}
        {change && (
          <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:20, background:(change.up?'#10b981':'#ef4444')+'18', color: change.up ? '#10b981' : '#ef4444' }}>
            {change.up ? '↑' : '↓'} {change.value}%
          </span>
        )}
      </div>
      <p style={{ margin:0, fontSize:11, color:'var(--ink-soft)', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:600 }}>{label}</p>
      <p style={{ margin:'4px 0 0', fontSize:26, fontWeight:800, color, lineHeight:1.05 }}>{value}</p>
      {hint && <p style={{ margin:'6px 0 0', fontSize:12, color:'var(--ink-soft)' }}>{hint}</p>}
      {sparkData && <div style={{ marginTop:10 }}><Sparkline data={sparkData} field={sparkField} color={color} /></div>}
    </div>
  );
}

// ── Donut ─────────────────────────────────────────────────────────────────────
function Donut({ paid, pending, overdue }) {
  const total = paid + pending + overdue;
  if (total === 0) return <p style={{ color:'var(--ink-soft)', textAlign:'center' }}>Sin inscripciones activas</p>;
  const COLORS = { paid:'#10b981', pending:'#f59e0b', overdue:'#ef4444' };
  const labels = { paid:'Al día', pending:'Pendientes', overdue:'Vencidas' };
  const cx=90, cy=90, r=70, innerR=44;
  let angle = -Math.PI/2;
  const slices = [
    { key:'paid', val:paid },
    { key:'pending', val:pending },
    { key:'overdue', val:overdue },
  ].filter(s=>s.val>0).map(s => {
    const sweep = (s.val/total)*2*Math.PI;
    const x1=cx+r*Math.cos(angle), y1=cy+r*Math.sin(angle);
    angle+=sweep;
    const x2=cx+r*Math.cos(angle), y2=cy+r*Math.sin(angle);
    const ix1=cx+innerR*Math.cos(angle-sweep), iy1=cy+innerR*Math.sin(angle-sweep);
    const ix2=cx+innerR*Math.cos(angle), iy2=cy+innerR*Math.sin(angle);
    const large=sweep>Math.PI?1:0;
    return { ...s, path:`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${large} 0 ${ix1} ${iy1} Z` };
  });
  return (
    <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
      <svg viewBox="0 0 180 180" style={{ width:140, flexShrink:0 }}>
        {slices.map(s => <path key={s.key} d={s.path} fill={COLORS[s.key]} />)}
        <text x={cx} y={cy-8} textAnchor="middle" fontSize="13" fill="#374151" fontWeight="700">{total}</text>
        <text x={cx} y={cx+8} textAnchor="middle" fontSize="11" fill="#6b7280">inscriptos</text>
      </svg>
      <div style={{ flex:1, minWidth:100 }}>
        {[['paid',paid],['pending',pending],['overdue',overdue]].map(([k,v]) => (
          <div key={k} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
            <div style={{ width:10, height:10, borderRadius:2, background:COLORS[k], flexShrink:0 }} />
            <span style={{ fontSize:13, flex:1 }}>{labels[k]}</span>
            <span style={{ fontSize:14, fontWeight:700, color:COLORS[k] }}>{v}</span>
            <span style={{ fontSize:11, color:'var(--ink-soft)' }}>{Math.round((v/total)*100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Mini bar chart ────────────────────────────────────────────────────────────
function MiniBarChart({ data }) {
  if (!data || data.length === 0) return null;
  const maxInc = Math.max(...data.map(d=>d.income||0), 1);
  const maxExp = Math.max(...data.map(d=>d.expenses||0), 1);
  const maxV = Math.max(maxInc, maxExp);
  const W=320, H=120, PAD=6, barW=12, gap=4;
  const groupW = barW*2+gap;
  const chartW = data.length*(groupW+16)+PAD*2;
  const scaleY = v => PAD+(H-PAD*2)*(1-v/maxV);
  return (
    <svg viewBox={`0 0 ${Math.max(W,chartW)} ${H+28}`} style={{ width:'100%', maxHeight:160 }}>
      {data.map((d, i) => {
        const x = PAD + i*(groupW+16)+8;
        const [yr, mo] = d.month.split('-');
        const label = MONTH_NAMES[parseInt(mo)-1];
        return (
          <g key={d.month}>
            <rect x={x} y={scaleY(d.income||0)} width={barW} height={(H-PAD)-scaleY(d.income||0)} fill="#10b981" rx="2" opacity="0.9" />
            <rect x={x+barW+gap} y={scaleY(d.expenses||0)} width={barW} height={(H-PAD)-scaleY(d.expenses||0)} fill="#ef4444" rx="2" opacity="0.9" />
            <text x={x+barW+gap/2} y={H+14} textAnchor="middle" fontSize="9" fill="#9ca3af">{label}</text>
          </g>
        );
      })}
      <rect x={PAD} y={H+18} width={8} height={8} fill="#10b981" rx="1" />
      <text x={PAD+11} y={H+26} fontSize="9" fill="#6b7280">Ing.</text>
      <rect x={PAD+36} y={H+18} width={8} height={8} fill="#ef4444" rx="1" />
      <text x={PAD+47} y={H+26} fontSize="9" fill="#6b7280">Gas.</text>
    </svg>
  );
}

// ── Horizontal bar ────────────────────────────────────────────────────────────
function HBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min((value/max)*100, 100) : 0;
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
        <span style={{ fontSize:13 }}>{label}</span>
        <span style={{ fontSize:13, fontWeight:600 }}>{fmt(value)}</span>
      </div>
      <div style={{ height:8, borderRadius:4, background:'var(--bg)', overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', borderRadius:4, background:color, transition:'width 0.4s ease' }} />
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [waConnected, setWaConnected] = useState(false);
  const [factConfigured, setFactConfigured] = useState(false);
  const [obDismissed, setObDismissed] = useState(() => { try { return localStorage.getItem('gestumio_onboarding_done') === '1'; } catch { return false; } });
  const [widgets, setWidgets] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('dash_widgets') || 'null') || defaultWidgets(); }
    catch { return defaultWidgets(); }
  });

  function defaultWidgets() {
    return { kpis:true, flujo:true, inscripciones:true, cobros:true, morosos:true, turnos:true };
  }

  function load() {
    setLoading(true);
    setError('');
    Promise.all([
      api.get('/dashboard'),
      api.get('/facturacion').catch(() => ({ data: [] })),
      api.get('/whatsapp/status').catch(() => ({ data: {} })),
      api.get('/facturacion/config').catch(() => ({ data: {} })),
    ])
      .then(([d, f, w, c]) => {
        setData(d.data);
        setInvoices(Array.isArray(f.data) ? f.data : []);
        setWaConnected(!!(w.data && w.data.connected));
        setFactConfigured(!!(c.data && c.data.configured));
      })
      .catch(() => setError('Error al cargar el dashboard'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div style={{ padding:40, textAlign:'center' }}>
      <p style={{ color:'var(--ink-soft)' }}>Calculando métricas...</p>
    </div>
  );
  if (error) return <div className="error-banner" style={{ margin:24 }}>{error}</div>;
  if (!data) return null;

  const ingresosChange = fmtChange(data.currMonth?.income, data.prevMonth?.income);
  const gastosChange   = fmtChange(data.currMonth?.expenses, data.prevMonth?.expenses);
  const balance = data.ingresosDelMes - data.gastosDelMes;

  const business = (() => { try { return JSON.parse(localStorage.getItem('business') || '{}'); } catch { return {}; } })();
  const ym = new Date().toISOString().slice(0, 7);
  const issuedInv = invoices.filter(i => i.status === 'issued');
  const mesInv = issuedInv.filter(i => String(i.createdAt || '').slice(0, 7) === ym);
  const facturadoMes = mesInv.reduce((s, i) => s + (i.total || 0), 0);
  const ivaMes = mesInv.reduce((s, i) => s + (i.iva || 0), 0);
  const ultimasInv = issuedInv.slice(0, 5);
  const resumenHero = `Este mes facturaste ${fmt(facturadoMes)} · ${data.overdue.count} vencidas · ${data.pending.count} por cobrar`;

  const onbSteps = [
    { done: (data.activitiesCount || 0) > 0, label: 'Cargá tu primera actividad o servicio', to: '/actividades' },
    { done: (data.clientsCount || 0) > 0,    label: 'Sumá tu primer cliente', to: '/clientes' },
    { done: (data.ingresosDelMes || 0) > 0 || (data.pending?.count || 0) > 0 || (data.overdue?.count || 0) > 0, label: 'Registrá tu primer cobro', to: '/cobranza' },
    { done: waConnected, label: 'Conectá tu WhatsApp para recordatorios', to: '/ajustes' },
    { done: factConfigured, label: 'Configurá la facturación (opcional)', to: '/comprobantes', optional: true },
  ];
  const obRequiredDone = onbSteps.filter(s => !s.optional).every(s => s.done);
  const obCount = onbSteps.filter(s => s.done).length;
  const showOnboarding = !obDismissed && !obRequiredDone;
  function dismissOnboarding() { try { localStorage.setItem('gestumio_onboarding_done', '1'); } catch {} setObDismissed(true); }

  const maxOverdueAmt = Math.max(...(data.upcomingDueDates?.filter(d=>d.paymentStatus==='overdue').map(d=>d.amountDue)||[]),1);
  const overdueList = data.upcomingDueDates?.filter(d=>d.paymentStatus==='overdue').slice(0,5) || [];
  const pendingList = data.upcomingDueDates?.filter(d=>d.paymentStatus==='pending').slice(0,5) || [];

  return (
    <div>
      <style>{`
        .dash-card{transition:transform .15s ease, box-shadow .15s ease;}
        .dash-card:hover{transform:translateY(-3px);box-shadow:0 10px 26px rgba(0,0,0,.09);}
        .dash-entity{transition:transform .12s ease, box-shadow .12s ease;}
        .dash-entity:hover{transform:translateY(-3px);box-shadow:0 8px 20px rgba(0,0,0,.09);}
      `}</style>
      <div style={{ borderRadius:16, padding:'22px 26px', marginBottom:20, background:'linear-gradient(135deg,#12833b 0%,#1BA84C 55%,#37c96c 100%)', color:'#fff', display:'flex', alignItems:'center', gap:18, boxShadow:'0 10px 28px rgba(27,168,76,.28)', flexWrap:'wrap' }}>
        <div style={{ width:60, height:60, borderRadius:14, background:'rgba(255,255,255,.18)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 }}>
          <AuthImage path="/business/logo" alt="logo" style={{ width:'100%', height:'100%', objectFit:'cover' }} fallback={<span style={{ fontSize:28 }}>🏪</span>} />
        </div>
        <div style={{ flex:1, minWidth:180 }}>
          <p style={{ margin:0, fontSize:13, opacity:.9 }}>{saludo()} 👋</p>
          <h1 style={{ margin:'2px 0 0', fontSize:24, fontWeight:800, color:'#fff' }}>{business.name || 'Tu negocio'}</h1>
          <p style={{ margin:'6px 0 0', fontSize:13, opacity:.92 }}>{resumenHero}</p>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8 }}>
          <span style={{ fontSize:13, opacity:.9, textTransform:'capitalize' }}>{new Date().toLocaleDateString('es-AR',{ weekday:'long', day:'numeric', month:'long' })}</span>
          <button className="btn" onClick={load} style={{ fontSize:12, background:'rgba(255,255,255,.2)', color:'#fff', border:'none' }}>↻ Actualizar</button>
        </div>
      </div>

      {showOnboarding && (
        <div className="card" style={{ marginBottom:20, border:'1px solid #bbf7d0', background:'#f0fdf4' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <h3 style={{ margin:0 }}>🚀 Primeros pasos <span style={{ fontSize:13, fontWeight:500, color:'var(--ink-soft)' }}>({obCount}/{onbSteps.length})</span></h3>
            <button onClick={dismissOnboarding} style={{ background:'none', border:'none', color:'var(--ink-soft)', cursor:'pointer', fontSize:13 }}>Ocultar ✕</button>
          </div>
          <div style={{ height:6, borderRadius:4, background:'#dcfce7', overflow:'hidden', marginBottom:14 }}>
            <div style={{ width:`${(obCount/onbSteps.length)*100}%`, height:'100%', background:'#16a34a', transition:'width .4s ease' }} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {onbSteps.map((st, i) => (
              <Link key={i} to={st.to} style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, background: st.done ? 'transparent' : '#fff', border: st.done ? 'none' : '1px solid var(--border)' }}>
                <span style={{ width:22, height:22, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, background: st.done ? '#16a34a' : 'var(--bg)', color: st.done ? '#fff' : 'var(--ink-soft)', border: st.done ? 'none' : '1px solid var(--border)' }}>{st.done ? '✓' : (i+1)}</span>
                <span style={{ flex:1, fontSize:14, color: st.done ? 'var(--ink-soft)' : 'var(--ink)', textDecoration: st.done ? 'line-through' : 'none' }}>{st.label}</span>
                {!st.done && <span style={{ fontSize:12, color:'var(--primary)', fontWeight:600 }}>Ir →</span>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Row 1: Big KPIs ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:20 }}>
        <BigKPI
          label="Ingresos este mes"
          value={fmt(data.ingresosDelMes)}
          color="#10b981"
          icon="💰"
          sparkData={data.monthlyTrend}
          sparkField="income"
          change={ingresosChange}
        />
        <BigKPI
          label="Gastos este mes"
          value={fmt(data.gastosDelMes)}
          color="#ef4444"
          icon="💸"
          sparkData={data.monthlyTrend}
          sparkField="expenses"
          change={gastosChange ? { ...gastosChange, up: !gastosChange.up } : null}
        />
        <BigKPI
          label="Resultado del mes"
          value={fmt(balance)}
          color={balance>=0?'#10b981':'#ef4444'}
          icon="📊"
          hint={balance>=0?'Positivo ✓':'Déficit — revisá gastos'}
        />
        <BigKPI
          label="Cuotas vencidas"
          value={data.overdue.count}
          color={data.overdue.count>0?'#f59e0b':'#10b981'}
          icon="⚠️"
          hint={data.overdue.count>0 ? fmt(data.overdue.total)+' pendiente' : 'Todo al día ✓'}
        />
      </div>

      {/* ── Row 2: Entity counts ── */}
      <div className="entity-count-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))', gap:10, marginBottom:20 }}>
        {[
          { label:'Clientes activos', value:data.clientsCount, color:'#6366f1', link:'/clientes', icon:'👤' },
          { label:'Actividades',      value:data.activitiesCount, color:'#3b82f6', link:'/actividades', icon:'🏃' },
          { label:'Turnos del mes',   value:data.servicesCount, color:'#8b5cf6', link:'/agenda', icon:'📅' },
          { label:'Empleados',        value:data.employeesCount, color:'#0891b2', link:'/empleados', icon:'👥' },
          { label:'Proveedores',      value:data.suppliersCount, color:'#059669', link:'/proveedores', icon:'🏭' },
        ].map(item => (
          <Link key={item.label} to={item.link} style={{ textDecoration:'none' }}>
            <div className="card dash-entity" style={{ padding:'14px 16px', textAlign:'center', cursor:'pointer' }}>
              <span style={{ fontSize:18 }}>{item.icon}</span>
              <p style={{ margin:'2px 0 0', fontSize:26, fontWeight:800, color:item.color }}>{item.value}</p>
              <p style={{ margin:'2px 0 0', fontSize:11, color:'var(--ink-soft)' }}>{item.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Row 3: Flujo de caja + Inscripciones ── */}
      <div className="two-col-grid" style={{ gap:16, marginBottom:16 }}>
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <h3 style={{ margin:0 }}>Flujo financiero — 6 meses</h3>
            <Link to="/reportes" style={{ fontSize:12, color:'var(--primary)', textDecoration:'none' }}>Ver reportes →</Link>
          </div>
          <MiniBarChart data={data.monthlyTrend} />
        </div>

        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <h3 style={{ margin:0 }}>Estado de inscripciones</h3>
            <Link to="/cobranza" style={{ fontSize:12, color:'var(--primary)', textDecoration:'none' }}>Ver cobranza →</Link>
          </div>
          <Donut
            paid={data.enrollmentStatus.paid}
            pending={data.enrollmentStatus.pending}
            overdue={data.enrollmentStatus.overdue}
          />
        </div>
      </div>

      {/* ── Facturación del mes ── */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h3 style={{ margin:0 }}>🧾 Facturación del mes</h3>
          <Link to="/comprobantes" style={{ fontSize:12, color:'var(--primary)', textDecoration:'none' }}>Ir a facturación →</Link>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:12, marginBottom: ultimasInv.length ? 16 : 0 }}>
          <div style={{ padding:'12px 14px', background:'var(--bg)', borderRadius:10 }}>
            <p style={{ margin:0, fontSize:11, color:'var(--ink-soft)', textTransform:'uppercase', letterSpacing:'.04em' }}>Facturado</p>
            <p style={{ margin:'4px 0 0', fontSize:22, fontWeight:800, color:'#1BA84C' }}>{fmt(facturadoMes)}</p>
          </div>
          <div style={{ padding:'12px 14px', background:'var(--bg)', borderRadius:10 }}>
            <p style={{ margin:0, fontSize:11, color:'var(--ink-soft)', textTransform:'uppercase', letterSpacing:'.04em' }}>IVA débito</p>
            <p style={{ margin:'4px 0 0', fontSize:22, fontWeight:800, color:'#d97706' }}>{fmt(ivaMes)}</p>
          </div>
          <div style={{ padding:'12px 14px', background:'var(--bg)', borderRadius:10 }}>
            <p style={{ margin:0, fontSize:11, color:'var(--ink-soft)', textTransform:'uppercase', letterSpacing:'.04em' }}>Comprobantes</p>
            <p style={{ margin:'4px 0 0', fontSize:22, fontWeight:800, color:'#6366f1' }}>{mesInv.length}</p>
          </div>
        </div>
        {ultimasInv.length === 0 ? (
          <p style={{ color:'var(--ink-soft)', fontSize:13, margin:0 }}>Todavía no emitiste comprobantes. <Link to="/comprobantes" style={{ color:'var(--primary)' }}>Emitir una factura →</Link></p>
        ) : (
          <div>
            <p style={{ margin:'0 0 6px', fontSize:12, color:'var(--ink-soft)', fontWeight:600 }}>Últimos comprobantes</p>
            {ultimasInv.map(i => (
              <div key={i.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderBottom:'1px solid var(--bg)' }}>
                <span style={{ fontSize:12, fontWeight:700, color:'var(--ink-soft)', minWidth:88 }}>{String(i.tipo||'').replace('FACTURA','Fact.').replace('NOTA DE CREDITO','NC').replace('NOTA DE DEBITO','ND')} {i.puntoVenta}-{i.numero}</span>
                <span style={{ flex:1, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{i.clienteNombre || 'Consumidor Final'}</span>
                <span style={{ fontSize:13, fontWeight:700 }}>{fmt(i.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Row 4: Morosos + Pendientes ── */}
      <div className="two-col-grid" style={{ gap:20, marginBottom:20 }}>
        {/* Morosos */}
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <h3 style={{ margin:0 }}>
              Cuotas vencidas
              {data.overdue.count > 0 && (
                <span style={{ marginLeft:8, background:'#fee2e2', color:'#dc2626', fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:12 }}>
                  {data.overdue.count}
                </span>
              )}
            </h3>
            <Link to="/reportes" style={{ fontSize:12, color:'var(--primary)', textDecoration:'none' }}>Detalle →</Link>
          </div>
          {overdueList.length === 0 ? (
            <p style={{ color:'var(--ink-soft)', fontSize:13 }}>🎉 Sin cuotas vencidas</p>
          ) : (
            <>
              {overdueList.map((c) => (
                <HBar key={c.id}
                  label={`${c.client.name} · ${c.activity.name}`}
                  value={c.amountDue}
                  max={maxOverdueAmt}
                  color="#ef4444"
                />
              ))}
              {data.overdue.count > 5 && (
                <p style={{ fontSize:12, color:'var(--ink-soft)', marginTop:8 }}>+ {data.overdue.count-5} más</p>
              )}
            </>
          )}
        </div>

        {/* Próximos cobros */}
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <h3 style={{ margin:0 }}>Próximos cobros</h3>
            <Link to="/cobranza" style={{ fontSize:12, color:'var(--primary)', textDecoration:'none' }}>Ir a cobranza →</Link>
          </div>
          {pendingList.length === 0 ? (
            <p style={{ color:'var(--ink-soft)', fontSize:13 }}>Sin cobros pendientes inmediatos</p>
          ) : (
            pendingList.map((c) => {
              const due = new Date(c.dueDate);
              const today = new Date();
              const days = Math.floor((due-today)/86400000);
              return (
                <div key={c.id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                  <div style={{ width:36, height:36, borderRadius:8, background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:days<=3?'#f59e0b':'var(--ink-soft)' }}>{days}d</span>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ margin:0, fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.client.name}</p>
                    <p style={{ margin:0, fontSize:11, color:'var(--ink-soft)' }}>{c.activity.name}</p>
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color:'#6366f1', flexShrink:0 }}>{fmt(c.amountDue)}</span>
                </div>
              );
            })
          )}
          {data.pending.count > 0 && (
            <div style={{ marginTop:12, padding:'10px 14px', background:'var(--bg)', borderRadius:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:13, color:'var(--ink-soft)' }}>Total pendiente</span>
              <span style={{ fontSize:15, fontWeight:700, color:'#6366f1' }}>{fmt(data.pending.total)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 5: Turnos sin cobrar ── */}
      {data.pendingAppts.count > 0 && (
        <div className="card" style={{ marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <h3 style={{ margin:0 }}>⏳ Turnos completados sin cobrar</h3>
              <p style={{ margin:'4px 0 0', fontSize:13, color:'var(--ink-soft)' }}>
                {data.pendingAppts.count} turno{data.pendingAppts.count!==1?'s':''} sin pago confirmado — {fmt(data.pendingAppts.total)} a recuperar
              </p>
            </div>
            <Link to="/agenda" className="btn btn-primary" style={{ textDecoration:'none', fontSize:13 }}>Ver agenda →</Link>
          </div>
        </div>
      )}
    </div>
  );
}
