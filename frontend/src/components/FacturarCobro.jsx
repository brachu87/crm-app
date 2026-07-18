import { useEffect, useState } from 'react';
import api from '../api/client';
import WhatsAppInvoiceButton from './WhatsAppInvoiceButton';

const fmt = (v) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(v || 0);

// Prompt para emitir la factura de un cobro ya registrado.
export default function FacturarCobro({ clientId, cuotaId, descripcion, total, onClose }) {
  const [config, setConfig] = useState(null);
  const [tipo, setTipo] = useState('FACTURA X');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(null);

  useEffect(() => {
    api.get('/facturacion/config').then((r) => {
      setConfig(r.data);
      setTipo(r.data?.configured ? (r.data.fiscalCondicion === 'RI' ? 'FACTURA B' : 'FACTURA C') : 'FACTURA X');
    }).catch(() => setConfig({ configured: false }));
  }, []);

  const tipos = ['FACTURA X', ...(config?.configured ? ['FACTURA C', 'FACTURA B', 'FACTURA A'] : [])];
  const conIva = tipo === 'FACTURA A' || tipo === 'FACTURA B';

  async function emitir() {
    setSaving(true); setError('');
    try {
      const alic = conIva ? 21 : 0;
      // El total del cobro es final (IVA incluido). Para A/B despejamos el neto.
      const precio = conIva ? Math.round((Number(total) / 1.21) * 100) / 100 : (Number(total) || 0);
      const r = await api.post('/facturacion/emitir', {
        tipo,
        clientId: clientId || undefined,
        cuotaId: cuotaId || undefined,
        condicionIvaReceptorId: tipo === 'FACTURA A' ? 1 : 5,
        items: [{ descripcion: descripcion || 'Cobro', cantidad: 1, precio, alicuota: alic }],
      });
      setOk(r.data);
    } catch (e) {
      const d = e.response?.data;
      setError((d?.mensajes && d.mensajes.filter(Boolean).join(' · ')) || d?.error || 'No se pudo emitir la factura');
      setSaving(false);
    }
  }

  async function verPdf(id) {
    try {
      const res = await api.get(`/facturacion/${id}/pdf`, { responseType: 'blob' });
      const u = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noreferrer';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 60000);
    } catch (_) {}
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        {ok ? (
          <>
            <h2>✅ Factura emitida</h2>
            <p style={{ margin: '8px 0' }}>{(ok.invoice?.tipo || tipo)} N° {ok.invoice?.puntoVenta}-{ok.invoice?.numero}</p>
            {ok.invoice?.cae && <p style={{ fontSize: 14 }}><strong>CAE:</strong> {ok.invoice.cae}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
              {ok.invoice?.id && <button className="btn btn-secondary" onClick={() => verPdf(ok.invoice.id)}>⬇ Ver PDF</button>}
              {ok.invoice?.id && <WhatsAppInvoiceButton invoiceId={ok.invoice.id} />}
              <button className="btn btn-primary" onClick={onClose}>Listo</button>
            </div>
          </>
        ) : (
          <>
            <h2>✅ Cobro registrado</h2>
            <p style={{ color: 'var(--ink-soft)', margin: '4px 0 14px' }}>¿Querés emitir la factura de este cobro?</p>
            {error && <div className="error-banner">{error}</div>}
            <div className="field">
              <label>Tipo de comprobante</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {tipos.map((t) => <option key={t} value={t}>{t === 'FACTURA X' ? 'Factura X (no fiscal)' : t}</option>)}
              </select>
            </div>
            <p style={{ fontSize: 15 }}>Total: <strong>{fmt(total)}</strong></p>
            {!config?.configured && <p style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Para emitir A/B/C configurá AFIP en Facturación. La Factura X no requiere AFIP.</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn" onClick={onClose}>Ahora no</button>
              <button className="btn btn-primary" onClick={emitir} disabled={saving}>{saving ? 'Emitiendo…' : '🧾 Facturar'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
