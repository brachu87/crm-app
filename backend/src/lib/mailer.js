const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function sendWelcomeEmail({ toEmail, toName, businessName }) {
  if (!resend) {
    console.log('[mailer] RESEND_API_KEY no configurada, mail omitido');
    return;
  }

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Bienvenido a Zentric</title>
</head>
<body style="margin:0;padding:0;background-color:#FAF7F2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

          <!-- Header -->
          <tr>
            <td style="background:#3D5A4C;padding:32px 40px;text-align:center;">
              <table cellpadding="0" cellspacing="0" style="display:inline-table;">
                <tr>
                  <td style="background:#3D5A4C;border-radius:10px;width:48px;height:48px;text-align:center;vertical-align:middle;">
                    <span style="font-size:28px;font-weight:900;color:#E8674A;line-height:48px;">z</span>
                  </td>
                </tr>
              </table>
              <div style="margin-top:14px;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">zentric</div>
              <div style="margin-top:4px;font-size:13px;color:rgba(255,255,255,0.65);letter-spacing:0.05em;">GESTIÓN INTELIGENTE PARA TU NEGOCIO</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;">¡Hola, ${toName}! 👋</p>
              <p style="margin:0 0 24px;font-size:15px;color:#4B5563;line-height:1.6;">
                Gracias por confiar en <strong>Zentric</strong> para gestionar <strong>${businessName}</strong>. Tu cuenta fue creada exitosamente.
              </p>

              <!-- Status box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF9F0;border:1px solid #FDE68A;border-radius:10px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#92400E;">⏳ Tu cuenta está pendiente de activación</p>
                    <p style="margin:0;font-size:13px;color:#78350F;line-height:1.6;">
                      Una vez que confirmemos tu pago, activaremos tu acceso en menos de 24 horas.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Options -->
              <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#1a1a1a;">¿Qué hacer ahora?</p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                <tr>
                  <td width="40" valign="top" style="padding-top:2px;">
                    <div style="width:28px;height:28px;background:#3D5A4C;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:700;color:#fff;">1</div>
                  </td>
                  <td style="font-size:14px;color:#374151;line-height:1.6;">
                    <strong>Si ya realizaste el pago</strong> — tu cuenta será aprobada en breve. ¡No hace falta que hagas nada más!
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td width="40" valign="top" style="padding-top:2px;">
                    <div style="width:28px;height:28px;background:#E8674A;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:700;color:#fff;">2</div>
                  </td>
                  <td style="font-size:14px;color:#374151;line-height:1.6;">
                    <strong>Si todavía no abonaste</strong> — contactanos por WhatsApp y te ayudamos con los pasos para completar tu suscripción.
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://wa.me/5491176353062?text=Hola%2C%20acabo%20de%20registrarme%20en%20Zentric%20y%20quiero%20activar%20mi%20cuenta"
                       style="display:inline-block;background:#25D366;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;">
                      💬 Contactar por WhatsApp
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F3F4F6;padding:24px 40px;text-align:center;border-top:1px solid #E5E7EB;">
              <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;">
                Este mail fue enviado porque alguien se registró en Zentric con esta dirección.
              </p>
              <p style="margin:0;font-size:12px;color:#9CA3AF;">
                © 2026 Zentric · <a href="https://wa.me/5491176353062" style="color:#3D5A4C;text-decoration:none;">Soporte</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: 'Zentric <noreply@zentric.app>',
      to: toEmail,
      subject: '¡Bienvenido a Zentric! Tu cuenta está siendo procesada',
      html,
    });
    console.log(`[mailer] Mail de bienvenida enviado a ${toEmail}`);
  } catch (err) {
    console.error('[mailer] Error al enviar mail:', err.message);
    // No lanzar — el registro no debe fallar por el mail
  }
}

module.exports = { sendWelcomeEmail };
