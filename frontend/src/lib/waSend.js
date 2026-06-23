import api from '../api/client';

function flash(msg, ok = true) {
  try {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText =
      'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;color:#fff;' +
      'padding:10px 18px;border-radius:10px;font-size:14px;font-weight:600;' +
      'box-shadow:0 4px 16px rgba(0,0,0,.25);background:' + (ok ? '#16a34a' : '#dc2626');
    document.body.appendChild(el);
    setTimeout(() => { try { el.remove(); } catch (_) {} }, 2800);
  } catch (_) {}
}

// Envía un mensaje por WhatsApp directo (conexión de la app, Baileys).
// Si WhatsApp no está conectado o falla, cae a wa.me (abre WhatsApp con el texto).
export async function sendWA(phone, message) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) { flash('Sin teléfono', false); return false; }
  try {
    await api.post('/whatsapp/send', { phone: digits, message: message || '' });
    flash('✅ Enviado por WhatsApp');
    return true;
  } catch (err) {
    flash('WhatsApp no conectado — abriendo WhatsApp…', false);
    window.open('https://wa.me/' + digits + '?text=' + encodeURIComponent(message || ''), '_blank');
    return false;
  }
}
