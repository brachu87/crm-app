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

const PORT = process.env.PORT || 4000;

// Barrido independiente de cuotas vencidas: al arrancar y cada hora
async function runOverdueSweep() {
  try {
    const count = await markOverdueCuotas();
    if (count > 0) console.log(`[auto-expiry] Marcadas ${count} cuotas como vencidas`);
  } catch (err) { console.error('[auto-expiry] Error:', err.message); }
}
runOverdueSweep();
setInterval(runOverdueSweep, 1000 * 60 * 60); // cada hora

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
