/**
 * Cliente de Evolution API (WhatsApp no oficial, multi-instancia).
 * Una instancia por negocio: `gestumio_<businessId>`.
 *
 * Variables de entorno:
 *   EVOLUTION_API_URL   → base del servidor Evolution (ej: https://evo.up.railway.app)
 *   EVOLUTION_API_KEY   → API key global (AUTHENTICATION_API_KEY del server)
 */

const BASE = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
const KEY  = process.env.EVOLUTION_API_KEY || '';

function isConfigured() { return !!(BASE && KEY); }

function instanceName(businessId) { return `gestumio_${businessId}`; }

// Normaliza a dígitos con código de país AR
function normalizePhone(phone) {
  if (!phone) return null;
  let n = String(phone).replace(/[^\d+]/g, '');
  if (n.startsWith('+')) n = n.slice(1);
  if (n.startsWith('54') && n.length >= 12) return n;
  if (n.startsWith('0')) n = n.slice(1);
  if (!n.startsWith('54')) n = '549' + (n.startsWith('9') ? n.slice(1) : n);
  return n;
}

async function req(method, path, body) {
  if (!isConfigured()) throw new Error('Evolution API no configurada (EVOLUTION_API_URL / EVOLUTION_API_KEY)');
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'apikey': KEY },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.response?.message || data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(`Evolution ${res.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
  }
  return data;
}

function webhookUrl() {
  const base = (process.env.APP_URL || 'https://app.gestumio.com').replace(/\/$/, '');
  return `${base}/api/whatsapp/webhook`;
}

// Configura el webhook de mensajes entrantes de la instancia (para confirmar turnos por respuesta).
async function setWebhook(businessId) {
  const name = instanceName(businessId);
  const url = webhookUrl();
  // Evolution v2
  try {
    return await req('POST', `/webhook/set/${name}`, {
      webhook: { enabled: true, url, byEvents: false, base64: false, events: ['MESSAGES_UPSERT'] },
    });
  } catch (_) {
    // Evolution v1 (formato anterior)
    return req('POST', `/webhook/set/${name}`, {
      url, webhook_by_events: false, events: ['MESSAGES_UPSERT'],
    });
  }
}

// Crea la instancia si no existe y devuelve el QR (base64) si aparece.
async function connect(businessId) {
  const name = instanceName(businessId);
  try {
    const r = await req('POST', '/instance/create', {
      instanceName: name,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    });
    try { await setWebhook(businessId); } catch (_) {}
    return { qr: r?.qrcode?.base64 || null };
  } catch (e) {
    // Si ya existe, pedimos el connect para traer el QR
    if (/already|exists|in use|already in use/i.test(e.message)) {
      try { await setWebhook(businessId); } catch (_) {}
      return getQR(businessId);
    }
    throw e;
  }
}

async function getQR(businessId) {
  const name = instanceName(businessId);
  const r = await req('GET', `/instance/connect/${name}`);
  return { qr: r?.base64 || r?.qrcode?.base64 || null, code: r?.code || null };
}

// Estado: 'connected' | 'connecting' | 'disconnected'
async function getState(businessId) {
  const name = instanceName(businessId);
  try {
    const r = await req('GET', `/instance/connectionState/${name}`);
    const st = r?.instance?.state || r?.state || 'close';
    if (st === 'open') return { state: 'connected' };
    if (st === 'connecting') return { state: 'connecting' };
    return { state: 'disconnected' };
  } catch (_) {
    return { state: 'disconnected' };
  }
}

async function sendText(businessId, phone, text) {
  const name = instanceName(businessId);
  const number = normalizePhone(phone);
  if (!number) throw new Error('Número inválido: ' + phone);
  return req('POST', `/message/sendText/${name}`, { number, text });
}

async function sendDocument(businessId, phone, buffer, filename, caption) {
  const name = instanceName(businessId);
  const number = normalizePhone(phone);
  if (!number) throw new Error('Número inválido: ' + phone);
  const media = Buffer.isBuffer(buffer) ? buffer.toString('base64') : String(buffer);
  return req('POST', `/message/sendMedia/${name}`, {
    number,
    mediatype: 'document',
    mimetype: 'application/pdf',
    media,
    fileName: filename,
    caption: caption || '',
  });
}

async function logout(businessId) {
  const name = instanceName(businessId);
  try { await req('DELETE', `/instance/logout/${name}`); } catch (_) {}
  try { await req('DELETE', `/instance/delete/${name}`); } catch (_) {}
  return { ok: true };
}

module.exports = {
  isConfigured, instanceName, normalizePhone,
  connect, getQR, getState, sendText, sendDocument, logout, setWebhook, webhookUrl,
};
