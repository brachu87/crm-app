const nodemailer = require('nodemailer');

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

async function sendWelcomeEmail({ toEmail, toName, businessName }) {
  const transporter = getTransporter();
  if (!transporter) {
    console.log('[mailer] GMAIL_USER / GMAIL_APP_PASSWORD no configuradas, mail omitido');
    return;
  }

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

        <!-- Header -->
        <tr>
          <td style="background:#3D5A4C;padding:36px 40px;text-align:center;">
            <div style="display:inline-block;background:rgba(255,255,255,0.12);border-radius:12px;width:56px;height:56px;line-height:56px;font-size:32px;font-weight:900;color:#E8674A;text-align:center;">z</div>
            <div style="margin-top:12px;font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px;">zentric</div>
            <div style="margin-top:4px;font-size:12px;color:rgba(255,255,255,0.6);letter-spacing:0.08em;text-transform:uppercase;">Gestión inteligente para tu negocio</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 6px;font-size:23px;font-weight:700;color:#111;">¡Hola, ${toName}! 👋</p>
            <p style="margin:0 0 24px;font-size:15px;color:#4B5563;line-height:1.7;">
              Gracias por confiar en <strong style="color:#3D5A4C;">Zentric</strong> para gestionar <strong>${businessName}</strong>.<br/>
              Tu cuenta fue creada exitosamente.
            </p>

            <!-- Estado -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFBEB;border:1.5px solid #FCD34D;border-radius:10px;margin-bottom:28px;">
              <tr>
                <td style="padding:18px 22px;">
                  <p style="margin:0 0 5px;font-size:14px;font-weight:700;color:#92400E;">⏳ Tu cuenta está pendiente de activación</p>
                  <p style="margin:0;font-size:13px;color:#78350F;line-height:1.65;">
                    Una vez que confirmemos tu pago, activaremos tu acceso en menos de 24 horas hábiles.
                  </p>
                </td>
              </tr>
            </table>

            <!-- Pasos -->
            <p style="margin:0 0 18px;font-size:15px;font-weight:700;color:#111;">¿Qué hacer ahora?</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
              <tr>
                <td width="38" valign="top">
                  <div style="width:30px;height:30px;background:#3D5A4C;border-radius:50%;text-align:center;line-height:30px;font-size:13px;font-weight:700;color:#fff;">1</div>
                </td>
                <td style="font-size:14px;color:#374151;line-height:1.65;padding-top:4px;">
                  <strong>Si ya realizaste el pago</strong> — no hace falta que hagas nada más. Tu cuenta será aprobada en breve y recibirás acceso completo.
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td width="38" valign="top">
                  <div style="width:30px;height:30px;background:#E8674A;border-radius:50%;text-align:center;line-height:30px;font-size:13px;font-weight:700;color:#fff;">2</div>
                </td>
                <td style="font-size:14px;color:#374151;line-height:1.65;padding-top:4px;">
                  <strong>Si todavía no abonaste</strong> — escribinos por WhatsApp y te guiamos para completar tu suscripción.
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="https://wa.me/5491176353062?text=Hola%2C%20acabo%20de%20registrarme%20en%20Zentric%20y%20quiero%20activar%20mi%20cuenta"
                     style="display:inline-block;background:#25D366;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:0.01em;">
                    💬 Escribinos por WhatsApp
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F9FAFB;border-top:1px solid #E5E7EB;padding:22px 40px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;">
              Recibiste este mail porque alguien creó una cuenta en Zentric con esta dirección.
            </p>
            <p style="margin:0;font-size:12px;color:#9CA3AF;">
              © 2026 Zentric &nbsp;·&nbsp;
              <a href="https://wa.me/5491176353062" style="color:#3D5A4C;text-decoration:none;">Soporte</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: `"Zentric" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject: '¡Bienvenido a Zentric! Tu cuenta está siendo procesada 🎉',
      html,
    });
    console.log(`[mailer] Mail de bienvenida enviado a ${toEmail}`);
  } catch (err) {
    console.error('[mailer] Error al enviar mail:', err.message);
    // No lanzar — el registro no debe fallar por el mail
  }
}

module.exports = { sendWelcomeEmail };
