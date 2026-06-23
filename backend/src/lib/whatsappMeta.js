/**
 * WhatsApp Business Cloud API (Meta) — cliente HTTP liviano.
 * Variables de entorno requeridas:
 *   META_WA_TOKEN      → Access token permanente del sistema
 *   META_WA_PHONE_ID   → Phone Number ID (de Meta for Developers)
 *   META_WA_TEMPLATE   → Nombre de la plantilla aprobada (opcional)
 */

const https = require('https');

function isConfigured() {
  return !!(process.env.META_WA_TOKEN && process.env.META_WA_PHONE_ID);
}

/**
 * Normaliza un número argentino al formato internacional E.164.
 * Ejemplos: "11-1234-5678" → "5491112345678"
 *           "+54 9 11 1234 5678" → "5491112345678"
 */
function normalizePhone(phone) {
  if (!phone) return null;
  // Quitar todo excepto dígitos y +
  let n = phone.replace(/[^\d+]/g, '');
  // Quitar + inicial
  if (n.startsWith('+')) n = n.slice(1);
  // Si ya empieza con 54 y tiene 13 dígitos → ok
  if (n.startsWith('54') && n.length >= 12) return n;
  // Si empieza con 0 (ej: 011...) → quitar 0 y agregar 54 9
  if (n.startsWith('0')) n = n.slice(1);
  // Agregar código de país Argentina + 9 (para celulares)
  if (!n.startsWith('54')) {
    n = '549' + (n.startsWith('9') ? n.slice(1) : n);
  }
  return n;
}

/**
 * Aplica variables a la plantilla de texto.
 * Variables soportadas: {nombre}, {actividad}, {vencimiento}, {monto}, {negocio}
 */
function applyTemplate(template, vars) {
  return template
    .replace(/\{nombre\}/gi,      vars.nombre      || '')
    .replace(/\{actividad\}/gi,   vars.actividad   || '')
    .replace(/\{vencimiento\}/gi, vars.vencimiento || '')
    .replace(/\{monto\}/gi,       vars.monto       || '')
    .replace(/\{negocio\}/gi,     vars.negocio     || '');
}

/**
 * Envía un mensaje de texto libre.
 * Funciona sin restricciones con números de prueba verificados.
 * Para números reales sin sesión activa → usá sendTemplate().
 */
function sendText(toPhone, message) {
  return new Promise((resolve, reject) => {
    const token   = process.env.META_WA_TOKEN;
    const phoneId = process.env.META_WA_PHONE_ID;
    const to      = normalizePhone(toPhone);

    if (!token || !phoneId) return reject(new Error('META_WA_TOKEN o META_WA_PHONE_ID no configurados'));
    if (!to)                return reject(new Error('Número de teléfono inválido: ' + toPhone));

    const body = JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: message },
    });

    const options = {
      hostname: 'graph.facebook.com',
      path: `/v19.0/${phoneId}/messages`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`Meta API error ${res.statusCode}: ${JSON.stringify(parsed?.error || parsed)}`));
          }
        } catch (e) { reject(e); }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Envía un mensaje usando una plantilla aprobada por Meta.
 * Para usar en producción con cualquier número.
 * templateName: nombre de la plantilla en Meta Business Manager.
 * components: array de componentes (body parameters).
 */
function sendTemplate(toPhone, templateName, langCode, components) {
  return new Promise((resolve, reject) => {
    const token   = process.env.META_WA_TOKEN;
    const phoneId = process.env.META_WA_PHONE_ID;
    const to      = normalizePhone(toPhone);

    if (!token || !phoneId) return reject(new Error('META_WA_TOKEN o META_WA_PHONE_ID no configurados'));
    if (!to)                return reject(new Error('Número de teléfono inválido: ' + toPhone));

    const body = JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: langCode || 'es_AR' },
        components: components || [],
      },
    });

    const options = {
      hostname: 'graph.facebook.com',
      path: `/v19.0/${phoneId}/messages`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`Meta API error ${res.statusCode}: ${JSON.stringify(parsed?.error || parsed)}`));
          }
        } catch (e) { reject(e); }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { isConfigured, normalizePhone, applyTemplate, sendText, sendTemplate };
