import { useState } from 'react';
import api from '../api/client';

// Botón para enviar el PDF de una factura por WhatsApp. Si falta teléfono, lo pide.
export default function WhatsAppInvoiceButton({ invoiceId, label = '📲 Enviar por WhatsApp', className = 'btn btn-secondary' }) {
  const [state, setState] = useState('idle'); // idle | sending | askphone | sent | error
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState('');

  async function send(ph) {
    setState('sending'); setMsg('');
    try {
      await api.post(`/facturacion/${invoiceId}/whatsapp`, ph ? { phone: ph } : {});
      setState('sent');
    } catch (e) {
      const err = e.response?.data?.error || 'No se pudo enviar';
      if (/tel[eé]fono/i.test(err)) { setState('askphone'); }
      else { setState('error'); setMsg(err); }
    }
  }

  if (state === 'sent') return <span style={{ color: '#16a34a', fontSize: 13, fontWeight: 600 }}>✅ Enviado</span>;
  if (state === 'askphone') {
    return (
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Cel (11...)" style={{ width: 120, padding: '5px 8px' }} />
        <button type="button" className="btn btn-secondary" style={{ padding: '5px 10px' }} disabled={!phone} onClick={() => send(phone)}>Enviar</button>
      </span>
    );
  }
  return (
    <>
      <button type="button" className={className} onClick={() => send()} disabled={state === 'sending'}>
        {state === 'sending' ? 'Enviando…' : label}
      </button>
      {state === 'error' && <span style={{ color: '#dc2626', fontSize: 12, marginLeft: 6 }}>{msg}</span>}
    </>
  );
}
