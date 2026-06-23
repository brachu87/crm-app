/**
 * WhatsApp client usando @whiskeysockets/baileys.
 * Singleton: se inicializa una sola vez al arrancar el servidor.
 * Estados: disconnected | connecting | qr_ready | connected
 */

const QRCode = require('qrcode');
const path  = require('path');
const fs    = require('fs');

// ─── estado global ────────────────────────────────────────────────────────────
let sock            = null;
let connectionState = 'disconnected';  // disconnected | connecting | qr_ready | connected
let currentQR       = null;            // string raw QR para re-generar si se pide
let currentQRBase64 = null;            // data:image/png;base64,...
let connectedPhone  = null;            // número conectado, ej: "5491112345678"
let isReconnecting  = false;

// Carpeta donde se guarda la sesión (configurable por env var)
const SESSION_DIR = process.env.BAILEYS_SESSION_PATH
  || path.join(__dirname, '..', '..', 'baileys-session');

// ─── helpers ──────────────────────────────────────────────────────────────────
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Normaliza un número argentino al JID de WhatsApp (sin @s.whatsapp.net).
 * Acepta: 1512345678, 01512345678, 541512345678, +541512345678, 011-1234-5678
 */
function normalizePhone(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  // Quitar prefijo 0 de larga distancia
  if (digits.startsWith('0')) digits = digits.slice(1);
  // Agregar código Argentina si no está
  if (!digits.startsWith('54')) digits = '54' + digits;
  // Los celulares argentinos en WhatsApp tienen el 9 después del 54
  if (digits.startsWith('54') && !digits.startsWith('549')) {
    digits = '549' + digits.slice(2);
  }
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

// Logger compatible con Pino (Baileys lo requiere internamente)
function makeNoopLogger() {
  const noop = () => {};
  function logger() {}
  logger.level = 'silent';
  logger.trace = noop;
  logger.debug = noop;
  logger.info  = noop;
  logger.warn  = noop;
  logger.error = noop;
  logger.fatal = noop;
  logger.child = () => makeNoopLogger();
  return logger;
}

// ─── init ─────────────────────────────────────────────────────────────────────
async function initWhatsApp() {
  if (connectionState === 'connecting' || connectionState === 'connected') return;
  connectionState = 'connecting';
  currentQR = null;
  currentQRBase64 = null;
  connectedPhone  = null;

  ensureDir(SESSION_DIR);

  // Import dinámico (Baileys es ESM)
  const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
    fetchLatestBaileysVersion,
  } = await import('@whiskeysockets/baileys');

  const { Boom } = await import('@hapi/boom');

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    browser: Browsers.ubuntu('Chrome'),
    printQRInTerminal: false,
    logger: makeNoopLogger(),
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: 60_000,
    keepAliveIntervalMs: 30_000,
    markOnlineOnConnect: false,
  });

  // ── Guardar credenciales cuando cambian ─────────────────────────────────────
  sock.ev.on('creds.update', saveCreds);

  // ── Eventos de conexión ─────────────────────────────────────────────────────
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = qr;
      connectionState = 'qr_ready';
      try {
        currentQRBase64 = await QRCode.toDataURL(qr, { width: 300 });
      } catch (e) {
        console.error('[baileys] Error generando QR:', e.message);
      }
      console.log('[baileys] QR generado — esperando escaneo...');
    }

    if (connection === 'open') {
      connectionState = 'connected';
      currentQR       = null;
      currentQRBase64 = null;
      isReconnecting  = false;
      // Obtener el número conectado
      connectedPhone = sock.user?.id?.split(':')[0] || sock.user?.id || null;
      console.log('[baileys] Conectado como', connectedPhone);
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error;
      const statusCode = (reason instanceof Boom) ? reason.output?.statusCode : null;

      console.log('[baileys] Desconectado. Código:', statusCode, reason?.message);

      if (statusCode === DisconnectReason.loggedOut) {
        // Sesión cerrada — borrar archivos y mostrar nuevo QR
        console.log('[baileys] Sesión cerrada. Borrando credenciales...');
        fs.rmSync(SESSION_DIR, { recursive: true, force: true });
        connectionState = 'disconnected';
        sock = null;
        // Reconectar para mostrar nuevo QR
        setTimeout(() => initWhatsApp(), 2000);
      } else if (!isReconnecting) {
        // Desconexión temporal — reconectar automáticamente
        isReconnecting = true;
        connectionState = 'connecting';
        sock = null;
        setTimeout(() => {
          isReconnecting = false;
          initWhatsApp();
        }, 5000);
      }
    }
  });
}

// ─── API pública ──────────────────────────────────────────────────────────────
function getState() {
  return {
    state: connectionState,
    phone: connectedPhone,
    hasQR: !!currentQRBase64,
  };
}

function getQR() {
  return currentQRBase64;
}

/**
 * Enviar mensaje de texto.
 * @param {string} phone - número en cualquier formato argentino
 * @param {string} text  - texto a enviar
 */
async function sendMessage(phone, text) {
  if (connectionState !== 'connected') {
    throw new Error('WhatsApp no conectado. Escanear el QR primero.');
  }
  const number = normalizePhone(phone);
  if (!number) throw new Error('Número de teléfono inválido: ' + phone);

  const jid = number + '@s.whatsapp.net';
  await sock.sendMessage(jid, { text });
  return { to: number };
}

/**
 * Cerrar sesión y borrar credenciales guardadas.
 */
async function logout() {
  if (sock) {
    try { await sock.logout(); } catch (_) {}
    try { sock.end(); } catch (_) {}
    sock = null;
  }
  fs.rmSync(SESSION_DIR, { recursive: true, force: true });
  connectionState = 'disconnected';
  currentQR       = null;
  currentQRBase64 = null;
  connectedPhone  = null;
  console.log('[baileys] Sesión cerrada y credenciales borradas.');
}

module.exports = { initWhatsApp, getState, getQR, sendMessage, logout, normalizePhone };
