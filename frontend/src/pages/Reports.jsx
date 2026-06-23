import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../api/client';
import { useSectionPerms } from '../config/permissions';

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
function fmt(n) { return '$' + Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0 }); }
function pct(n) { return (n == null ? '—' : n + '%'); }
function today() { return new Date().toISOString().slice(0, 10); }
function monthsAgo(n) {
  const d = new Date(); d.setMonth(d.getMonth() - n); d.setDate(1);
  return d.toISOString().slice(0, 10);
}

// ── Shared DateRange bar ──────────────────────────────────────────────────────
function DateBar({ months, setMonths, useCustom, setUseCustom, from, setFrom, to, setTo, onApply }) {
  return (
    <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:20 }}>
      {!useCustom ? (
        <select value={months} onChange={(e) => { setMonths(Number(e.target.value)); onApply(); }}
          style={{ padding:'6px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:14 }}>
          <option value={1}>Último mes</option>
          <option value={3}>Últimos 3 meses</option>
          <option value={6}>Últimos 6 meses</option>
          <option value={12}>Últimos 12 meses</option>
        </select>
      ) : (
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--border)', fontSize:13 }} />
          <span style={{ color:'var(--ink-soft)' }}>→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--border)', fontSize:13 }} />
          <button className="btn btn-primary" onClick={onApply} style={{ fontSize:13 }}>Ver</button>
        </div>
      )}
      <button className="btn btn-secondary" onClick={() => { setUseCustom(!useCustom); }}
        style={{ fontSize:13 }}>
        {useCustom ? '← Período' : '📅 Rango personalizado'}
      </button>
    </div>
  );
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────
function BarChart({ data }) {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.flatMap((d) => [d.income||0, d.expenses||0]), 1);
  const W=680, H=220, PAD=48, barW=16, gap=6;
  const groupW = barW*2+gap;
  const chartW = Math.max(W, data.length*(groupW+24)+PAD*2);
  const scaleY = (v) => PAD + (H-PAD*2)*(1-v/maxVal);

  return (
    <svg viewBox={`0 0 ${chartW} ${H+40}`} style={{ width:'100%', maxHeight:280 }}>
      {[0,0.25,0.5,0.75,1].map((t) => {
        const y = scaleY(t*maxVal);
        return (
          <g key={t}>
            <line x1={PAD} y1={y} x2={chartW-PAD} y2={y} stroke="#e5e7eb" strokeWidth="1" />
            <text x={PAD-6} y={y+4} textAnchor="end" fontSize="10" fill="#9ca3af">{fmt(t*maxVal)}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const x = PAD + i*(groupW+24)+12;
        const can = useSectionPerms('reportes');
  const [yr, mo] = d.month.split('-');
        const label = MONTH_NAMES[parseInt(mo)-1]+' '+yr.slice(2);
        return (
          <g key={d.month}>
            <rect x={x} y={scaleY(d.income||0)} width={barW} height={(H-PAD)-scaleY(d.income||0)} fill="#10b981" rx="3" />
            <rect x={x+barW+gap} y={scaleY(d.expenses||0)} width={barW} height={(H-PAD)-scaleY(d.expenses||0)} fill="#ef4444" rx="3" />
            <text x={x+barW+gap/2} y={H+14} textAnchor="middle" fontSize="10" fill="#6b7280">{label}</text>
          </g>
        );
      })}
      <rect x={PAD} y={H+24} width={10} height={10} fill="#10b981" rx="2" />
      <text x={PAD+14} y={H+33} fontSize="11" fill="#374151">Ingresos</text>
      <rect x={PAD+80} y={H+24} width={10} height={10} fill="#ef4444" rx="2" />
      <text x={PAD+94} y={H+33} fontSize="11" fill="#374151">Gastos</text>
    </svg>
  );
}

// ── Donut Chart ───────────────────────────────────────────────────────────────
function DonutChart({ data }) {
  if (!data || data.length === 0) return null;
  const total = data.reduce((s,d) => s+d.total, 0);
  const COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#ec4899','#8b5cf6','#14b8a6'];
  const cx=100, cy=100, r=80, innerR=50;
  let angle = -Math.PI/2;
  const slices = data.slice(0,8).map((d,i) => {
    const sweep = (d.total/total)*2*Math.PI;
    const x1=cx+r*Math.cos(angle), y1=cy+r*Math.sin(angle);
    angle += sweep;
    const x2=cx+r*Math.cos(angle), y2=cy+r*Math.sin(angle);
    const ix1=cx+innerR*Math.cos(angle-sweep), iy1=cy+innerR*Math.sin(angle-sweep);
    const ix2=cx+innerR*Math.cos(angle), iy2=cy+innerR*Math.sin(angle);
    const large = sweep>Math.PI?1:0;
    return { path:`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${large} 0 ${ix1} ${iy1} Z`, color:COLORS[i%COLORS.length], label:d.category||d.name, pct:((d.total/total)*100).toFixed(1), total:d.total };
  });
  return (
    <div className="donut-flex" style={{ display:'flex', alignItems:'center', gap:24, flexWrap:'wrap' }}>
      <svg viewBox="0 0 200 200" style={{ width:160, flexShrink:0 }}>
        {slices.map((s,i) => <path key={i} d={s.path} fill={s.color} />)}
        <text x={cx} y={cy-6} textAnchor="middle" fontSize="12" fill="#374151" fontWeight="600">Total</text>
        <text x={cx} y={cy+10} textAnchor="middle" fontSize="10" fill="#6b7280">{fmt(total)}</text>
      </svg>
      <div style={{ flex:1 }}>
        {slices.map((s,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <div style={{ width:10, height:10, borderRadius:2, background:s.color, flexShrink:0 }} />
            <span style={{ fontSize:13, flex:1 }}>{s.label}</span>
            <span style={{ fontSize:13, color:'var(--ink-soft)' }}>{s.pct}%</span>
            <span style={{ fontSize:13, fontWeight:600, minWidth:70, textAlign:'right' }}>{fmt(s.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Retention sparkline ───────────────────────────────────────────────────────
function RetentionLine({ data }) {
  if (!data || data.length < 2) return null;
  const vals = data.map(d => d.retentionRate ?? 0);
  const maxV = Math.max(...vals, 1);
  const W=400, H=100, PAD=30;
  const xs = data.map((_, i) => PAD + i*((W-PAD*2)/(data.length-1)));
  const ys = vals.map(v => PAD + (H-PAD*2)*(1-v/Math.max(maxV,100)));
  const points = xs.map((x,i) => `${x},${ys[i]}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H+30}`} style={{ width:'100%', maxHeight:140 }}>
      {[0,50,100].map(v => {
        const y = PAD + (H-PAD*2)*(1-v/100);
        return <g key={v}>
          <line x1={PAD} y1={y} x2={W-PAD} y2={y} stroke="#e5e7eb" strokeWidth="1" />
          <text x={PAD-4} y={y+4} textAnchor="end" fontSize="10" fill="#9ca3af">{v}%</text>
        </g>;
      })}
      <polyline points={points} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={d.month}>
          <circle cx={xs[i]} cy={ys[i]} r="4" fill="#6366f1" />
          <text x={xs[i]} y={H+20} textAnchor="middle" fontSize="9" fill="#6b7280">
            {MONTH_NAMES[parseInt(d.month.split('-')[1])-1]}
          </text>
          {d.retentionRate != null && (
            <text x={xs[i]} y={ys[i]-8} textAnchor="middle" fontSize="10" fill="#6366f1" fontWeight="600">
              {d.retentionRate}%
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KPICard({ label, value, color, hint, badge }) {
  return (
    <div className="card" style={{ padding:'16px 20px' }}>
      <p style={{ margin:0, fontSize:12, color:'var(--ink-soft)', marginBottom:4 }}>{label}</p>
      <p style={{ margin:0, fontSize:22, fontWeight:700, color }}>{value}</p>
      {hint && <p style={{ margin:'4px 0 0', fontSize:11, color:'var(--ink-soft)' }}>{hint}</p>}
      {badge && <span style={{ display:'inline-block', marginTop:6, padding:'2px 8px', borderRadius:12, fontSize:11, background:badge.bg, color:badge.text }}>{badge.label}</span>}
    </div>
  );
}


// ── Export utilities ──────────────────────────────────────────────────────────
function fmtRaw(n) { return Number(n || 0); }

function exportXLSX(filename, sheets) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, headers, rows }) => {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    // Column widths
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  });
  XLSX.writeFile(wb, filename + '.xlsx');
}

function exportPDF(title, subtitle, sheets) {
  const tableHTML = sheets.map(({ name, headers, rows }) => `
    <h2 style="margin:24px 0 8px;font-size:14px;color:#3D5A4C;border-bottom:2px solid #3D5A4C;padding-bottom:4px">${name}</h2>
    <table>
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c ?? '—'}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:24px;max-width:960px;margin:0 auto}
      h1{font-size:20px;color:#3D5A4C;margin:0 0 4px}
      .sub{font-size:12px;color:#6b7280;margin:0 0 20px}
      table{width:100%;border-collapse:collapse;margin-bottom:8px;font-size:11px}
      th{background:#3D5A4C;color:#fff;padding:6px 8px;text-align:left;font-weight:600}
      td{padding:5px 8px;border-bottom:1px solid #e5e7eb}
      tr:nth-child(even) td{background:#f9fafb}
      .footer{margin-top:24px;font-size:10px;color:#9ca3af;text-align:right}
      @media print{body{padding:0} .footer{position:fixed;bottom:8px;right:12px}}
    </style></head>
    <body>
      <h1>${title}</h1>
      <p class="sub">${subtitle} — Generado: ${new Date().toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'})}</p>
      ${tableHTML}
      <div class="footer">Zentric CRM</div>
    </body></html>`;
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!can.exportar) { alert('No tenés permiso para exportar.'); return; }
  if (!w) { alert('Habilitá las ventanas emergentes para exportar a PDF.'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 400);
}

// ── Export Bar ────────────────────────────────────────────────────────────────
function ExportBar({ onExcel, onPDF, disabled }) {
  return (
    <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
      <button
        onClick={onExcel} disabled={disabled}
        style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8,
          border:'1px solid #16a34a', background:'#f0fdf4', color:'#16a34a',
          fontSize:13, cursor:disabled?'not-allowed':'pointer', opacity:disabled?0.5:1, fontWeight:500 }}>
        📊 Excel
      </button>
      <button
        onClick={onPDF} disabled={disabled}
        style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8,
          border:'1px solid #dc2626', background:'#fef2f2', color:'#dc2626',
          fontSize:13, cursor:disabled?'not-allowed':'pointer', opacity:disabled?0.5:1, fontWeight:500 }}>
        📄 PDF
      </button>
    </div>
  );
}

const DAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function Reports() {
  const [activeTab, setActiveTab] = useState('resumen');
  const [months, setMonths] = useState(6);
  const [useCustom, setUseCustom] = useState(false);
  const [from, setFrom] = useState(monthsAgo(6));
  const [to, setTo] = useState(today());

  // Data states
  const [summary, setSummary] = useState(null);
  const [overdue, setOverdue] = useState(null);
  const [incomeByActivity, setIncomeByActivity] = useState(null);
  const [retention, setRetention] = useState(null);
  const [cashProj, setCashProj] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [occupancy, setOccupancy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function rangeParams() {
    return useCustom ? `from=${from}&to=${to}` : `months=${months}`;
  }

  function loadTab(tab) {
    setLoading(true);
    setError('');
    const p = rangeParams();
    const calls = {
      resumen: () => api.get(`/reports/summary?${p}`).then(r => setSummary(r.data)),
      morosos: () => api.get('/reports/overdue-detail').then(r => setOverdue(r.data)),
      actividades: () => api.get(`/reports/income-by-activity?${p}`).then(r => setIncomeByActivity(r.data)),
      retencion: () => api.get(`/reports/retention?${p}`).then(r => setRetention(r.data)),
      proyeccion: () => api.get('/reports/cash-projection').then(r => setCashProj(r.data)),
      comparativo: () => api.get('/reports/monthly-comparison').then(r => setComparison(r.data)),
      horarios: () => api.get('/reports/class-occupancy').then(r => setOccupancy(r.data)),
    };
    (calls[tab] || calls['resumen'])()
      .catch(() => setError('Error cargando reporte.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadTab(activeTab); }, [activeTab]);

  const tabStyle = (t) => ({
    padding:'8px 16px', borderRadius:20, fontSize:13, cursor:'pointer', border:'none',
    background: activeTab===t ? 'var(--primary)' : 'var(--bg)',
    color: activeTab===t ? '#fff' : 'var(--ink)',
    fontWeight: activeTab===t ? 600 : 400,
  });

  const tabs = [
    { id:'resumen', label:'📊 Resumen' },
    { id:'morosos', label:'⚠️ Morosos' },
    { id:'actividades', label:'🏋️ Por actividad' },
    { id:'retencion', label:'📈 Retención' },
    { id:'proyeccion', label:'💸 Proyección' },
    { id:'comparativo', label:'📅 Comparativo' },
    { id:'horarios', label:'🕐 Horarios' },
  ];

  const dateAffected = ['resumen','actividades','retencion','comparativo'];
  const showDateBar = dateAffected.includes(activeTab);

  // ── Export helpers per tab ─────────────────────────────────────────────────
  function getExportSheets() {
    const rangeLabel = useCustom ? `${from} → ${to}` : `Últimos ${months} meses`;
    if (activeTab === 'resumen' && summary) {
      const sheets = [];
      sheets.push({
        name: 'Mensual',
        headers: ['Mes','Ingresos','Gastos','Resultado'],
        rows: summary.monthlyData.map(d => [
          d.month, fmtRaw(d.income), fmtRaw(d.expenses), fmtRaw((d.income||0)-(d.expenses||0))
        ])
      });
      if (summary.topClients?.length) sheets.push({
        name: 'Top Clientes',
        headers: ['#','Cliente','Total'],
        rows: summary.topClients.map((c,i) => [i+1, c.name, fmtRaw(c.total)])
      });
      if (summary.topSuppliers?.length) sheets.push({
        name: 'Top Proveedores',
        headers: ['Proveedor','Operaciones','Total'],
        rows: summary.topSuppliers.map(s => [s.name, s.count, fmtRaw(s.total)])
      });
      if (summary.expensesByCategory?.length) sheets.push({
        name: 'Gastos por Categoría',
        headers: ['Categoría','Total'],
        rows: summary.expensesByCategory.map(c => [c.category, fmtRaw(c.total)])
      });
      if (summary.employees?.length) sheets.push({
        name: 'Nómina',
        headers: ['Empleado','Rol','Sueldo'],
        rows: summary.employees.map(e => [e.name, e.role, fmtRaw(e.salary)])
      });
      return { title: 'Reporte Resumen', subtitle: rangeLabel, sheets };
    }
    if (activeTab === 'morosos' && overdue) {
      return {
        title: 'Reporte de Morosos', subtitle: new Date().toLocaleDateString('es-AR'),
        sheets: [{
          name: 'Morosos',
          headers: ['Cliente','Teléfono','Actividad','Vencimiento','Días mora','Monto'],
          rows: overdue.map(m => [
            m.client.name, m.client.phone||'', m.activity,
            new Date(m.dueDate).toLocaleDateString('es-AR'),
            m.daysOverdue, fmtRaw(m.amount)
          ])
        }]
      };
    }
    if (activeTab === 'actividades' && incomeByActivity) {
      const total = incomeByActivity.reduce((s,d)=>s+d.total,0);
      return {
        title: 'Ingresos por Actividad', subtitle: rangeLabel,
        sheets: [{
          name: 'Por Actividad',
          headers: ['Actividad/Servicio','Tipo','Operaciones','Total','% del total'],
          rows: incomeByActivity.map(d => [
            d.name, d.type, d.count, fmtRaw(d.total),
            ((d.total/total)*100).toFixed(1)+'%'
          ])
        }]
      };
    }
    if (activeTab === 'retencion' && retention) {
      return {
        title: 'Reporte de Retención', subtitle: rangeLabel,
        sheets: [{
          name: 'Retención Mensual',
          headers: ['Mes','Activos inicio','Pagaron','Nuevos','Retención %'],
          rows: retention.map(d => [
            d.month, d.activeAtStart, d.paidThisMonth, d.newEnrollments,
            d.retentionRate != null ? d.retentionRate+'%' : '—'
          ])
        }]
      };
    }
    if (activeTab === 'proyeccion' && cashProj) {
      return {
        title: 'Proyección de Caja', subtitle: 'Próximos 60 días',
        sheets: [{
          name: 'Proyección Semanal',
          headers: ['Semana','Ingresos esperados','Cantidad cuotas'],
          rows: cashProj.weeks.map(w => [
            new Date(w.week+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short'}),
            fmtRaw(w.expected), w.count
          ])
        }]
      };
    }
    if (activeTab === 'comparativo' && comparison) {
      return {
        title: 'Comparativo 12 Meses', subtitle: 'Últimos 12 meses',
        sheets: [{
          name: 'Comparativo',
          headers: ['Mes','Ingresos','Gastos','Resultado','Clientes activos'],
          rows: comparison.slice(-12).map(m => [
            m.month, fmtRaw(m.income), fmtRaw(m.expenses), fmtRaw(m.result), m.activeClients
          ])
        }]
      };
    }
    if (activeTab === 'horarios' && occupancy) {
      return {
        title: 'Ocupación de Horarios', subtitle: new Date().toLocaleDateString('es-AR'),
        sheets: [{
          name: 'Horarios',
          headers: ['Actividad','Día','Hora inicio','Hora fin','Instructor','Sede','Inscriptos','Cupo','Ocupación %'],
          rows: [...occupancy].sort((a,b)=>(b.occupancyPct||0)-(a.occupancyPct||0)).map(s => [
            s.activity, DAYS[s.dayOfWeek]||s.dayOfWeek, s.startTime, s.endTime,
            s.instructor||'', s.branch||'', s.enrolled, s.capacity??'',
            s.occupancyPct != null ? s.occupancyPct+'%' : '—'
          ])
        }]
      };
    }
    return null;
  }

  function handleExportExcel() {
    const exp = getExportSheets();
    if (!exp) return;
    exportXLSX(exp.title, exp.sheets);
  }

  function handleExportPDF() {
    const exp = getExportSheets();
    if (!exp) return;
    exportPDF(exp.title, exp.subtitle, exp.sheets);
  }

  const dataReady = (
    (activeTab === 'resumen' && summary) ||
    (activeTab === 'morosos' && overdue) ||
    (activeTab === 'actividades' && incomeByActivity) ||
    (activeTab === 'retencion' && retention) ||
    (activeTab === 'proyeccion' && cashProj) ||
    (activeTab === 'comparativo' && comparison) ||
    (activeTab === 'horarios' && occupancy)
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reportes</h1>
          <p className="page-subtitle">Análisis financiero y operativo del negocio</p>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', gap:6, flexWrap:'nowrap', marginBottom:20, overflowX:'auto', paddingBottom:6, scrollbarWidth:'none', WebkitOverflowScrolling:'touch' }}>
        {tabs.map(t => <button key={t.id} style={{...tabStyle(t.id), flexShrink:0, whiteSpace:'nowrap'}} onClick={() => setActiveTab(t.id)}>{t.label}</button>)}
      </div>

      {/* Date filter — only for date-sensitive tabs */}
      {showDateBar && (
        <DateBar months={months} setMonths={setMonths} useCustom={useCustom} setUseCustom={setUseCustom}
          from={from} setFrom={setFrom} to={to} setTo={setTo} onApply={() => loadTab(activeTab)} />
      )}

      {/* Export bar */}
      {!loading && !error && dataReady && (
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
          <ExportBar onExcel={handleExportExcel} onPDF={handleExportPDF} disabled={!dataReady} />
        </div>
      )}

      {loading ? <p>Calculando...</p> : error ? <div className="error-banner">{error}</div> : (
        <>
          {/* ── RESUMEN ── */}
          {activeTab === 'resumen' && summary && <ResumenTab data={summary} />}

          {/* ── MOROSOS ── */}
          {activeTab === 'morosos' && overdue && <MorosTab data={overdue} />}

          {/* ── POR ACTIVIDAD ── */}
          {activeTab === 'actividades' && incomeByActivity && <ActividadTab data={incomeByActivity} />}

          {/* ── RETENCIÓN ── */}
          {activeTab === 'retencion' && retention && <RetencionTab data={retention} />}

          {/* ── PROYECCIÓN ── */}
          {activeTab === 'proyeccion' && cashProj && <ProyeccionTab data={cashProj} />}

          {/* ── COMPARATIVO ── */}
          {activeTab === 'comparativo' && comparison && <ComparativoTab data={comparison} />}

          {/* ── HORARIOS ── */}
          {activeTab === 'horarios' && occupancy && <HorariosTab data={occupancy} />}
        </>
      )}
    </div>
  );
}

// ─── TAB COMPONENTS ───────────────────────────────────────────────────────────

function ResumenTab({ data }) {
  const totalIncome   = data.monthlyData.reduce((s,d)=>s+d.income,0);
  const totalExpenses = data.monthlyData.reduce((s,d)=>s+d.expenses,0);
  const balance = totalIncome - totalExpenses;
  return (
    <>
      <div className="report-kpi-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:16, marginBottom:24 }}>
        <KPICard label="Ingresos totales" value={fmt(totalIncome)} color="#10b981" />
        <KPICard label="Gastos totales"   value={fmt(totalExpenses)} color="#ef4444" />
        <KPICard label="Resultado"        value={fmt(balance)} color={balance>=0?'#10b981':'#ef4444'} hint="Ingresos − Gastos" />
        <KPICard label="Costo nómina/mes" value={fmt(data.totalSalaries)} color="#6366f1" hint="Solo informativo" />
        {data.overdueCount > 0 && <KPICard label="Cuotas vencidas" value={data.overdueCount} color="#f59e0b" />}
      </div>

      <div className="card barchart-wrap" style={{ marginBottom:20 }}>
        <h3 style={{ marginBottom:16 }}>Ingresos vs Gastos por mes</h3>
        <BarChart data={data.monthlyData} />
      </div>

      <div className="two-col-grid" style={{ gap:20, marginBottom:20 }}>
        <div className="card">
          <h3 style={{ marginBottom:16 }}>Gastos por categoría</h3>
          {data.expensesByCategory.length === 0
            ? <p style={{ color:'var(--ink-soft)' }}>Sin gastos registrados</p>
            : <DonutChart data={data.expensesByCategory} />}
        </div>
        <div className="card">
          <h3 style={{ marginBottom:16 }}>Top clientes</h3>
          {data.topClients.length === 0
            ? <p style={{ color:'var(--ink-soft)' }}>Sin pagos registrados</p>
            : <div className="table-wrap"><table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
                <thead><tr>
                  <th style={{ textAlign:'left', paddingBottom:8, color:'var(--ink-soft)', fontWeight:500 }}>#</th>
                  <th style={{ textAlign:'left', paddingBottom:8, color:'var(--ink-soft)', fontWeight:500 }}>Cliente</th>
                  <th style={{ textAlign:'right', paddingBottom:8, color:'var(--ink-soft)', fontWeight:500 }}>Total</th>
                </tr></thead>
                <tbody>{data.topClients.map((c,i) => (
                  <tr key={c.name} style={{ borderTop:'1px solid var(--border)' }}>
                    <td style={{ padding:'8px 0', color:'var(--ink-soft)' }}>{i+1}</td>
                    <td style={{ padding:'8px 0' }}>{c.name}</td>
                    <td style={{ padding:'8px 0', textAlign:'right', fontWeight:600 }}>{fmt(c.total)}</td>
                  </tr>
                ))}</tbody>
              </table></div>}
        </div>
      </div>

      {data.topSuppliers && data.topSuppliers.length > 0 && (
        <div className="card" style={{ marginBottom:20 }}>
          <h3 style={{ marginBottom:16 }}>Top proveedores por gasto</h3>
          <div className="table-wrap"><table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
            <thead><tr>
              <th style={{ textAlign:'left', paddingBottom:8, color:'var(--ink-soft)', fontWeight:500 }}>Proveedor</th>
              <th style={{ textAlign:'right', paddingBottom:8, color:'var(--ink-soft)', fontWeight:500 }}>Operaciones</th>
              <th style={{ textAlign:'right', paddingBottom:8, color:'var(--ink-soft)', fontWeight:500 }}>Total</th>
            </tr></thead>
            <tbody>{data.topSuppliers.map((s,i) => (
              <tr key={s.name} style={{ borderTop:'1px solid var(--border)' }}>
                <td style={{ padding:'8px 0' }}><strong>{s.name}</strong></td>
                <td style={{ padding:'8px 0', textAlign:'right', color:'var(--ink-soft)' }}>{s.count}</td>
                <td style={{ padding:'8px 0', textAlign:'right', fontWeight:600, color:'#dc2626' }}>{fmt(s.total)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      )}

      {data.employees.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom:16 }}>Nómina activa</h3>
          <div className="table-wrap"><table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
            <thead><tr>
              <th style={{ textAlign:'left', paddingBottom:8, color:'var(--ink-soft)', fontWeight:500 }}>Empleado</th>
              <th style={{ textAlign:'left', paddingBottom:8, color:'var(--ink-soft)', fontWeight:500 }}>Rol</th>
              <th style={{ textAlign:'right', paddingBottom:8, color:'var(--ink-soft)', fontWeight:500 }}>Sueldo</th>
            </tr></thead>
            <tbody>
              {data.employees.map((e) => (
                <tr key={e.name} style={{ borderTop:'1px solid var(--border)' }}>
                  <td style={{ padding:'8px 0' }}>{e.name}</td>
                  <td style={{ padding:'8px 0', color:'var(--ink-soft)' }}>{e.role}</td>
                  <td style={{ padding:'8px 0', textAlign:'right', fontWeight:600 }}>{e.salary ? fmt(e.salary) : '—'}</td>
                </tr>
              ))}
              <tr style={{ borderTop:'2px solid #e5e7eb' }}>
                <td colSpan={2} style={{ padding:'8px 0', fontWeight:600 }}>Total nómina</td>
                <td style={{ padding:'8px 0', textAlign:'right', fontWeight:700, color:'#6366f1' }}>{fmt(data.totalSalaries)}</td>
              </tr>
            </tbody>
          </table></div>
        </div>
      )}
    </>
  );
}

function MorosTab({ data }) {
  const total = data.reduce((s,m) => s+m.amount, 0);
  if (data.length === 0) return (
    <div className="card"><div className="empty-state"><h3>🎉 Sin morosos</h3><p>Todos los clientes están al día.</p></div></div>
  );
  return (
    <>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:16, marginBottom:20 }}>
        <KPICard label="Clientes morosos" value={data.length} color="#f59e0b" />
        <KPICard label="Monto total vencido" value={fmt(total)} color="#ef4444" />
        <KPICard label="Mora promedio" value={Math.round(data.reduce((s,m)=>s+m.daysOverdue,0)/data.length)+' días'} color="#6b7280" />
      </div>
      <div className="card">
        <div className="table-wrap"><table className="table">
          <thead><tr>
            <th>Cliente</th><th>Actividad</th><th>Vencimiento</th><th>Días mora</th><th style={{ textAlign:'right' }}>Monto</th><th>Teléfono</th>
          </tr></thead>
          <tbody>{data.map((m) => (
            <tr key={m.cuotaId} style={{ borderTop:'1px solid var(--border)' }}>
              <td style={{ padding:'10px 8px' }}><strong>{m.client.name}</strong></td>
              <td style={{ padding:'10px 8px', color:'var(--ink-soft)' }}>{m.activity}</td>
              <td style={{ padding:'10px 8px' }}>{new Date(m.dueDate).toLocaleDateString('es-AR')}</td>
              <td style={{ padding:'10px 8px' }}>
                <span style={{ padding:'2px 8px', borderRadius:12, fontSize:12,
                  background: m.daysOverdue>30?'#fee2e2':m.daysOverdue>14?'#fef3c7':'#fef9c3',
                  color: m.daysOverdue>30?'#dc2626':m.daysOverdue>14?'#d97706':'#ca8a04' }}>
                  {m.daysOverdue}d
                </span>
              </td>
              <td style={{ padding:'10px 8px', textAlign:'right', fontWeight:600, color:'#dc2626' }}>{fmt(m.amount)}</td>
              <td style={{ padding:'10px 8px' }}>
                {m.client.phone
                  ? <a href={`https://wa.me/${m.client.phone.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                      style={{ color:'#25d366', textDecoration:'none', fontSize:13 }}>WhatsApp →</a>
                  : <span style={{ color:'var(--ink-soft)', fontSize:12 }}>—</span>}
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
    </>
  );
}

function ActividadTab({ data }) {
  const total = data.reduce((s,d)=>s+d.total,0);
  if (data.length === 0) return (
    <div className="card"><div className="empty-state"><h3>Sin datos</h3><p>No hay pagos registrados en el período.</p></div></div>
  );
  const donutData = data.slice(0,8).map(d=>({ category:d.name, total:d.total }));
  return (
    <>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:16, marginBottom:20 }}>
        <KPICard label="Ingresos totales" value={fmt(total)} color="#10b981" />
        <KPICard label="Fuentes activas" value={data.length} color="#6366f1" />
        <KPICard label="Mayor fuente" value={data[0]?.name||'—'} color="#f59e0b" hint={fmt(data[0]?.total)} />
      </div>
      <div className="two-col-grid" style={{ gap:20 }}>
        <div className="card">
          <h3 style={{ marginBottom:16 }}>Distribución de ingresos</h3>
          <DonutChart data={donutData} />
        </div>
        <div className="card">
          <h3 style={{ marginBottom:16 }}>Detalle por actividad/servicio</h3>
          <div className="table-wrap"><table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
            <thead><tr>
              <th style={{ textAlign:'left', paddingBottom:8, color:'var(--ink-soft)', fontWeight:500 }}>Nombre</th>
              <th style={{ textAlign:'left', paddingBottom:8, color:'var(--ink-soft)', fontWeight:500 }}>Tipo</th>
              <th style={{ textAlign:'right', paddingBottom:8, color:'var(--ink-soft)', fontWeight:500 }}>Operaciones</th>
              <th style={{ textAlign:'right', paddingBottom:8, color:'var(--ink-soft)', fontWeight:500 }}>Total</th>
              <th style={{ textAlign:'right', paddingBottom:8, color:'var(--ink-soft)', fontWeight:500 }}>% del total</th>
            </tr></thead>
            <tbody>{data.map((d,i) => (
              <tr key={i} style={{ borderTop:'1px solid var(--border)' }}>
                <td style={{ padding:'8px 0' }}><strong>{d.name}</strong></td>
                <td style={{ padding:'8px 0' }}>
                  <span style={{ padding:'2px 8px', borderRadius:12, fontSize:11,
                    background: d.type==='Actividad'?'#ede9fe':'#ecfdf5',
                    color: d.type==='Actividad'?'#7c3aed':'#059669' }}>{d.type}</span>
                </td>
                <td style={{ padding:'8px 0', textAlign:'right', color:'var(--ink-soft)' }}>{d.count}</td>
                <td style={{ padding:'8px 0', textAlign:'right', fontWeight:600 }}>{fmt(d.total)}</td>
                <td style={{ padding:'8px 0', textAlign:'right', color:'var(--ink-soft)' }}>{((d.total/total)*100).toFixed(1)}%</td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      </div>
    </>
  );
}

function RetencionTab({ data }) {
  const lastMonth = data[data.length-1];
  const avgRetention = Math.round(data.filter(d=>d.retentionRate!=null).reduce((s,d)=>s+(d.retentionRate||0),0) / data.filter(d=>d.retentionRate!=null).length);
  return (
    <>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:16, marginBottom:20 }}>
        <KPICard label="Retención último mes" value={pct(lastMonth?.retentionRate)} color={lastMonth?.retentionRate>=70?'#10b981':lastMonth?.retentionRate>=50?'#f59e0b':'#ef4444'} />
        <KPICard label="Retención promedio" value={pct(isNaN(avgRetention)?null:avgRetention)} color="#6366f1" />
        <KPICard label="Nuevas inscripciones" value={data.reduce((s,d)=>s+d.newEnrollments,0)} color="#10b981" hint="En el período" />
      </div>
      <div className="card" style={{ marginBottom:20 }}>
        <h3 style={{ marginBottom:16 }}>Tasa de retención mensual</h3>
        <p style={{ fontSize:13, color:'var(--ink-soft)', marginBottom:12 }}>
          Porcentaje de suscriptores activos al inicio del mes que realizaron un pago ese mes.
          <strong style={{ color:lastMonth?.retentionRate>=70?'#10b981':'#f59e0b' }}> Objetivo: ≥70%</strong>
        </p>
        <RetentionLine data={data} />
      </div>
      <div className="card">
        <h3 style={{ marginBottom:16 }}>Detalle mensual</h3>
        <div className="table-wrap"><table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
          <thead><tr>
            <th style={{ textAlign:'left', paddingBottom:8, color:'var(--ink-soft)', fontWeight:500 }}>Mes</th>
            <th style={{ textAlign:'right', paddingBottom:8, color:'var(--ink-soft)', fontWeight:500 }}>Activos inicio</th>
            <th style={{ textAlign:'right', paddingBottom:8, color:'var(--ink-soft)', fontWeight:500 }}>Pagaron</th>
            <th style={{ textAlign:'right', paddingBottom:8, color:'var(--ink-soft)', fontWeight:500 }}>Nuevos</th>
            <th style={{ textAlign:'right', paddingBottom:8, color:'var(--ink-soft)', fontWeight:500 }}>Retención</th>
          </tr></thead>
          <tbody>{data.map((d) => (
            <tr key={d.month} style={{ borderTop:'1px solid var(--border)' }}>
              <td style={{ padding:'8px 0' }}>{MONTH_NAMES[parseInt(d.month.split('-')[1])-1]} {d.month.split('-')[0]}</td>
              <td style={{ padding:'8px 0', textAlign:'right' }}>{d.activeAtStart}</td>
              <td style={{ padding:'8px 0', textAlign:'right' }}>{d.paidThisMonth}</td>
              <td style={{ padding:'8px 0', textAlign:'right', color:'#10b981', fontWeight:600 }}>+{d.newEnrollments}</td>
              <td style={{ padding:'8px 0', textAlign:'right' }}>
                {d.retentionRate != null ? (
                  <span style={{ padding:'2px 8px', borderRadius:12, fontSize:12,
                    background:d.retentionRate>=70?'#d1fae5':d.retentionRate>=50?'#fef3c7':'#fee2e2',
                    color:d.retentionRate>=70?'#059669':d.retentionRate>=50?'#d97706':'#dc2626',
                    fontWeight:600 }}>{d.retentionRate}%</span>
                ) : '—'}
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
    </>
  );
}

function ProyeccionTab({ data }) {
  const barMax = Math.max(...data.weeks.map(w=>w.expected), 1);
  return (
    <>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:16, marginBottom:20 }}>
        <KPICard label="Esperado próx. 60d" value={fmt(data.totalExpected)} color="#10b981" hint="Cuotas pendientes de pago" />
        <KPICard label="Cuotas vencidas" value={data.overdueCount} color="#ef4444" hint="Ya deberían haberse cobrado" />
        <KPICard label="Cobrado (últimos 30d)" value={fmt(data.lastMonthCollected)} color="#6366f1" />
        <KPICard label="Gastos (últimos 30d)" value={fmt(data.lastMonthExpenses)} color="#f59e0b" />
      </div>
      <div className="card">
        <h3 style={{ marginBottom:16 }}>Ingresos esperados por semana</h3>
        <p style={{ fontSize:13, color:'var(--ink-soft)', marginBottom:16 }}>
          Basado en cuotas pendientes y vencidas con fecha de vencimiento en los próximos 60 días.
        </p>
        {data.weeks.length === 0 ? (
          <p style={{ color:'var(--ink-soft)' }}>No hay cuotas pendientes en los próximos 60 días.</p>
        ) : (
          <div>
            {data.weeks.map((w) => (
              <div key={w.week} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                <span style={{ fontSize:12, color:'var(--ink-soft)', minWidth:80 }}>{new Date(w.week+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short'})}</span>
                <div style={{ flex:1, background:'var(--bg)', borderRadius:8, height:28, position:'relative', overflow:'hidden' }}>
                  <div style={{ width:`${(w.expected/barMax)*100}%`, height:'100%', background:'#10b981', borderRadius:8, minWidth:4 }} />
                  <span style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', fontSize:12, fontWeight:600, color:'#374151' }}>{fmt(w.expected)}</span>
                </div>
                <span style={{ fontSize:11, color:'var(--ink-soft)', minWidth:50, textAlign:'right' }}>{w.count} cuota{w.count!==1?'s':''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ComparativoTab({ data }) {
  const months12 = data.slice(-12);
  return (
    <>
      <p style={{ fontSize:13, color:'var(--ink-soft)', marginBottom:16 }}>Comparativo de los últimos 12 meses — sin filtro de fecha.</p>
      <div className="card" style={{ marginBottom:20 }}>
        <h3 style={{ marginBottom:16 }}>Ingresos vs Gastos — 12 meses</h3>
        <BarChart data={months12} />
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="comparativo-table" style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead style={{ position:'sticky', top:0, background:'var(--surface)' }}>
              <tr>
                <th style={{ textAlign:'left', padding:'8px', color:'var(--ink-soft)', fontWeight:500 }}>Mes</th>
                <th style={{ textAlign:'right', padding:'8px', color:'var(--ink-soft)', fontWeight:500 }}>Ingresos</th>
                <th style={{ textAlign:'right', padding:'8px', color:'var(--ink-soft)', fontWeight:500 }}>Gastos</th>
                <th style={{ textAlign:'right', padding:'8px', color:'var(--ink-soft)', fontWeight:500 }}>Resultado</th>
                <th style={{ textAlign:'right', padding:'8px', color:'var(--ink-soft)', fontWeight:500 }}>Clientes activos</th>
              </tr>
            </thead>
            <tbody>
              {months12.map((m) => (
                <tr key={m.month} style={{ borderTop:'1px solid var(--border)' }}>
                  <td style={{ padding:'8px', fontWeight:600 }}>{MONTH_NAMES[parseInt(m.month.split('-')[1])-1]} {m.month.split('-')[0]}</td>
                  <td style={{ padding:'8px', textAlign:'right', color:'#10b981', fontWeight:600 }}>{fmt(m.income)}</td>
                  <td style={{ padding:'8px', textAlign:'right', color:'#ef4444' }}>{fmt(m.expenses)}</td>
                  <td style={{ padding:'8px', textAlign:'right', fontWeight:700, color:m.result>=0?'#10b981':'#ef4444' }}>{fmt(m.result)}</td>
                  <td style={{ padding:'8px', textAlign:'right', color:'var(--ink-soft)' }}>{m.activeClients}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function HorariosTab({ data }) {
  if (data.length === 0) return (
    <div className="card"><div className="empty-state"><h3>Sin horarios</h3><p>Configurá horarios en la sección de actividades para ver la ocupación.</p></div></div>
  );
  const sorted = [...data].sort((a,b) => (b.occupancyPct||0)-(a.occupancyPct||0));
  return (
    <>
      <div className="card">
        <h3 style={{ marginBottom:16 }}>Ocupación por clase/horario</h3>
        <div className="table-wrap"><table className="table">
          <thead><tr>
            <th>Actividad</th><th>Día</th><th>Horario</th><th>Instructor</th><th>Sede</th>
            <th style={{ textAlign:'right' }}>Inscriptos</th><th style={{ textAlign:'right' }}>Cupo</th><th style={{ textAlign:'right' }}>Ocupación</th>
          </tr></thead>
          <tbody>{sorted.map((s) => {
            const occ = s.occupancyPct;
            return (
              <tr key={s.id} style={{ borderTop:'1px solid var(--border)' }}>
                <td style={{ padding:'10px 8px' }}><strong>{s.activity}</strong></td>
                <td style={{ padding:'10px 8px' }}>{DAYS[s.dayOfWeek] || s.dayOfWeek}</td>
                <td style={{ padding:'10px 8px', color:'var(--ink-soft)' }}>{s.startTime}–{s.endTime}</td>
                <td style={{ padding:'10px 8px', color:'var(--ink-soft)' }}>{s.instructor || '—'}</td>
                <td style={{ padding:'10px 8px', color:'var(--ink-soft)' }}>{s.branch || '—'}</td>
                <td style={{ padding:'10px 8px', textAlign:'right', fontWeight:600 }}>{s.enrolled}</td>
                <td style={{ padding:'10px 8px', textAlign:'right', color:'var(--ink-soft)' }}>{s.capacity ?? '—'}</td>
                <td style={{ padding:'10px 8px', textAlign:'right' }}>
                  {occ != null ? (
                    <span style={{ padding:'2px 10px', borderRadius:12, fontSize:12, fontWeight:600,
                      background:occ>=80?'#fee2e2':occ>=50?'#fef3c7':'#d1fae5',
                      color:occ>=80?'#dc2626':occ>=50?'#d97706':'#059669' }}>{occ}%</span>
                  ) : '—'}
                </td>
              </tr>
            );
          })}</tbody>
        </table></div>
      </div>
    </>
  );
}
