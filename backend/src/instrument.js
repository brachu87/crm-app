// Inicialización de Sentry (observabilidad de errores en producción).
// Se activa SOLO si existe la variable de entorno SENTRY_DSN (se configura en Railway).
// Si no está, la app funciona igual sin enviar nada.
let Sentry = null;
try {
  Sentry = require('@sentry/node');
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'production',
      // Muestreo de performance (0 = solo errores). Ajustable por env.
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
      sendDefaultPii: false, // no enviar datos personales por defecto
    });
    console.log('[sentry] Observabilidad activada (env=' + (process.env.NODE_ENV || 'production') + ').');
  }
} catch (e) {
  console.warn('[sentry] No se pudo inicializar (se continúa sin observabilidad):', e.message);
}

module.exports = Sentry;
