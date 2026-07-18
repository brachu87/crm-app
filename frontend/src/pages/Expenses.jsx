import { useEffect, useState, useRef } from 'react';
import confirmDialog from '../utils/confirm';
import { useToast } from '../context/ToastContext';
import api from '../api/client';
import { useSectionPerms } from '../config/permissions';
import ImportModal from '../components/ImportModal';
import { ExportMenu, ImportMenu } from '../lib/dataIO';

// Parsea números en formato AR (1.234,56) o simple (1234.56)
function toNum(v) {
  if (v == null || v === '') return 0;
  let x = String(v).replace(/[^0-9.,\-]/g, '').trim();
  if (x.includes(',')) x = x.replace(/\./g, '').replace(',', '.');            // 1.234,56 -> 1234.56
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(x)) x = x.replace(/\./g, '');         // 15.000 -> 15000
  const n = parseFloat(x);
  return isNaN(n) ? 0 : n;
}

const CATEGORIAS = ['Alquiler', 'Sueldos', 'Servicios', 'Mantenimiento', 'Marketing', 'Equipamiento', 'Limpieza', 'Impuestos', 'Otro'];
const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Débito', 'Crédito', 'Otro'];

function exportCSV(expenses) {
  const rows = [
    ['Fecha', 'Categoría', 'Descripción', 'Método de pago', 'Monto'],
    ...expenses.map((e) => [
      new Date(e.date).toLocaleDateString('es-AR'),
      e.category, e.description || '', e.paymentMethod || '', e.amount,
    ]),
  ];
  const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = 'gastos.csv';
  a.click();
}

export default function Expenses() {
  const can = useSectionPerms('gastos');
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [prefill, setPrefill] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState('');
  const fileRef = useRef(null);

  async function onScanFile(ev) {
    const file = ev.target.files && ev.target.files[0];
    if (ev.target) ev.target.value = '';
    if (!file) return;
    setScanning(true); setScanErr('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/expenses/scan', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const d = r.data || {};
      const tipoMap = { A: 'Factura A', B: 'Factura B', C: 'Factura C', M: 'Factura M' };
      let _pv = '', _num = '';
      if (d.numero) { const m = String(d.numero).match(/(\d{1,5})\s*-\s*(\d{1,8})/); if (m) { _pv = m[1]; _num = m[2]; } else { _num = String(d.numero); } }
      setPrefill({
        amount: d.total != null ? d.total : '',
        date: d.fecha || new Date().toISOString().slice(0, 10),
        category: d.categoria || '',
        description: (!d.supplierId && d.proveedor) ? d.proveedor : '',
        paymentMethod: '',
        supplierId: d.supplierId || '',
        comprobanteTipo: d.tipo ? (tipoMap[String(d.tipo).toUpperCase()] || d.tipo) : '',
        puntoVenta: _pv,
        comprobanteNumero: _num,
        proveedorCuit: d.cuit || '',
        proveedorCondIva: d.condicionIvaProveedor || '',
        netoGravado: d.neto != null ? d.neto : '',
        noGravado: d.noGravado != null ? d.noGravado : '',
        ivaAlicuota: d.ivaAlicuota != null ? d.ivaAlicuota : '',
        ivaMonto: d.iva != null ? d.iva : '',
        percepIva: d.percepIva != null ? d.percepIva : '',
        percepIIBB: d.percepIIBB != null ? d.percepIIBB : '',
        otrosTrib: d.otrosTrib != null ? d.otrosTrib : '',
      });
      setEditing(null); setShowModal(true);
    } catch (err) {
      setScanErr(err.response?.data?.error || 'No se pudo leer la factura. Probá con una foto más nítida.');
    } finally { setScanning(false); }
  }

  const [suppliers, setSuppliers] = useState([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [search, setSearch] = useState('');
  const [fCategory, setFCategory] = useState('');
  const [fSupplier, setFSupplier] = useState('');
  const [fMethod, setFMethod] = useState('');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');

  function load() {
    setLoading(true);
    Promise.all([
      api.get('/expenses'),
      api.get('/suppliers'),
    ]).then(([expRes, supRes]) => {
      setExpenses(expRes.data);
      setSuppliers(supRes.data || []);
    }).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleDelete(id) {
    if (!await confirmDialog('¿Eliminar este gasto?')) return;
    await api.delete(`/expenses/${id}`);
    load();
  }

  const filtered = expenses.filter((e) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const hay = `${e.category || ''} ${e.description || ''} ${e.supplier?.name || ''} ${e.paymentMethod || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (fCategory && e.category !== fCategory) return false;
    if (fSupplier && e.supplierId !== fSupplier) return false;
    if (fMethod && e.paymentMethod !== fMethod) return false;
    const d = e.date ? String(e.date).slice(0, 10) : '';
    if (fFrom && d < fFrom) return false;
    if (fTo && d > fTo) return false;
    return true;
  });
  const hasFilters = search || fCategory || fSupplier || fMethod || fFrom || fTo;
  const total = filtered.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Gastos</h1>
          <p className="page-subtitle">Control de egresos del negocio</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {can.importar && <ImportMenu onPick={() => setShowImportModal(true)} />}
          {expenses.length > 0 && can.exportar && <ExportMenu rows={filtered} filename="gastos" title="Gastos" columns={[{ header: 'Fecha', value: (e) => e.date ? new Date(e.date).toLocaleDateString('es-AR') : '' }, { header: 'Categoría', value: (e) => e.category || '' }, { header: 'Descripción', value: (e) => e.description || '' }, { header: 'Proveedor', value: (e) => e.supplier?.name || '' }, { header: 'Método de pago', value: (e) => e.paymentMethod || '' }, { header: 'Monto', value: (e) => e.amount }]} />}
          {can.exportar && filtered.some((e) => e.comprobanteTipo || e.comprobanteNumero || e.proveedorCuit) && (
            <ExportMenu label="📚 Libro IVA ▾" filename="libro-iva-compras" title="Libro IVA Compras"
              rows={filtered.filter((e) => e.comprobanteTipo || e.comprobanteNumero || e.proveedorCuit)}
              columns={[
                { header: 'Fecha', value: (e) => e.date ? new Date(e.date).toLocaleDateString('es-AR') : '' },
                { header: 'Tipo comprobante', value: (e) => e.comprobanteTipo || '' },
                { header: 'Pto venta', value: (e) => e.puntoVenta || '' },
                { header: 'Número', value: (e) => e.comprobanteNumero || '' },
                { header: 'CUIT proveedor', value: (e) => e.proveedorCuit || '' },
                { header: 'Proveedor', value: (e) => e.supplier?.name || '' },
                { header: 'Cond. IVA', value: (e) => e.proveedorCondIva || '' },
                { header: 'Neto gravado', value: (e) => e.netoGravado ?? '' },
                { header: 'No gravado/Exento', value: (e) => e.noGravado ?? '' },
                { header: 'Alícuota IVA', value: (e) => e.ivaAlicuota != null ? e.ivaAlicuota + '%' : '' },
                { header: 'IVA', value: (e) => e.ivaMonto ?? '' },
                { header: 'Perc. IVA', value: (e) => e.percepIva ?? '' },
                { header: 'Perc. IIBB', value: (e) => e.percepIIBB ?? '' },
                { header: 'Otros tributos', value: (e) => e.otrosTrib ?? '' },
                { header: 'Total', value: (e) => e.amount },
              ]} />
          )}
          {can.crear && <>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={onScanFile} />
            <button className="btn btn-secondary" onClick={() => fileRef.current && fileRef.current.click()} disabled={scanning} title="Sacá una foto o subí el PDF de una factura de compra">
              {scanning ? '⏳ Leyendo…' : '📷 Cargar factura'}
            </button>
          </>}
          {can.crear && <button className="btn btn-primary" onClick={() => { setEditing(null); setPrefill(null); setShowModal(true); }}>+ Nuevo gasto</button>}
        </div>
      </div>
      {scanErr && <div className="error-banner" style={{ marginBottom: 12 }}>{scanErr}</div>}

      {!loading && expenses.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          <div className="card" style={{ flex: 1, padding: '16px 20px' }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Total gastos</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#dc2626' }}>
              ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="card" style={{ flex: 1, padding: '16px 20px' }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Cantidad de registros</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{filtered.length}</p>
          </div>
        </div>
      )}

      {!loading && expenses.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="field-input" style={{ maxWidth: 220 }} placeholder="Buscar (descripción, categoría, proveedor)…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="field-input" style={{ maxWidth: 170 }} value={fCategory} onChange={(e) => setFCategory(e.target.value)}>
            <option value="">Toda categoría</option>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="field-input" style={{ maxWidth: 190 }} value={fSupplier} onChange={(e) => setFSupplier(e.target.value)}>
            <option value="">Todo proveedor</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="field-input" style={{ maxWidth: 150 }} value={fMethod} onChange={(e) => setFMethod(e.target.value)}>
            <option value="">Todo método</option>
            {METODOS_PAGO.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Desde</label>
          <input type="date" className="field-input" style={{ maxWidth: 150 }} value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
          <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Hasta</label>
          <input type="date" className="field-input" style={{ maxWidth: 150 }} value={fTo} onChange={(e) => setFTo(e.target.value)} />
          {hasFilters && <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setFCategory(''); setFSupplier(''); setFMethod(''); setFFrom(''); setFTo(''); }}>Limpiar</button>}
        </div>
      )}

      {loading ? (
        <div className="page-spinner"><div className="spinner spinner-lg"></div><span>Cargando...</span></div>
      ) : expenses.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <h3>Todavía no hay gastos registrados</h3>
            <p>Llevá el control de los egresos de tu negocio.</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ marginTop: 12 }}>
              + Nuevo gasto
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card"><div className="empty-state"><p>No hay gastos que coincidan con los filtros.</p></div></div>
      ) : (
        <div className="card">
          <div className="table-wrap"><table className="table cards-mobile">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Categoría</th>
                <th>Descripción</th>
                <th>Proveedor</th>
                <th>Método de pago</th>
                <th>Monto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td data-label="Fecha">{new Date(e.date).toLocaleDateString('es-AR')}</td>
                  <td data-label="Categoría">
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 12,
                      background: 'var(--bg)',
                      color: 'var(--ink)',
                    }}>
                      {e.category}
                    </span>
                  </td>
                  <td data-label="Descripción" style={{ color: 'var(--text-secondary)' }}>{e.description || '-'}</td>
                  <td data-label="Proveedor" style={{ color: 'var(--ink-soft)', fontSize: 13 }}>{e.supplier?.name || '-'}</td>
                  <td data-label="Método">{e.paymentMethod || '-'}</td>
                  <td data-label="Monto" style={{ fontWeight: 600, color: '#dc2626' }}>
                    ${Number(e.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="actions-cell" style={{ display: 'flex', gap: 6 }}>
                    {can.editar && <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(e); setShowModal(true); }}>Editar</button>}
                    {can.eliminar && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(e.id)}>
                      Eliminar
                    </button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {showModal && (
        <ExpenseModal
          expense={editing}
          prefill={editing ? null : prefill}
          suppliers={suppliers}
          onClose={() => { setShowModal(false); setPrefill(null); }}
          onSaved={() => { setShowModal(false); setPrefill(null); load(); }}
        />
      )}

      {showImportModal && (
        <ImportModal
          title="Importar gastos desde Excel o CSV"
          columns={[
            { key: 'category',      header: 'Categoría',       labels: ['categoria','categoría','category','rubro','tipo'] },
            { key: 'amount',        header: 'Monto',           labels: ['monto','importe','amount','total','valor'] },
            { key: 'description',   header: 'Descripción',     labels: ['descripcion','descripción','description','detalle','concepto'] },
            { key: 'paymentMethod', header: 'Método de pago',  labels: ['metodo','método','metodo de pago','método de pago','forma de pago','payment','paymentmethod','pago'] },
            { key: 'date',          header: 'Fecha',           labels: ['fecha','date','dia','día'] },
            { key: 'supplier',      header: 'Proveedor',       labels: ['proveedor','supplier','prov'] },
          ]}
          apiPath="/expenses/import"
          payloadKey="expenses"
          onClose={() => setShowImportModal(false)}
          onImported={() => { setShowImportModal(false); load(); }}
        />
      )}
    </div>
  );
}

function ExpenseModal({ expense, prefill, suppliers = [], onClose, onSaved }) {
  const isEdit = !!(expense && expense.id);
  const src = expense || prefill || {};
  const [form, setForm] = useState({
    amount: src.amount ?? '',
    date: src.date ? String(src.date).slice(0, 10) : new Date().toISOString().slice(0, 10),
    category: src.category || '',
    description: src.description || '',
    paymentMethod: src.paymentMethod || '',
    supplierId: src.supplierId || '',
    comprobanteTipo: src.comprobanteTipo || '',
    puntoVenta: src.puntoVenta || '',
    comprobanteNumero: src.comprobanteNumero || '',
    proveedorCuit: src.proveedorCuit || '',
    proveedorCondIva: src.proveedorCondIva || '',
    netoGravado: src.netoGravado ?? '',
    noGravado: src.noGravado ?? '',
    ivaAlicuota: src.ivaAlicuota ?? '',
    ivaMonto: src.ivaMonto ?? '',
    percepIva: src.percepIva ?? '',
    percepIIBB: src.percepIIBB ?? '',
    otrosTrib: src.otrosTrib ?? '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // El IVA se calcula desde neto × alícuota; el total suma todos los importes.
  useEffect(() => {
    const neto = toNum(form.netoGravado);
    const alicRaw = String(form.ivaAlicuota).trim();
    const hasAlic = alicRaw !== '';
    const alic = parseFloat(alicRaw.replace(',', '.'));
    setForm((f) => {
      let next = f;
      if (hasAlic && !isNaN(alic)) {
        const ivaCalc = Math.round(neto * alic) / 100; // neto × (alic/100), 2 decimales
        if (String(f.ivaMonto) !== String(ivaCalc)) next = { ...next, ivaMonto: ivaCalc };
      }
      const total = Math.round((neto + toNum(f.noGravado) + toNum(next.ivaMonto) + toNum(f.percepIva) + toNum(f.percepIIBB) + toNum(f.otrosTrib)) * 100) / 100;
      if (total > 0 && String(next.amount) !== String(total)) next = { ...next, amount: total };
      return next;
    });
  }, [form.netoGravado, form.ivaAlicuota, form.ivaMonto, form.noGravado, form.percepIva, form.percepIIBB, form.otrosTrib]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const parsedAmount = toNum(form.amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setError('El monto debe ser un número mayor a 0');
        setSaving(false);
        return;
      }
      const payload = {
        amount: parsedAmount,
        date: form.date,
        category: form.category,
        description: form.description || undefined,
        paymentMethod: form.paymentMethod || undefined,
        supplierId: form.supplierId || null,
        comprobanteTipo: form.comprobanteTipo || '',
        puntoVenta: form.puntoVenta || '',
        comprobanteNumero: form.comprobanteNumero || '',
        proveedorCuit: form.proveedorCuit || '',
        proveedorCondIva: form.proveedorCondIva || '',
        netoGravado: form.netoGravado,
        noGravado: form.noGravado,
        ivaAlicuota: form.ivaAlicuota,
        ivaMonto: form.ivaMonto,
        percepIva: form.percepIva,
        percepIIBB: form.percepIIBB,
        otrosTrib: form.otrosTrib,
      };
      if (isEdit) {
        await api.put(`/expenses/${expense.id}`, payload);
      } else {
        await api.post('/expenses', payload);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar el gasto');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? 'Editar gasto' : (prefill ? '📷 Revisá el gasto de la factura' : 'Nuevo gasto')}</h2>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="two-col-grid">
            <div className="field">
              <label>Monto ($) *</label>
              <input type="text" inputMode="decimal" value={form.amount} onChange={(e) => update('amount', e.target.value)} placeholder="0,00" required />
            </div>
            <div className="field">
              <label>Fecha</label>
              <input type="date" value={form.date} onChange={(e) => update('date', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Categoría *</label>
            <input
              list="categorias-list"
              value={form.category}
              onChange={(e) => update('category', e.target.value)}
              placeholder="Seleccioná o escribí una categoría"
              required
            />
            <datalist id="categorias-list">
              {CATEGORIAS.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div className="field">
            <label>Descripción / Nota</label>
            <textarea rows="2" value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Detalle del gasto (opcional)" />
          </div>
          <div className="field">
            <label>Método de pago</label>
            <select value={form.paymentMethod} onChange={(e) => update('paymentMethod', e.target.value)}>
              <option value="">— Sin especificar —</option>
              {METODOS_PAGO.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {suppliers.length > 0 && (
            <div className="field">
              <label>Proveedor asociado <span style={{ fontWeight: 400, color: 'var(--ink-soft)', fontSize: 12 }}>(opcional)</span></label>
              <select value={form.supplierId} onChange={(e) => update('supplierId', e.target.value)}>
                <option value="">— Sin proveedor —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <div style={{ margin: '10px 0 8px', borderTop: '1px dashed var(--border, #e5e7eb)', paddingTop: 10, fontWeight: 600, fontSize: 14 }}>🧾 Datos del comprobante</div>
          <div style={{ background: 'var(--surface-2, #f8fafc)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div className="two-col-grid">
                <div className="field">
                  <label>Tipo de comprobante</label>
                  <select value={form.comprobanteTipo} onChange={(e) => update('comprobanteTipo', e.target.value)}>
                    <option value="">— Seleccionar —</option>
                    {['Factura A','Factura B','Factura C','Factura M','Nota de Crédito A','Nota de Crédito B','Nota de Crédito C','Nota de Débito A','Nota de Débito B','Nota de Débito C','Ticket','Recibo','Otro'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Cond. IVA del proveedor</label>
                  <select value={form.proveedorCondIva} onChange={(e) => update('proveedorCondIva', e.target.value)}>
                    <option value="">— Seleccionar —</option>
                    {['Responsable Inscripto','Monotributo','Exento','Consumidor Final'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="two-col-grid">
                <div className="field"><label>Punto de venta</label>
                  <input value={form.puntoVenta} onChange={(e) => update('puntoVenta', e.target.value)} placeholder="0001" /></div>
                <div className="field"><label>Número de comprobante</label>
                  <input value={form.comprobanteNumero} onChange={(e) => update('comprobanteNumero', e.target.value)} placeholder="00000123" /></div>
              </div>
              <div className="field"><label>CUIT del proveedor</label>
                <input value={form.proveedorCuit} onChange={(e) => update('proveedorCuit', e.target.value)} placeholder="30712345678" /></div>
              <div className="two-col-grid">
                <div className="field"><label>Neto gravado ($)</label>
                  <input type="text" inputMode="decimal" value={form.netoGravado} onChange={(e) => update('netoGravado', e.target.value)} placeholder="0,00" /></div>
                <div className="field"><label>No gravado / Exento ($)</label>
                  <input type="text" inputMode="decimal" value={form.noGravado} onChange={(e) => update('noGravado', e.target.value)} placeholder="0,00" /></div>
              </div>
              <div className="two-col-grid">
                <div className="field"><label>Alícuota IVA</label>
                  <select value={form.ivaAlicuota} onChange={(e) => update('ivaAlicuota', e.target.value)}>
                    <option value="">—</option>
                    {['21','10.5','27','5','2.5','0'].map((a) => <option key={a} value={a}>{a}%</option>)}
                  </select></div>
                <div className="field"><label>IVA ($){form.ivaAlicuota ? ' (auto)' : ''}</label>
                  <input type="text" inputMode="decimal" value={form.ivaMonto} onChange={(e) => update('ivaMonto', e.target.value)} placeholder="0,00" readOnly={!!form.ivaAlicuota} title={form.ivaAlicuota ? 'Se calcula automáticamente: neto × alícuota' : ''} style={form.ivaAlicuota ? { background: 'var(--surface-2, #eef2f7)' } : undefined} /></div>
              </div>
              <div className="two-col-grid">
                <div className="field"><label>Percep. IVA ($)</label>
                  <input type="text" inputMode="decimal" value={form.percepIva} onChange={(e) => update('percepIva', e.target.value)} placeholder="0,00" /></div>
                <div className="field"><label>Percep. IIBB ($)</label>
                  <input type="text" inputMode="decimal" value={form.percepIIBB} onChange={(e) => update('percepIIBB', e.target.value)} placeholder="0,00" /></div>
              </div>
              <div className="field"><label>Otros tributos ($)</label>
                <input type="text" inputMode="decimal" value={form.otrosTrib} onChange={(e) => update('otrosTrib', e.target.value)} placeholder="0,00" /></div>
              <p style={{ fontSize: 12, color: 'var(--ink-soft, #888)', margin: '2px 0 0' }}>El IVA se calcula desde el neto × alícuota, y el total suma neto + IVA + no gravado + percepciones + otros tributos.</p>
            </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Registrar gasto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
