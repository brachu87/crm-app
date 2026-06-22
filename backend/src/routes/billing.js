const express = require('express');
const router = express.Router();
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');

const prisma = new PrismaClient();

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';
const APP_URL = process.env.APP_URL || 'https://crm-app-production-0669.up.railway.app';
const PRICE = 75000;
const PLAN_DAYS = 30;

function getMpClient() {
  return new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });
}

// GET /api/billing/status — estado de suscripción del negocio
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const biz = await prisma.business.findUnique({ where: { id: req.user.businessId } });
    if (!biz) return res.status(404).json({ error: 'Negocio no encontrado' });
    const TRIAL_DAYS = 14;
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
            id: `zentric-plan-${biz.id}`,
            title: 'Zentric — Plan Mensual',
            description: `Suscripción mensual para ${biz.name}`,
            quantity: 1,
            currency_id: 'ARS',
            unit_price: PRICE,
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
        statement_descriptor: 'ZENTRIC',
        expires: false,
      },
    });

    res.json({ init_point: result.init_point, preference_id: result.id });
  } catch (e) {
    console.error('[billing] preference error:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/billing/webhook — notificación de pago de Mercado Pago (sin auth)
router.post('/webhook', express.json(), async (req, res) => {
  try {
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
    await prisma.$executeRawUnsafe(
      `UPDATE "Business" SET approved = 1, "approvedAt" = datetime('now') WHERE id = ? AND approved = 0`,
      businessId
    );

    console.log(`[billing] Pago aprobado para negocio ${businessId} — activo hasta ${expires.toISOString()}`);
  } catch (e) {
    console.error('[billing] webhook error:', e.message);
  }
});

module.exports = router;
