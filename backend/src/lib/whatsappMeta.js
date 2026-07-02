/**
 * WhatsApp Business Cloud API (Meta) — cliente HTTP multi-negocio.
 *
 * Modelo: UNA app de Meta + UN token (env META_WA_TOKEN), y MUCHOS números.
 * Cada negocio tiene su propio phone_number_id (guardado en Business.waPhoneId).
 *
 * Variables de entorno:
 *   META_WA_TOKEN     → Access token permanente (System User) de tu app de Meta
 *   META_WA_VERSION   → (opcional) versión del Graph API, default v19.0
 *
 * Uso:
 *   sendText(phoneId, to, message)
 *   sendTemplate(phoneId, to, templateName, langCode, components)
 *   sendDocument(phoneId, to, buffer, filename, caption)
 */

const https = require('https');

const GRAPH_HOST = 'graph.facebook.com';
const API_VERSION = process.env.META_WA_VERSION || 'v19.0';

// Token: usa el override del negocio (Embedded Signup) o cae al token central por env.
function tok(override) { return override || process.env.META_WA_TOKEN || ''; }

// ¿Hay algún token configurable? (central por env)
function isConfigured() { return !!(process.env.META_WA_TOKEN); }

/**
 * Normaliza un número argentino a formato internacional E.164 (solo dígitos).
 * "11-1234-5678" → "5491112345678"   "+54 9 11 1234 5678" → "5491112345678"
 */
function normalizePhone(phone) {
  if (!phone) return null;
  let n = String(phone).replace(/[^\d+]/g, '');
  if (n.startsWith('+')) n = n.slice(1);
  if (n.startsWith('54') && n.length >= 12) return n;
  if (n.startsWith('0')) n = n.slice(1);
  if (!n.startsWith('54')) {
    n = '549' + (n.startsWith('9') ? n.slice(1) : n);
  }
  return n;
}

/** Reemplaza variables {var} en un texto. */
function applyTemplate(template, vars) {
  return String(template || '')
    .replace(/\{nombre\}/gi,      vars.nombre      || '')
    .replace(/\{actividad\}/gi,   vars.actividad   || '')
    .replace(/\{vencimiento\}/gi, vars.vencimiento || '')
    .replace(/\{monto\}/gi,       vars.monto       || '')
    .replace(/\{servicio\}/gi,    vars.servicio    || '')
    .replace(/\{hora\}/gi,        vars.hora        || '')
    .replace(/\{fecha\}/gi,       vars.fecha       || '')
    .replace(/\{negocio\}/gi,     vars.negocio     || '');
}

// Request JSON genérico al Graph API
function graphRequest(path, method, jsonBody, extraHeaders, accessToken) {
  return new Promise((resolve, reject) => {
    const t = tok(accessToken);
    if (!t) return reject(new Error('Token de WhatsApp no configurado'));
    const body = jsonBody != null ? JSON.stringify(jsonBody) : null;
    const headers = {
      'Authorization': `Bearer ${t}`,
      'Content-Type': 'application/json',
      ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      ...(extraHeaders || {}),
    };
    const req = https.request({ hostname: GRAPH_HOST, path, method, headers }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(data || '{}'); } catch (_) { parsed = { raw: data }; }
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
        else reject(new Error(`Meta API ${res.statusCode}: ${JSON.stringify(parsed.error || parsed)}`));
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function requirePhoneId(phoneId) {
  if (!phoneId) throw new Error('Este negocio no tiene número de WhatsApp configurado (phone_number_id)');
  return phoneId;
}

/** Envía texto libre. Solo válido dentro de la ventana de 24hs (o números de prueba). */
async function sendText(phoneId, toPhone, message, accessToken) {
  requirePhoneId(phoneId);
  const to = normalizePhone(toPhone);
  if (!to) throw new Error('Número de teléfono inválido: ' + toPhone);
  return graphRequest(`/${API_VERSION}/${phoneId}/messages`, 'POST', {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: message },
  }, null, accessToken);
}

/** Envía una plantilla aprobada por Meta (para mensajes iniciados por el negocio). */
async function sendTemplate(phoneId, toPhone, templateName, langCode, components, accessToken) {
  requirePhoneId(phoneId);
  const to = normalizePhone(toPhone);
  if (!to) throw new Error('Número de teléfono inválido: ' + toPhone);
  return graphRequest(`/${API_VERSION}/${phoneId}/messages`, 'POST', {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: langCode || 'es_AR' },
      components: components || [],
    },
  }, null, accessToken);
}

/** Helper: arma el componente body con parámetros de texto posicionales. */
function bodyParams(values) {
  return [{ type: 'body', parameters: (values || []).map(v => ({ type: 'text', text: String(v ?? '') })) }];
}

/** Sube un archivo (Buffer) como media y devuelve su id. */
function uploadMedia(phoneId, buffer, filename, mimeType, accessToken) {
  return new Promise((resolve, reject) => {
    const t = tok(accessToken);
    if (!t) return reject(new Error('Token de WhatsApp no configurado'));
    requirePhoneId(phoneId);
    const boundary = '----GestumioBoundary' + Date.now().toString(16);
    const pre =
      `--${boundary}\r\nContent-Disposition: form-data; name="messaging_product"\r\n\r\nwhatsapp\r\n` +
      `--${boundary}\r\nContent-Disposition: form-data; name="type"\r\n\r\n${mimeType}\r\n` +
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`;
    const post = `\r\n--${boundary}--\r\n`;
    const payload = Buffer.concat([Buffer.from(pre, 'utf8'), buffer, Buffer.from(post, 'utf8')]);
    const options = {
      hostname: GRAPH_HOST,
      path: `/${API_VERSION}/${phoneId}/media`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${t}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': payload.length,
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(data || '{}'); } catch (_) { parsed = { raw: data }; }
        if (res.statusCode >= 200 && res.statusCode < 300 && parsed.id) resolve(parsed.id);
        else reject(new Error(`Meta media ${res.statusCode}: ${JSON.stringify(parsed.error || parsed)}`));
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/** Sube un PDF y lo envía como documento. */
async function sendDocument(phoneId, toPhone, buffer, filename, caption, accessToken) {
  requirePhoneId(phoneId);
  const to = normalizePhone(toPhone);
  if (!to) throw new Error('Número de teléfono inválido: ' + toPhone);
  const mediaId = await uploadMedia(phoneId, buffer, filename, 'application/pdf', accessToken);
  return graphRequest(`/${API_VERSION}/${phoneId}/messages`, 'POST', {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'document',
    document: { id: mediaId, filename, caption: caption || '' },
  }, null, accessToken);
}

// ===== Embedded Signup helpers =====

// Intercambia el 'code' del Embedded Signup por un token de acceso del negocio.
function exchangeCode(code) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return Promise.reject(new Error('META_APP_ID / META_APP_SECRET no configurados'));
  const path = `/${API_VERSION}/oauth/access_token?client_id=${encodeURIComponent(appId)}`
    + `&client_secret=${encodeURIComponent(appSecret)}&code=${encodeURIComponent(code)}`;
  return new Promise((resolve, reject) => {
    https.get({ hostname: GRAPH_HOST, path }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(data || '{}'); } catch (_) { parsed = { raw: data }; }
        if (res.statusCode >= 200 && res.statusCode < 300 && parsed.access_token) resolve(parsed.access_token);
        else reject(new Error(`Meta oauth ${res.statusCode}: ${JSON.stringify(parsed.error || parsed)}`));
      });
    }).on('error', reject);
  });
}

// Suscribe la app a los webhooks de la WABA (necesario para recibir/operar).
function subscribeApp(wabaId, accessToken) {
  return graphRequest(`/${API_VERSION}/${wabaId}/subscribed_apps`, 'POST', {}, null, accessToken);
}

// Registra el número en la Cloud API (coexistence). PIN de 6 dígitos.
function registerPhone(phoneId, accessToken, pin) {
  return graphRequest(`/${API_VERSION}/${phoneId}/register`, 'POST', {
    messaging_product: 'whatsapp',
    pin: pin || '000000',
  }, null, accessToken);
}

// Lee el número visible del phone_number_id.
function getPhoneInfo(phoneId, accessToken) {
  return graphRequest(`/${API_VERSION}/${phoneId}?fields=display_phone_number,verified_name`, 'GET', null, null, accessToken);
}

module.exports = {
  isConfigured, normalizePhone, applyTemplate,
  sendText, sendTemplate, sendDocument, uploadMedia, bodyParams,
  exchangeCode, subscribeApp, registerPhone, getPhoneInfo,
};
