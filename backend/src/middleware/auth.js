const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Photo endpoints need token in query param (for <img src="...?token=...">)
// Only allow it for that specific pattern.
const QUERY_TOKEN_PATHS = ['/photo', '/logo'];

function authMiddleware(req, res, next) {
  let token = null;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    token = header.split(' ')[1];
  } else if (req.query.token && QUERY_TOKEN_PATHS.some(p => req.path.endsWith(p))) {
    // Only allow ?token= for photo serving routes
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Token no provisto' });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('[FATAL] JWT_SECRET env var not set');
    return res.status(500).json({ error: 'Error de configuración del servidor' });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// Middleware that also checks subscription is not expired
// Use this on non-auth routes that need an active account
async function subscriptionCheck(req, res, next) {
  try {
    const biz = await prisma.$queryRawUnsafe(
      `SELECT "subscriptionStatus", "bonificado" FROM "Business" WHERE id = ? LIMIT 1`,
      req.user.businessId
    );
    if (!biz || biz.length === 0) return res.status(403).json({ error: 'Negocio no encontrado' });
    const { subscriptionStatus, bonificado } = biz[0];
    const isBonif = bonificado === 1 || bonificado === true;
    if (subscriptionStatus === 'expired' && !isBonif) {
      return res.status(402).json({
        error: 'Tu período de prueba ha vencido. Realizá el pago para continuar usando Zentric.',
        code: 'SUBSCRIPTION_EXPIRED',
      });
    }
    next();
  } catch (err) {
    console.error('[subscriptionCheck]', err.message);
    next(); // fail open to avoid blocking on DB errors
  }
}

module.exports = authMiddleware;
module.exports.subscriptionCheck = subscriptionCheck;
