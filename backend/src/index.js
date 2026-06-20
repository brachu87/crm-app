require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { markOverdueCuotas } = require('./lib/overdue');

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

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
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
app.use('/api/clients', photosRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/branches', branchesRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/appointments', appointmentsRoutes);
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

async function ensureManualIncomeTable() {
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
async function runOverdueSweep() {
  try {
    const count = await markOverdueCuotas();
    if (count > 0) console.log(`[auto-expiry] Marcadas ${count} cuotas como vencidas`);
  } catch (err) { console.error('[auto-expiry] Error:', err.message); }
}
ensureManualIncomeTable();
ensurePermissionsColumn();
runOverdueSweep();
setInterval(runOverdueSweep, 1000 * 60 * 60); // cada hora

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
