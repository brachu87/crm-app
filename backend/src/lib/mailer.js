const nodemailer = require('nodemailer');

function getTransporter() {
  // SMTP genérico (Zoho, hosting/cPanel, Microsoft 365, etc.)
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const secure = process.env.SMTP_SECURE != null
      ? String(process.env.SMTP_SECURE) === 'true'
      : port === 465; // 465 => SSL; 587 => STARTTLS
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  // Fallback: Gmail (compatibilidad con configuración anterior)
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

// Dirección remitente. Prioriza MAIL_FROM, luego el usuario SMTP, luego Gmail.
function mailFrom() {
  const addr = process.env.MAIL_FROM || process.env.SMTP_USER || process.env.GMAIL_USER || '';
  return `"Gestumio" <${addr}>`;
}

function fromAddress() {
  return process.env.MAIL_FROM || process.env.SMTP_USER || process.env.GMAIL_USER || '';
}

function isEmailConfigured() {
  return !!(process.env.BREVO_API_KEY || getTransporter());
}

// Envío unificado: prioriza la API HTTP de Brevo (HTTPS, no usa puertos SMTP), luego SMTP.
async function deliver({ to, subject, html }) {
  if (process.env.BREVO_API_KEY) {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
        'accept': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: fromAddress(), name: 'Gestumio' },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    if (!(res.status >= 200 && res.status < 300)) {
      const t = await res.text().catch(() => '');
      throw new Error(`Brevo API ${res.status}: ${t}`);
    }
    return true;
  }
  const transporter = getTransporter();
  if (!transporter) throw new Error('Email no configurado (falta BREVO_API_KEY o SMTP_*)');
  await transporter.sendMail({ from: mailFrom(), to, subject, html });
  return true;
}

async function sendWelcomeEmail({ toEmail, toName, businessName }) {
  if (!isEmailConfigured()) { console.log('[mailer] Email no configurado, bienvenida omitida'); return; }

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:40px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

        <!-- Header -->
        <tr>
          <td style="background:#1E2A38;padding:36px 40px;text-align:center;">
            <div style="font-size:30px;font-weight:800;color:#fff;letter-spacing:-0.5px;">Gestumio</div>
            <div style="margin-top:6px;font-size:12px;color:#7DD3A0;letter-spacing:0.08em;text-transform:uppercase;">Gestión inteligente para tu negocio</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 8px;">
            <p style="margin:0 0 6px;font-size:23px;font-weight:700;color:#111;">¡Bienvenido, ${toName}! 👋</p>
            <p style="margin:0 0 22px;font-size:15px;color:#4B5563;line-height:1.7;">
              Gracias por sumarte a <strong style="color:#1BA84C;">Gestumio</strong> para gestionar <strong>${businessName}</strong>.
              Tu cuenta ya está activa y tenés <strong>15 días de prueba gratuita</strong> para usar todo el sistema.
            </p>

            <!-- Qué es -->
            <p style="margin:0 0 10px;font-size:15px;font-weight:700;color:#111;">¿Qué es Gestumio?</p>
            <p style="margin:0 0 22px;font-size:14px;color:#374151;line-height:1.7;">
              Es el sistema todo-en-uno para administrar tu negocio desde un solo lugar: clientes, cobranzas y pagos,
              caja diaria, agenda y turnos, actividades y servicios, empleados y sueldos, proveedores y reportes.
              Todo simple, ordenado y accesible desde cualquier dispositivo.
            </p>

            <!-- Contacto -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;margin-bottom:26px;">
              <tr><td style="padding:20px 22px;">
                <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#1E2A38;">📩 Nuestros canales de contacto</p>
                <p style="margin:0 0 8px;font-size:14px;color:#374151;line-height:1.6;">
                  <strong>Soporte técnico:</strong> <a href="mailto:soporte@gestumio.com" style="color:#1BA84C;text-decoration:none;">soporte@gestumio.com</a>
                </p>
                <p style="margin:0 0 8px;font-size:14px;color:#374151;line-height:1.6;">
                  <strong>Administración y pagos:</strong> <a href="mailto:administracion@gestumio.com" style="color:#1BA84C;text-decoration:none;">administracion@gestumio.com</a>
                </p>
                <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
                  <strong>WhatsApp:</strong> <a href="https://wa.me/5491178236708" style="color:#25D366;text-decoration:none;">+54 9 11 7823-6708</a>
                </p>
              </td></tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="https://wa.me/5491178236708?text=Hola%2C%20acabo%20de%20crear%20mi%20cuenta%20en%20Gestumio%20y%20tengo%20una%20consulta"
                   style="display:inline-block;background:#25D366;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:8px;">
                  💬 Escribinos por WhatsApp
                </a>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F9FAFB;border-top:1px solid #E5E7EB;padding:22px 40px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;">
              Recibiste este mail porque se creó una cuenta en Gestumio con esta dirección.
            </p>
            <p style="margin:0;font-size:12px;color:#9CA3AF;">
              © 2026 Gestumio &nbsp;·&nbsp;
              <a href="mailto:soporte@gestumio.com" style="color:#1BA84C;text-decoration:none;">soporte@gestumio.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await deliver({ to: toEmail, subject: '¡Bienvenido a Gestumio! 🎉', html });
    console.log(`[mailer] Mail de bienvenida enviado a ${toEmail}`);
  } catch (err) {
    console.error('[mailer] Error al enviar mail:', err.message);
    // No lanzar — el registro no debe fallar por el mail
  }
}

async function sendPasswordResetEmail({ toEmail, toName, resetUrl }) {
  if (!isEmailConfigured()) { console.log('[mailer] Email no configurado, reset omitido'); return false; }
  const html = `
<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <tr><td style="background:#1BA84C;padding:32px 40px;text-align:center;">
          <div style="font-size:26px;font-weight:800;color:#fff;letter-spacing:-0.5px;">Gestumio</div>
        </td></tr>
        <tr><td style="padding:36px 40px 28px;">
          <p style="margin:0 0 6px;font-size:21px;font-weight:700;color:#111;">Hola${toName ? ', ' + toName : ''} 👋</p>
          <p style="margin:0 0 22px;font-size:15px;color:#4B5563;line-height:1.7;">
            Recibimos un pedido para <strong>restablecer la contraseña</strong> de tu cuenta de Gestumio.
            Tocá el botón para crear una nueva. El enlace vence en <strong>1 hora</strong>.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="${resetUrl}" style="display:inline-block;background:#1BA84C;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:8px;">Crear nueva contraseña</a>
          </td></tr></table>
          <p style="margin:22px 0 0;font-size:13px;color:#6B7280;line-height:1.6;">
            Si no fuiste vos, ignorá este mail: tu contraseña no cambia hasta que uses el enlace.<br/>
            Si el botón no funciona, copiá y pegá este enlace:<br/>
            <span style="color:#1BA84C;word-break:break-all;">${resetUrl}</span>
          </p>
        </td></tr>
        <tr><td style="background:#F9FAFB;border-top:1px solid #E5E7EB;padding:18px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9CA3AF;">© 2026 Gestumio · <a href="https://wa.me/5491178236708" style="color:#1BA84C;text-decoration:none;">Soporte</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  try {
    await deliver({ to: toEmail, subject: 'Restablecé tu contraseña de Gestumio', html });
    console.log(`[mailer] Mail de reset enviado a ${toEmail}`);
    return true;
  } catch (err) {
    console.error('[mailer] Error al enviar reset:', err.message);
    return false;
  }
}

// Envía un mail de prueba y devuelve el resultado (para diagnóstico desde el admin).
async function sendTest(toEmail) {
  if (!isEmailConfigured()) {
    return { ok: false, reason: 'Email no configurado (falta BREVO_API_KEY, o SMTP_HOST/USER/PASS).' };
  }
  try {
    await deliver({ to: toEmail, subject: 'Prueba de correo — Gestumio', html: '<p>Este es un mail de prueba de Gestumio. Si lo recibís, el envío está funcionando ✅</p>' });
    return { ok: true, from: fromAddress() };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

module.exports = { sendWelcomeEmail, sendPasswordResetEmail, sendTest };
