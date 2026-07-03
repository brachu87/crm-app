require('dotenv').config();
const Sentry = require('./instrument');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { markOverdueCuotas } = require('./lib/overdue');

const authMiddleware = require('./middleware/auth');
const { subscriptionCheck } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const manualIncomeRoutes = require('./routes/manual-income');
const clientsRoutes = require('./routes/clients');
const activitiesRoutes = require('./routes/activities');
const enrollmentsRoutes = require('./routes/enrollments');
const dashboardRoutes = require('./routes/dashboard');
const employeesRoutes = require('./routes/employees');
const attendanceRoutes = require('./routes/attendance');
const payrollRoutes = require('./routes/payroll');
const expensesRoutes = require('./routes/expenses');
const suppliersRoutes = require('./routes/suppliers');
const notesRoutes = require('./routes/notes');
const dailyCashRoutes = require('./routes/dailyCash');
const reportsRoutes = require('./routes/reports');
const usersRoutes = require('./routes/users');
const searchRoutes = require('./routes/search');
const accountMovementsRoutes = require('./routes/account-movements');
const photosRoutes = require('./routes/photos');
const businessRoutes = require('./routes/business');
const branchesRoutes = require('./routes/branches');
const schedulesRoutes = require('./routes/schedules');
const servicesRoutes = require('./routes/services');
const appointmentsRoutes = require('./routes/appointments');
const billingRoutes = require('./routes/billing');
const pricesRoutes = require('./routes/prices');
const whatsappRoutes = require('./routes/whatsapp');
const portalRoutes = require('./routes/portal');
const googleCalendarRoutes = require('./routes/google-calendar');
const supportRoutes = require('./routes/support');
const { startReminderCron } = require('./lib/reminderCron');

const app = express();

// Detrás del proxy de Railway: necesario para X-Forwarded-For (rate-limit) y https.
app.set('trust proxy', 1);

// ── Security headers ───────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,              // app uses inline scripts/styles
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow logo/photo serving
  crossOriginEmbedderPolicy: false,          // avoid breaking image loads
}));
app.disable('x-powered-by');

// ── CORS ───────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  process.env.APP_URL,
  ...(process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  'https://gestumio.com',
  'https://www.gestumio.com',
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

function corsAllowed(origin) {
  if (!origin) return true; // curl, apps móviles, same-origin
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const h = new URL(origin).hostname;
    // Permitir el propio dominio de la app en Railway y gestumio.com (robusto a cambios de URL)
    if (h.endsWith('.up.railway.app')) return true;
    if (h === 'gestumio.com' || h.endsWith('.gestumio.com')) return true;
  } catch (_) {}
  return false;
}

app.use(cors({
  origin: (origin, cb) => (corsAllowed(origin) ? cb(null, true) : cb(new Error('Not allowed by CORS'))),
  credentials: true,
}));

// ── Global rate limiting (DDoS / scraping protection) ──────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // la app carga muchas imágenes (fotos de clientes, logo) por página
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta en unos minutos.' },
  skip: (req) => {
    const u = req.originalUrl || '';
    return u.includes('/photo') || u.includes('/logo') || u.includes('/business/info');
  },
});
app.use('/api/', globalLimiter);

// ── Strict rate limit on auth endpoints ────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // max 20 login/register attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Esperá 15 minutos.' },
});
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Global auth: runs for all /api/ routes except public ones.
// Routes that have their own router.use(authMiddleware) are harmlessly double-verified.
const PUBLIC_API_PATHS = [
  '/api/auth/',
  '/api/admin/',
  '/api/portal/',
  '/api/billing/webhook',
  '/api/google-calendar/callback',
];
app.use('/api/', (req, res, next) => {
  const fullPath = '/api' + req.path;
  if (PUBLIC_API_PATHS.some(p => fullPath.startsWith(p))) return next();
  return authMiddleware(req, res, next);
});

// Global subscription check: runs after authMiddleware sets req.user.
// Blocks expired accounts from accessing data routes.
const SUBSCRIPTION_EXEMPT = [
  '/api/auth/',
  '/api/admin/',
  '/api/portal/',
  '/api/billing/',
  '/api/google-calendar/',
];
app.use('/api/', (req, res, next) => {
  const fullPath = '/api' + req.path;
  if (SUBSCRIPTION_EXEMPT.some(p => fullPath.startsWith(p))) return next();
  return subscriptionCheck(req, res, next);
});

// ── Rate limit on file upload endpoints ────────────────────────
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 60, // max subidas por hora por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Límite de subida de archivos alcanzado. Intentá en 1 hora.' },
  skip: (req) => req.method === 'GET', // las lecturas de fotos/logo NO cuentan como subida
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/manual-income', manualIncomeRoutes);

// Panel de administración — solo accesible en /admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-panel.html'));
});
app.use('/api/clients', clientsRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/enrollments', enrollmentsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/daily-cash', dailyCashRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/clients', uploadLimiter, photosRoutes);
app.use('/api/business', uploadLimiter, businessRoutes);
app.use('/api/branches', branchesRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/prices', pricesRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/google-calendar', googleCalendarRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/clients/:id/account', accountMovementsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Servir frontend en producción
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.use((req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}


const prisma = require('./prisma');


async function ensureBusinessExtraFields() {
  if ((process.env.DATABASE_URL || '').startsWith('postgres')) return; // PG: esquema via db push
  const cols = [
    ['cuit',      'TEXT'],
    ['address',   'TEXT'],
    ['email',     'TEXT'],
    ['website',   'TEXT'],
    ['instagram', 'TEXT'],
  ];
  for (const [col, type] of cols) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Business" ADD COLUMN "${col}" ${type}`);
    } catch (_) { /* column already exists */ }
  }
}

async function ensureManualIncomeTable() {
  if ((process.env.DATABASE_URL || '').startsWith('postgres')) return; // PG: esquema via db push
  try {
    const tables = await prisma.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='ManualIncome'`
    );
    if (tables.length === 0) {
      console.log('[startup] Creando tabla ManualIncome...');
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ManualIncome" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "businessId" TEXT NOT NULL,
          "clientId" TEXT,
          "amount" REAL NOT NULL,
          "description" TEXT NOT NULL,
          "category" TEXT NOT NULL DEFAULT 'Otro',
          "date" TEXT NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "ManualIncome_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
          CONSTRAINT "ManualIncome_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
        )
      `);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ManualIncome_businessId_idx" ON "ManualIncome"("businessId")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ManualIncome_clientId_idx" ON "ManualIncome"("clientId")`);
      console.log('[startup] Tabla ManualIncome creada.');
    }
  } catch (err) {
    console.error('[startup] ensureManualIncomeTable error:', err.message);
  }
}


async function ensurePermissionsColumn() {
  if ((process.env.DATABASE_URL || '').startsWith('postgres')) return; // PG: esquema via db push
  try {
    const info = await prisma.$queryRawUnsafe(`PRAGMA table_info("User")`);
    const exists = info.some(col => col.name === 'permissions');
    if (!exists) {
      console.log('[startup] Agregando columna permissions a User...');
      await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "permissions" TEXT`);
      console.log('[startup] Columna permissions agregada.');
    }
  } catch (err) {
    console.error('[startup] ensurePermissionsColumn error:', err.message);
  }
}

const PORT = process.env.PORT || 4000;

// Barrido independiente de cuotas vencidas: al arrancar y cada hora
async function ensureSubscriptionFields() {
  if ((process.env.DATABASE_URL || '').startsWith('postgres')) return; // PG: esquema via db push
  try {
    const cols = await prisma.$queryRawUnsafe(`PRAGMA table_info("Business")`);
    const names = cols.map(r => r.name);
    if (!names.includes('subscriptionStatus')) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Business" ADD COLUMN "subscriptionStatus" TEXT NOT NULL DEFAULT 'trial'`);
      console.log('[startup] Added subscriptionStatus column');
    }
    if (!names.includes('subscriptionExpires')) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Business" ADD COLUMN "subscriptionExpires" DATETIME`);
      console.log('[startup] Added subscriptionExpires column');
    }
  } catch (err) {
    console.error('[startup] ensureSubscriptionFields error:', err.message);
  }
}

async function ensureClientCuit() {
  if ((process.env.DATABASE_URL || '').startsWith('postgres')) return; // PG: esquema via db push
  try {
    const cols = await prisma.$queryRawUnsafe(`PRAGMA table_info("Client")`);
    if (!cols.some(r => r.name === 'cuit')) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Client" ADD COLUMN "cuit" TEXT`);
      console.log('[startup] Added cuit to Client');
    }
  } catch (err) {
    console.error('[startup] ensureClientCuit error:', err.message);
  }
}

async function ensureSupplierDni() {
  if ((process.env.DATABASE_URL || '').startsWith('postgres')) return; // PG: esquema via db push
  try {
    const cols = await prisma.$queryRawUnsafe(`PRAGMA table_info("Supplier")`);
    if (!cols.some(r => r.name === 'dni')) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Supplier" ADD COLUMN "dni" TEXT`);
      console.log('[startup] Added dni to Supplier');
    }
  } catch (err) {
    console.error('[startup] ensureSupplierDni error:', err.message);
  }
}

async function ensureSupplierIdOnExpense() {
  if ((process.env.DATABASE_URL || '').startsWith('postgres')) return; // PG: esquema via db push
  try {
    const cols = await prisma.$queryRawUnsafe(`PRAGMA table_info("Expense")`);
    if (!cols.some(r => r.name === 'supplierId')) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Expense" ADD COLUMN "supplierId" TEXT REFERENCES "Supplier"("id") ON DELETE SET NULL`);
      console.log('[startup] Added supplierId to Expense');
    }
  } catch (err) {
    console.error('[startup] ensureSupplierIdOnExpense error:', err.message);
  }
}

async function ensureLastAccessAndBonificado() {
  if ((process.env.DATABASE_URL || '').startsWith('postgres')) return; // PG: esquema via db push
  try {
    const userCols = await prisma.$queryRawUnsafe(`PRAGMA table_info("User")`);
    const userNames = userCols.map(r => r.name);
    if (!userNames.includes('lastAccessAt')) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "lastAccessAt" DATETIME`);
      console.log('[startup] Added lastAccessAt column to User');
    }
    const bizCols = await prisma.$queryRawUnsafe(`PRAGMA table_info("Business")`);
    const bizNames = bizCols.map(r => r.name);
    if (!bizNames.includes('bonificado')) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Business" ADD COLUMN "bonificado" INTEGER NOT NULL DEFAULT 0`);
      console.log('[startup] Added bonificado column to Business');
    }
  } catch (err) {
    console.error('[startup] ensureLastAccessAndBonificado error:', err.message);
  }
}


async function ensureBecaPrices() {
  try {
    // Becas viejas guardaban amountDue=0 (se perdía el precio real). Restaurar desde el
    // precio de la actividad, así cuando la beca vence vuelve a cobrar el monto correcto.
    // La nueva lógica mantiene la cuota en $0 mientras la beca esté vigente.
    const becas = await prisma.enrollment.findMany({
      where: { bonificada: true, amountDue: 0 },
      include: { activity: { select: { price: true } } },
    });
    let fixed = 0;
    for (const e of becas) {
      const price = e.activity && e.activity.price ? e.activity.price : 0;
      if (price > 0) {
        await prisma.enrollment.update({ where: { id: e.id }, data: { amountDue: price } });
        fixed++;
      }
    }
    if (fixed) console.log(`[startup] Becas: precio restaurado en ${fixed} inscripcion(es)`);
  } catch (err) {
    console.error('[startup] ensureBecaPrices error:', err.message);
  }
}

async function ensureGcalColumns() {
  if ((process.env.DATABASE_URL || '').startsWith('postgres')) return; // PG: esquema via db push
  try {
    const biz = await prisma.$queryRawUnsafe('PRAGMA table_info("Business")');
    const bcols = biz.map((c) => c.name);
    const addBiz = async (col, ddl) => { if (!bcols.includes(col)) await prisma.$executeRawUnsafe(`ALTER TABLE "Business" ADD COLUMN ${ddl}`); };
    await addBiz('googleCalendarToken', '"googleCalendarToken" TEXT');
    await addBiz('googleCalendarId', '"googleCalendarId" TEXT');
    await addBiz('gcalSyncTurnos', '"gcalSyncTurnos" INTEGER NOT NULL DEFAULT 0');
    await addBiz('gcalSyncAgenda', '"gcalSyncAgenda" INTEGER NOT NULL DEFAULT 0');
    await addBiz('gcalSyncClases', '"gcalSyncClases" INTEGER NOT NULL DEFAULT 0');
    for (const t of ['Appointment', 'Note', 'ClassSchedule']) {
      const info = await prisma.$queryRawUnsafe(`PRAGMA table_info("${t}")`);
      if (!info.map((c) => c.name).includes('gcalEventId')) {
        await prisma.$executeRawUnsafe(`ALTER TABLE "${t}" ADD COLUMN "gcalEventId" TEXT`);
      }
    }
  } catch (err) {
    console.error('[startup] ensureGcalColumns error:', err.message);
  }
}

async function ensureWATemplateColumns() {
  if ((process.env.DATABASE_URL || '').startsWith('postgres')) return; // PG: esquema via db push
  try {
    const cols = await prisma.$queryRawUnsafe(`PRAGMA table_info("Business")`);
    const names = cols.map(r => r.name);
    if (!names.includes('waTemplateExpiring')) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Business" ADD COLUMN "waTemplateExpiring" TEXT`);
      console.log('[startup] Added waTemplateExpiring column');
    }
    if (!names.includes('waTemplateOverdue')) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Business" ADD COLUMN "waTemplateOverdue" TEXT`);
      console.log('[startup] Added waTemplateOverdue column');
    }
    if (!names.includes('waTemplateAppointment')) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Business" ADD COLUMN "waTemplateAppointment" TEXT`);
      console.log('[startup] Added waTemplateAppointment column');
    }
    if (!names.includes('enabledModules')) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Business" ADD COLUMN "enabledModules" TEXT`);
      console.log('[startup] Added enabledModules column');
    }
    if (!names.includes('waAutoReminders')) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Business" ADD COLUMN "waAutoReminders" INTEGER NOT NULL DEFAULT 0`);
      console.log('[startup] Added waAutoReminders column');
    }
  } catch (err) {
    console.error('[startup] ensureWATemplateColumns error:', err.message);
  }
}

async function sweepExpiredTrials() {
  try {
    // Trial = 15 days from createdAt. Auto-expire and block access.
    // Trial vencido = creado hace más de 15 días. Prisma (agnóstico a la base).
    const cutoff = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    const result = await prisma.business.updateMany({
      where: {
        subscriptionStatus: 'trial',
        bonificado: false,
        createdAt: { lt: cutoff },
      },
      data: { subscriptionStatus: 'expired', approved: false },
    });
    if (result.count > 0) console.log(`[trial-sweep] Expired ${result.count} trial account(s)`);
  } catch (err) {
    console.error('[trial-sweep] error:', err.message);
  }
}

async function runOverdueSweep() {
  try {
    const count = await markOverdueCuotas();
    if (count > 0) console.log(`[auto-expiry] Marcadas ${count} cuotas como vencidas`);
  } catch (err) { console.error('[auto-expiry] Error:', err.message); }
}
ensureClientCuit();
ensureSupplierDni();
ensureBusinessExtraFields();
ensureManualIncomeTable();
ensurePermissionsColumn();
ensureSubscriptionFields();
ensureLastAccessAndBonificado();
ensureSupplierIdOnExpense();
sweepExpiredTrials();
ensureWATemplateColumns();
ensureGcalColumns();
ensureBecaPrices();

runOverdueSweep();
setInterval(runOverdueSweep, 1000 * 60 * 60); // cada hora
setInterval(sweepExpiredTrials, 1000 * 60 * 60); // revisar trials vencidos cada hora

// Recordatorios por WhatsApp (Meta Cloud API) — envío manual desde la app.
// startReminderCron(); // Barrido automático diario (desactivado; se dispara manualmente)

// Sentry: capturar errores de request que se propaguen a Express (después de las rutas).
if (Sentry && process.env.SENTRY_DSN && typeof Sentry.setupExpressErrorHandler === 'function') {
  try { Sentry.setupExpressErrorHandler(app); } catch (e) { console.warn('[sentry] error handler:', e.message); }
}

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
