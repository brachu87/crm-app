const express = require('express');
const router = express.Router();
const { sendEmail } = require('../lib/mailer');

const COMPANY_EMAIL = process.env.LEGAL_EMAIL || 'contacto@gestumio.app';

function esc(s = '') {
  return String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])).slice(0, 3000);
}

async function handle(req, res, tipo) {
  const { nombre, email, telefono, detalle } = req.body || {};
  if (!nombre || !email) return res.status(400).json({ error: 'Nombre y email son obligatorios.' });
  const esBaja = tipo === 'baja';
  const titulo = esBaja ? 'Solicitud de BAJA de servicio' : 'Solicitud de ARREPENTIMIENTO (revocación art. 34 Ley 24.240)';
  const html = `<h2>${titulo}</h2>
    <p><b>Nombre:</b> ${esc(nombre)}</p>
    <p><b>Email:</b> ${esc(email)}</p>
    <p><b>Teléfono:</b> ${esc(telefono || '-')}</p>
    <p><b>Detalle:</b> ${esc(detalle || '-')}</p>
    <p><b>Fecha:</b> ${new Date().toLocaleString('es-AR')}</p>`;
  try {
    await sendEmail({ to: COMPANY_EMAIL, subject: `[Gestumio] ${titulo}`, html });
    await sendEmail({
      to: email,
      subject: 'Gestumio — Recibimos tu solicitud',
      html: `<p>Hola ${esc(nombre)},</p><p>Recibimos tu ${esBaja ? 'solicitud de baja de servicio' : 'pedido de arrepentimiento (revocación)'}. La procesaremos a la brevedad y te confirmaremos por este medio.</p><p>Gracias,<br>Equipo Gestumio</p>`,
    }).catch(() => {});
    res.json({ ok: true });
  } catch (e) {
    console.error('[legal]', e.message);
    res.status(500).json({ error: 'No se pudo enviar la solicitud. Por favor escribinos a ' + COMPANY_EMAIL });
  }
}

router.post('/arrepentimiento', (req, res) => handle(req, res, 'arrepentimiento'));
router.post('/baja', (req, res) => handle(req, res, 'baja'));

module.exports = router;
