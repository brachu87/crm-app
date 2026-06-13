import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Activities from './pages/Activities';
import ActivityDetail from './pages/ActivityDetail';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Collections from './pages/Collections';
import Employees from './pages/Employees';
import Expenses from './pages/Expenses';
import Reports from './pages/Reports';
import Suppliers from './pages/Suppliers';
import Notes from './pages/Notes';
import DailyCash from './pages/DailyCash';
import Settings from './pages/Settings';

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/registro" element={<PublicRoute><Register /></PublicRoute>} />

          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="actividades" element={<Activities />} />
            <Route path="actividades/:id" element={<ActivityDetail />} />
            <Route path="clientes" element={<Clients />} />
            <Route path="clientes/:id" element={<ClientDetail />} />
            <Route path="cobranza" element={<Collections />} />
            <Route path="empleados" element={<Employees />} />
            <Route path="gastos" element={<Expenses />} />
            <Route path="reportes" element={<Reports />} />
            <Route path="proveedores" element={<Suppliers />} />
            <Route path="agenda" element={<Notes />} />
            <Route path="caja" element={<DailyCash />} />
            <Route path="ajustes" element={<Settings />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
