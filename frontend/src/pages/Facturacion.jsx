import { useEffect, useState } from 'react';
import api from '../api/client';
import { useSectionPerms } from '../config/permissions';

const fmt = (v) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(v || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-AR', { timeZone: 'UTC' }) : '-';

async function downloadInvoicePdf(id) {
  try {
    const res = await api.get(`/facturacion/${id}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noreferrer';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) { alert('No se pudo generar el PDF'); }
}

const TIPOS = ['FACTURA C', 'FACTURA B', 'FACTURA A', 'FACTURA X'];
const COND_IVA = [
  { id: 5, label: 'Consumidor Final' },
  { id: 1, label: 'Responsable Inscripto' },
  { id: 6, label: 'Responsable Monotributo' },
  { id: 4, label: 'Exento' },
];

export default function Facturacion() {
  const can = useSectionPerms('comprobantes');
  const [tab, setTab] = useState('comprobantes');
  const [invoices, setInvoices] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [inv, cfg] = await Promise.all([
        api.get('/facturacion').then(r => r.data).catch(() => []),
        api.get('/facturacion/config').then(r => r.data).catch(() => null),
      ]);
      setInvoices(Array.isArray(inv) ? inv : []);
      setConfig(cfg);
    } finally { setLoading(false); }
  }
  useEffect(() => { loadAll(); }, []);

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Facturación electrónica</h1>
          <p style={{ color: 'var(--ink-soft)', margin: '4px 0 0' }}>Facturas A, B y C directo con AFIP/ARCA. Sin costo por comprobante.</p>
        </div>
        {can.emitir && tab === 'comprobantes' && (
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>🧾 Nueva factura</button>
        )}
      </div>

      {config && !config.configured && (
        <div className="error-banner" style={{ background: '#fff7e6', borderColor: '#f0c36d', color: '#7a5b00' }}>
          Todavía no terminaste de configurar AFIP. Andá a la pestaña <strong>Configuración</strong> para cargar tus datos y el certificado.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, margin: '16px 0', borderBottom: '1px solid var(--border)' }}>
        <TabBtn active={tab === 'comprobantes'} onClick={() => setTab('comprobantes')}>Comprobantes</TabBtn>
        {can.config && <TabBtn active={tab === 'config'} onClick={() => setTab('config')}>Configuración</TabBtn>}
      </div>

      {tab === 'comprobantes' && <ComprobantesTab invoices={invoices} loading={loading} />}
      {tab === 'config' && can.config && <ConfigTab config={config} onChange={loadAll} />}

      {showNew && (
        <NuevaFacturaModal config={config} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); loadAll(); }} />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', cursor: 'pointer', padding: '10px 14px',
      fontWeight: active ? 700 : 500, color: active ? 'var(--brand)' : 'var(--ink-soft)',
      borderBottom: active ? '2px solid var(--brand)' : '2px solid transparent', marginBottom: -1,
    }}>{children}</button>
  );
}

function ComprobantesTab({ invoices, loading }) {
  if (loading) return <p style={{ color: 'var(--ink-soft)' }}>Cargando…</p>;
  if (!invoices.length) return <p style={{ color: 'var(--ink-soft)', padding: '20px 0' }}>Todavía no emitiste comprobantes.</p>;
  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <table className="table">
        <thead>
          <tr><th>Fecha</th><th>Tipo</th><th>Número</th><th>Cliente</th><th style={{ textAlign: 'right' }}>Total</th><th>CAE</th><th>Estado</th><th>PDF</th></tr>
        </thead>
        <tbody>
          {invoices.map(inv => (
            <tr key={inv.id}>
              <td>{fmtDate(inv.createdAt)}</td>
              <td>{inv.tipo}</td>
              <td>{inv.puntoVenta ? inv.puntoVenta + '-' : ''}{inv.numero || '—'}</td>
              <td>{inv.clienteNombre || '—'}</td>
              <td style={{ textAlign: 'right' }}>{fmt(inv.total)}</td>
              <td style={{ fontSize: 12 }}>{inv.cae || '—'}{inv.vencimientoCae ? ` (${inv.vencimientoCae})` : ''}</td>
              <td>{inv.status === 'issued'
                ? <span className="pill pill-paid">Autorizada</span>
                : <span className="pill pill-overdue" title={inv.errorMsg || ''}>Error</span>}</td>
              <td>{inv.status === 'issued'
                ? <button className="btn" style={{ padding: '4px 10px' }} onClick={() => downloadInvoicePdf(inv.id)}>PDF</button>
                : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConfigTab({ config, onChange }) {
  const [form, setForm] = useState(() => ({
    fiscalCuit: config?.fiscalCuit || '',
    fiscalRazonSocial: config?.fiscalRazonSocial || '',
    fiscalCondicion: config?.fiscalCondicion || 'MONOTRIBUTO',
    fiscalPuntoVenta: config?.fiscalPuntoVenta || '',
    fiscalDomicilio: config?.fiscalDomicilio || '',
    afipEnv: config?.afipEnv || 'homologacion',
  }));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const [csr, setCsr] = useState(config?.csrPem || '');
  const [certInput, setCertInput] = useState('');
  const [busy, setBusy] = useState('');
  const [testRes, setTestRes] = useState(null);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function saveDatos(e) {
    e.preventDefault(); setSaving(true); setMsg(''); setErr('');
    try { const r = await api.put('/facturacion/config', form); setMsg('Datos guardados.'); onChange(); }
    catch (e) { setErr(e.response?.data?.error || 'Error al guardar'); }
    finally { setSaving(false); }
  }
  async function genCsr() {
    setBusy('csr'); setErr(''); setMsg('');
    try { const r = await api.post('/facturacion/generate-csr'); setCsr(r.data.csrPem); setMsg('Clave y CSR generados. Descargá el CSR y subilo a AFIP.'); onChange(); }
    catch (e) { setErr(e.response?.data?.error || 'Error al generar el CSR'); }
    finally { setBusy(''); }
  }
  function downloadCsr() {
    const blob = new Blob([csr], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'gestumio.csr'; a.click(); URL.revokeObjectURL(a.href);
  }
  async function saveCert() {
    setBusy('cert'); setErr(''); setMsg('');
    try { await api.put('/facturacion/cert', { certPem: certInput }); setMsg('Certificado guardado.'); setCertInput(''); onChange(); }
    catch (e) { setErr(e.response?.data?.error || 'Error al guardar el certificado'); }
    finally { setBusy(''); }
  }
  async function test() {
    setBusy('test'); setErr(''); setMsg(''); setTestRes(null);
    try { const r = await api.post('/facturacion/test'); setTestRes(r.data); }
    catch (e) { setErr(e.response?.data?.error || 'Error de conexión'); }
    finally { setBusy(''); }
  }

  const isHomo = form.afipEnv !== 'produccion';

  return (
    <div style={{ maxWidth: 680 }}>
      {msg && <div className="success-banner" style={{ marginBottom: 12 }}>{msg}</div>}
      {err && <div className="error-banner" style={{ marginBottom: 12 }}>{err}</div>}

      <form onSubmit={saveDatos}>
        <h3 style={{ marginTop: 0 }}>1. Datos fiscales</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, minWidth: 180 }}><label>CUIT del negocio</label>
            <input value={form.fiscalCuit} onChange={set('fiscalCuit')} placeholder="20304050607" /></div>
          <div className="field" style={{ flex: 1, minWidth: 140 }}><label>Punto de venta</label>
            <input value={form.fiscalPuntoVenta} onChange={set('fiscalPuntoVenta')} placeholder="0001" /></div>
        </div>
        <div className="field"><label>Razón social</label>
          <input value={form.fiscalRazonSocial} onChange={set('fiscalRazonSocial')} placeholder="Nombre / razón social" /></div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, minWidth: 200 }}><label>Condición frente al IVA</label>
            <select value={form.fiscalCondicion} onChange={set('fiscalCondicion')}>
              <option value="MONOTRIBUTO">Monotributo (Factura C)</option>
              <option value="RI">Responsable Inscripto (Factura A/B)</option>
              <option value="EXENTO">Exento (Factura C)</option>
            </select></div>
          <div className="field" style={{ flex: 1, minWidth: 200 }}><label>Entorno AFIP</label>
            <select value={form.afipEnv} onChange={set('afipEnv')}>
              <option value="homologacion">Homologación (pruebas)</option>
              <option value="produccion">Producción (facturas reales)</option>
            </select></div>
        </div>
        <div className="field"><label>Domicilio comercial</label>
          <input value={form.fiscalDomicilio} onChange={set('fiscalDomicilio')} placeholder="Calle 123, Localidad" /></div>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar datos'}</button>
      </form>

      <h3 style={{ marginTop: 28 }}>2. Certificado digital</h3>
      <ol style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6, paddingLeft: 18 }}>
        <li>Generá tu clave y CSR con el botón de abajo, y descargá el archivo <code>gestumio.csr</code>.</li>
        <li>Entrá a AFIP con tu Clave Fiscal y subí ese CSR en{' '}
          {isHomo
            ? <><strong>WSASS</strong> (Autoservicio de homologación) para generar un certificado de prueba.</>
            : <><strong>"Administración de Certificados Digitales"</strong> para generar el certificado de producción.</>}
        </li>
        <li>Descargá el certificado (<code>.crt</code>) que te da AFIP y pegá su contenido abajo.</li>
        <li>En AFIP, en <strong>"Administrador de Relaciones de Clave Fiscal"</strong>, habilitá el servicio <strong>Facturación Electrónica (wsfe)</strong> asociando ese certificado.</li>
      </ol>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', margin: '8px 0' }}>
        <button type="button" className="btn btn-secondary" onClick={genCsr} disabled={busy === 'csr'}>
          {busy === 'csr' ? 'Generando…' : (config?.hasKey ? 'Regenerar clave + CSR' : 'Generar clave + CSR')}
        </button>
        {csr && <button type="button" className="btn" onClick={downloadCsr}>⬇ Descargar CSR</button>}
        {config?.hasKey && <span className="pill pill-paid">Clave ✓</span>}
        {config?.hasCert && <span className="pill pill-paid">Certificado ✓</span>}
      </div>
      {csr && (
        <textarea readOnly value={csr} rows={5} style={{ width: '100%', fontFamily: 'monospace', fontSize: 11, marginBottom: 12 }} />
      )}

      <div className="field"><label>Pegá acá el certificado (.crt) que te dio AFIP</label>
        <textarea value={certInput} onChange={e => setCertInput(e.target.value)} rows={5}
          placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
          style={{ width: '100%', fontFamily: 'monospace', fontSize: 11 }} /></div>
      <button type="button" className="btn btn-primary" onClick={saveCert} disabled={busy === 'cert' || !certInput.trim()}>
        {busy === 'cert' ? 'Guardando…' : 'Guardar certificado'}</button>

      <h3 style={{ marginTop: 28 }}>3. Probar conexión</h3>
      <button type="button" className="btn btn-secondary" onClick={test} disabled={busy === 'test' || !config?.configured}>
        {busy === 'test' ? 'Probando…' : 'Probar conexión con AFIP'}</button>
      {testRes && (
        <div className="success-banner" style={{ marginTop: 10 }}>
          ✅ Conexión OK ({testRes.env}). Último comprobante autorizado (Factura C, PV {testRes.ptoVta}): N° {testRes.ultimoC}.
        </div>
      )}
    </div>
  );
}

function NuevaFacturaModal({ config, onClose, onSaved }) {
  const defaultTipo = (config?.fiscalCondicion === 'RI') ? 'FACTURA B' : 'FACTURA C';
  const [tipo, setTipo] = useState(defaultTipo);
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [docNro, setDocNro] = useState('');
  const [condIva, setCondIva] = useState(5);
  const [items, setItems] = useState([{ descripcion: '', cantidad: 1, precio: '', alicuota: 21 }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(null);

  useEffect(() => {
    api.get('/clients').then(r => setClients(Array.isArray(r.data) ? r.data : (r.data?.clients || []))).catch(() => setClients([]));
  }, []);
  useEffect(() => { setCondIva(tipo === 'FACTURA A' ? 1 : 5); }, [tipo]);

  const isC = tipo === 'FACTURA C' || tipo === 'FACTURA X';
  const total = items.reduce((s, it) => {
    const base = (Number(it.precio) || 0) * (Number(it.cantidad) || 1);
    const iva = isC ? 0 : base * ((Number(it.alicuota) || 0) / 100);
    return s + base + iva;
  }, 0);

  const setItem = (i, k, v) => setItems(arr => arr.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const addItem = () => setItems(arr => [...arr, { descripcion: '', cantidad: 1, precio: '', alicuota: 21 }]);
  const removeItem = (i) => setItems(arr => arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr);

  async function emitir(e) {
    e.preventDefault(); setSaving(true); setError(''); setOk(null);
    try {
      const payload = {
        tipo, clientId: clientId || undefined,
        cliente: clientId ? undefined : { razonSocial, dni: docNro, cuit: docNro },
        condicionIvaReceptorId: Number(condIva),
        items: items.map(it => ({ descripcion: it.descripcion, cantidad: Number(it.cantidad) || 1, precio: Number(it.precio) || 0, alicuota: isC ? 0 : Number(it.alicuota) || 0 })),
      };
      const r = await api.post('/facturacion/emitir', payload);
      setOk(r.data);
    } catch (e) {
      const d = e.response?.data;
      setError((d?.mensajes && d.mensajes.join(' · ')) || d?.error || 'Error al emitir el comprobante');
      setSaving(false);
    }
  }

  if (ok) {
    const inv = ok.invoice || {};
    return (
      <div className="modal-overlay" onClick={onSaved}>
        <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
          <h2>✅ Factura autorizada</h2>
          <p style={{ margin: '8px 0' }}>{inv.tipo} N° {inv.puntoVenta}-{inv.numero}</p>
          {inv.cae && <p style={{ fontSize: 14 }}><strong>CAE:</strong> {inv.cae}{inv.vencimientoCae ? ` (vence ${inv.vencimientoCae})` : ''}</p>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
            {inv.id && <button className="btn btn-secondary" onClick={() => downloadInvoicePdf(inv.id)}>⬇ Ver PDF</button>}
            <button className="btn btn-primary" onClick={onSaved}>Listo</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640, maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <h2>Nueva factura</h2>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={emitir}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: 1, minWidth: 150 }}><label>Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)}>{TIPOS.map(t => <option key={t} value={t}>{t === 'FACTURA X' ? 'Factura X (no fiscal)' : t}</option>)}</select></div>
            <div className="field" style={{ flex: 1, minWidth: 180 }}><label>Condición IVA del cliente</label>
              <select value={condIva} onChange={e => setCondIva(e.target.value)}>{COND_IVA.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
          </div>

          <div className="field"><label>Cliente</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)}>
              <option value="">— Consumidor final / manual —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.dni ? ` (DNI ${c.dni})` : c.cuit ? ` (CUIT ${c.cuit})` : ''}</option>)}
            </select></div>
          {!clientId && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: 2, minWidth: 180 }}><label>Razón social (opcional)</label>
                <input value={razonSocial} onChange={e => setRazonSocial(e.target.value)} placeholder="Consumidor Final" /></div>
              <div className="field" style={{ flex: 1, minWidth: 140 }}><label>{tipo === 'FACTURA A' ? 'CUIT' : 'DNI / CUIT (opc.)'}</label>
                <input value={docNro} onChange={e => setDocNro(e.target.value)} placeholder="Sin especificar" /></div>
            </div>
          )}

          <label style={{ fontWeight: 600, display: 'block', margin: '12px 0 6px' }}>Ítems</label>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8, flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: 3, minWidth: 150, margin: 0 }}>
                <input placeholder="Descripción" value={it.descripcion} onChange={e => setItem(i, 'descripcion', e.target.value)} /></div>
              <div className="field" style={{ width: 66, margin: 0 }}>
                <input type="number" min="1" step="1" placeholder="Cant." value={it.cantidad} onChange={e => setItem(i, 'cantidad', e.target.value)} /></div>
              <div className="field" style={{ width: 110, margin: 0 }}>
                <input type="number" min="0" step="0.01" placeholder={isC ? 'Precio' : 'Precio s/IVA'} value={it.precio} onChange={e => setItem(i, 'precio', e.target.value)} /></div>
              {!isC && (
                <div className="field" style={{ width: 88, margin: 0 }}>
                  <select value={it.alicuota} onChange={e => setItem(i, 'alicuota', e.target.value)}>
                    <option value={21}>21%</option><option value={10.5}>10,5%</option><option value={27}>27%</option><option value={0}>0%</option>
                  </select></div>
              )}
              <button type="button" className="btn" onClick={() => removeItem(i)} title="Quitar" style={{ padding: '8px 10px' }}>✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-secondary" onClick={addItem}>+ Agregar ítem</button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <strong style={{ fontSize: 18 }}>Total: {fmt(total)}</strong>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Emitiendo…' : 'Emitir factura'}</button>
            </div>
          </div>
          {isC && <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 8 }}>Las Facturas C y X no discriminan IVA. La Factura X es un comprobante interno no fiscal.</p>}
        </form>
      </div>
    </div>
  );
}
