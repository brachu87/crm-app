const express = require('express');
const router = express.Router();
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const authMiddleware = require('../middleware/auth');

const prisma = require('../prisma');

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';
const APP_URL = process.env.APP_URL || 'https://crm-app-production-0669.up.railway.app';
const BASE_PRICE = 1000;        // TEMPORAL (prueba MercadoPago): antes 50000. Restaurar a 50000 después de testear.
const EXTRA_USER_PRICE = 0;     // TEMPORAL (prueba): antes 20000. Restaurar a 20000.
const INCLUDED_USERS = 3;
const PRICE = BASE_PRICE;        // compatibilidad
const PLAN_DAYS = 30;

// Precio mensual del negocio segun sus usuarios extra
function monthlyPriceFor(biz) {
  return BASE_PRICE + EXTRA_USER_PRICE * (biz?.extraUsers || 0);
}

function getMpClient() {
  return new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });
}

// GET /api/billing/status — estado de suscripción del negocio
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const biz = await prisma.business.findUnique({ where: { id: req.user.businessId } });
    if (!biz) return res.status(404).json({ error: 'Negocio no encontrado' });
    const TRIAL_DAYS = 15;
    const createdAt = new Date(biz.createdAt);
    const trialEnds = new Date(createdAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const now = new Date();
    const trialDaysLeft = Math.max(0, Math.ceil((trialEnds - now) / (1000 * 60 * 60 * 24)));

    res.json({
      status: biz.subscriptionStatus || 'trial',
      expires: biz.subscriptionExpires || null,
      bonificado: biz.bonificado || false,
      trialEnds: trialEnds.toISOString(),
      trialDaysLeft,
      extraUsers: biz.extraUsers || 0,
      includedUsers: INCLUDED_USERS,
      userLimit: INCLUDED_USERS + (biz.extraUsers || 0),
      monthlyPrice: monthlyPriceFor(biz),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/billing/preference — crea preferencia MP y devuelve el link de pago
router.post('/preference', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ error: 'Solo el propietario puede gestionar la facturación' });

    const biz = await prisma.business.findUnique({ where: { id: req.user.businessId } });
    if (!biz) return res.status(404).json({ error: 'Negocio no encontrado' });

    const client = getMpClient();
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [
          {
            id: `gestumio-plan-${biz.id}`,
            title: 'Gestumio — Plan Mensual',
            description: (biz.extraUsers || 0) > 0
              ? `Suscripción mensual para ${biz.name} (3 usuarios incluidos + ${biz.extraUsers} extra)`
              : `Suscripción mensual para ${biz.name}`,
            quantity: 1,
            currency_id: 'ARS',
            unit_price: monthlyPriceFor(biz),
          },
        ],
        payer: {
          email: req.user.email,
        },
        external_reference: biz.id,
        back_urls: {
          success: `${APP_URL}/settings?payment=success`,
          failure: `${APP_URL}/settings?payment=failure`,
          pending: `${APP_URL}/settings?payment=pending`,
        },
        auto_return: 'approved',
        notification_url: `${APP_URL}/api/billing/webhook`,
        statement_descriptor: 'GESTUMIO',
        expires: false,
      },
    });

    res.json({ init_point: result.init_point, preference_id: result.id });
  } catch (e) {
    console.error('[billing] preference error:', e);
    res.status(500).json({ error: e.message });
  }
});


// GET /api/billing/public-checkout — sin auth, crea preferencia y redirige a MP
router.get('/public-checkout', async (req, res) => {
  try {
    const client = getMpClient();
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [
          {
            id: 'gestumio-plan-publico',
            title: 'Gestumio — Plan Mensual',
            description: 'Gestión completa de tu negocio. 15 días de prueba gratuita incluidos.',
            quantity: 1,
            currency_id: 'ARS',
            unit_price: PRICE,
          },
        ],
        back_urls: {
          success: `${APP_URL}/registro?payment=success`,
          failure:  `${APP_URL}/registro?payment=failure`,
          pending:  `${APP_URL}/registro?payment=pending`,
        },
        auto_return: 'approved',
        notification_url: `${APP_URL}/api/billing/webhook`,
        statement_descriptor: 'GESTUMIO',
        expires: false,
      },
    });

    res.redirect(result.init_point);
  } catch (e) {
    console.error('[billing] public-checkout error:', e);
    res.status(500).send('Error al generar el link de pago. Intentá más tarde.');
  }
});

// POST /api/billing/webhook — notificación de pago de Mercado Pago (sin auth)
router.post('/webhook', express.json(), async (req, res) => {
  try {
    // ── Verificar firma HMAC de MercadoPago ──────────────────────────────
    const webhookSecret = process.env.MP_WEBHOOK_SECRET;
    if (webhookSecret) {
      const xSignature = req.headers['x-signature'];
      const xRequestId = req.headers['x-request-id'];
      const dataId = req.body?.data?.id;

      if (!xSignature) {
        console.warn('[billing] Webhook sin x-signature rechazado');
        return res.sendStatus(401);
      }

      // Extraer ts y v1 del header x-signature: "ts=...,v1=..."
      const parts = {};
      xSignature.split(',').forEach(part => {
        const [k, v] = part.split('=');
        if (k && v) parts[k.trim()] = v.trim();
      });

      if (parts.ts && parts.v1) {
        const crypto = require('crypto');
        const manifest = `id:${dataId};request-id:${xRequestId};ts:${parts.ts};`;
        const expected = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex');
        if (expected !== parts.v1) {
          console.warn('[billing] Firma de webhook inválida');
          return res.sendStatus(401);
        }
      }
    }

    res.sendStatus(200); // responder rápido a MP

    const { type, data } = req.body;
    if (type !== 'payment' || !data?.id) return;

    const client = getMpClient();
    const paymentClient = new Payment(client);
    const payment = await paymentClient.get({ id: data.id });

    if (payment.status !== 'approved') return;

    const businessId = payment.external_reference;
    if (!businessId) return;

    const now = new Date();
    const expires = new Date(now.getTime() + PLAN_DAYS * 24 * 60 * 60 * 1000);

    await prisma.business.update({
      where: { id: businessId },
      data: {
        subscriptionStatus: 'active',
        subscriptionExpires: expires,
      },
    });

    // Also approve the account if it was pending
    await prisma.business.updateMany({
      where: { id: businessId, approved: false },
      data: { approved: true, approvedAt: new Date() },
    });

    console.log(`[billing] Pago aprobado para negocio ${businessId} — activo hasta ${expires.toISOString()}`);
  } catch (e) {
    console.error('[billing] webhook error:', e.message);
  }
});

module.exports = router;
