/**
 * WhatsApp client (Baileys) MULTI-TENANT.
 * Una conexión independiente por negocio (businessId): sesión, socket,
 * estado y QR separados. La sesión de cada negocio se guarda en su propia
 * subcarpeta, por lo que un negocio NUNCA ve la sesión de otro.
 */

const QRCode = require('qrcode');
const path  = require('path');
const fs    = require('fs');

// Carpeta base; cada negocio guarda su sesión en <base>/<businessId>
const SESSION_BASE = process.env.BAILEYS_SESSION_PATH
  || (fs.existsSync('/data') ? '/data/baileys-sessions' : path.join(__dirname, '..', '..', 'baileys-sessions'));

// businessId -> { sock, state, qr, qrBase64, phone, reconnecting }
const sessions = new Map();

function sess(businessId) {
  let s = sessions.get(businessId);
  if (!s) {
    s = { sock: null, state: 'disconnected', qr: null, qrBase64: null, phone: null, reconnecting: false };
    sessions.set(businessId, s);
  }
  return s;
}
function dirFor(businessId) { return path.join(SESSION_BASE, String(businessId)); }
function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

function normalizePhone(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (!digits.startsWith('54')) digits = '54' + digits;
  if (digits.startsWith('54') && !digits.startsWith('549')) digits = '549' + digits.slice(2);
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

function makeNoopLogger() {
  const noop = () => {};
  function logger() {}
  logger.level = 'silent';
  logger.trace = noop; logger.debug = noop; logger.info = noop;
  logger.warn = noop; logger.error = noop; logger.fatal = noop;
  logger.child = () => makeNoopLogger();
  return logger;
}

async function initWhatsApp(businessId) {
  if (!businessId) return;
  const s = sess(businessId);
  if (s.state === 'connecting' || s.state === 'connected') return;
  s.state = 'connecting'; s.qr = null; s.qrBase64 = null; s.phone = null;

  const dir = dirFor(businessId);
  ensureDir(dir);

  const {
    default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion,
  } = await import('@whiskeysockets/baileys');
  const { Boom } = await import('@hapi/boom');

  const { state, saveCreds } = await useMultiFileAuthState(dir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version, auth: state, browser: Browsers.ubuntu('Chrome'),
    printQRInTerminal: false, logger: makeNoopLogger(),
    connectTimeoutMs: 60_000, defaultQueryTimeoutMs: 60_000,
    keepAliveIntervalMs: 30_000, markOnlineOnConnect: false,
  });
  s.sock = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      s.qr = qr; s.state = 'qr_ready';
      try { s.qrBase64 = await QRCode.toDataURL(qr, { width: 280, margin: 2 }); }
      catch (e) { console.error(`[baileys][${businessId}] QR err:`, e.message); }
      console.log(`[baileys][${businessId}] QR generado — esperando escaneo...`);
    }

    if (connection === 'open') {
      s.state = 'connected'; s.qr = null; s.qrBase64 = null; s.reconnecting = false;
      s.phone = sock.user?.id?.split(':')[0] || sock.user?.id || null;
      console.log(`[baileys][${businessId}] conectado como ${s.phone}`);
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error;
      const statusCode = (reason instanceof Boom) ? reason.output?.statusCode : null;
      console.log(`[baileys][${businessId}] desconectado. Código: ${statusCode}`);
      s.sock = null;

      if (statusCode === DisconnectReason.loggedOut) {
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
        s.qr = null; s.qrBase64 = null; s.state = 'disconnected';
        setTimeout(() => initWhatsApp(businessId), 2000);
      } else {
        if (s.state !== 'qr_ready') s.state = 'connecting';
        if (!s.reconnecting) {
          s.reconnecting = true;
          const delay = s.state === 'qr_ready' ? 3000 : 5000;
          setTimeout(() => {
            s.reconnecting = false;
            if (s.state === 'connecting') s.state = 'disconnected';
            initWhatsApp(businessId);
          }, delay);
        }
      }
    }
  });
}

function getState(businessId) {
  const s = sess(businessId);
  return { state: s.state, phone: s.phone, hasQR: !!s.qrBase64 };
}

function getQR(businessId) { return sess(businessId).qrBase64; }

async function sendMessage(businessId, phone, text) {
  const s = sess(businessId);
  if (s.state !== 'connected' || !s.sock) throw new Error('WhatsApp no conectado. Escanear el QR primero.');
  const number = normalizePhone(phone);
  if (!number) throw new Error('Número de teléfono inválido: ' + phone);
  await s.sock.sendMessage(number + '@s.whatsapp.net', { text });
  return { to: number };
}

async function sendDocument(businessId, phone, buffer, fileName, caption) {
  const s = sess(businessId);
  if (s.state !== 'connected' || !s.sock) throw new Error('WhatsApp no conectado. Escanear el QR primero.');
  const number = normalizePhone(phone);
  if (!number) throw new Error('Número de teléfono inválido: ' + phone);
  await s.sock.sendMessage(number + '@s.whatsapp.net', {
    document: buffer, mimetype: 'application/pdf',
    fileName: fileName || 'recibo.pdf', caption: caption || undefined,
  });
  return { to: number };
}

async function logout(businessId) {
  const s = sess(businessId);
  if (s.sock) {
    try { await s.sock.logout(); } catch (_) {}
    try { s.sock.end(); } catch (_) {}
    s.sock = null;
  }
  try { fs.rmSync(dirFor(businessId), { recursive: true, force: true }); } catch (_) {}
  s.state = 'disconnected'; s.qr = null; s.qrBase64 = null; s.phone = null;
  console.log(`[baileys][${businessId}] sesión cerrada y credenciales borradas.`);
}

// Restaura al arrancar todas las sesiones guardadas (una subcarpeta por negocio con creds.json)
function restoreSessions() {
  try {
    ensureDir(SESSION_BASE);
    const dirs = fs.readdirSync(SESSION_BASE, { withFileTypes: true }).filter(d => d.isDirectory());
    let n = 0;
    for (const d of dirs) {
      if (fs.existsSync(path.join(SESSION_BASE, d.name, 'creds.json'))) {
        n++;
        initWhatsApp(d.name).catch(e => console.error('[baileys-restore]', d.name, e.message));
      }
    }
    console.log(`[baileys] Restaurando ${n} sesión(es) de negocio`);
  } catch (e) { console.error('[baileys-restore]', e.message); }
}

// businessIds actualmente conectados (para el cron)
function connectedBusinessIds() {
  const out = [];
  for (const [bid, s] of sessions) if (s.state === 'connected') out.push(bid);
  return out;
}

module.exports = {
  initWhatsApp, getState, getQR, sendMessage, sendDocument, logout,
  normalizePhone, restoreSessions, connectedBusinessIds,
};
