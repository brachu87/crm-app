require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const prisma = require('./prisma');

const authRoutes = require('./routes/auth');
const clientsRoutes = require('./routes/clients');
const activitiesRoutes = require('./routes/activities');
const enrollmentsRoutes = require('./routes/enrollments');
const dashboardRoutes = require('./routes/dashboard');
const employeesRoutes = require('./routes/employees');
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

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/enrollments', enrollmentsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/employees', employeesRoutes);
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

// Auto-mark overdue enrollments daily
async function markOverdueEnrollments() {
  try {
    const now = new Date();
    const result = await prisma.cuota.updateMany({
      where: { paymentStatus: 'pending', dueDate: { lt: now } },
      data: { paymentStatus: 'overdue' },
    });
    if (result.count > 0) console.log(`[auto-expiry] Marcadas ${result.count} cuotas como vencidas`);
  } catch (err) { console.error('[auto-expiry] Error:', err.message); }
}
markOverdueEnrollments();
setInterval(markOverdueEnrollments, 1000 * 60 * 60 * 24); // cada 24h

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
