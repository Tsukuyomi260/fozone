import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect, useState } from 'react';
import { isAuthenticated, getCurrentUser } from './services/auth';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import WifiZones from './pages/WifiZones';
import WifiZoneDetail from './pages/WifiZoneDetail';
import Pricings from './pages/Pricings';
import Tickets from './pages/Tickets';
import Accounting from './pages/Accounting';
import Profile from './pages/Profile';
import BuyTicket from './pages/BuyTicket';
import PaymentReturn from './pages/PaymentReturn';
import Wallet from './pages/Wallet';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminWithdrawals from './pages/admin/AdminWithdrawals';
import AdminTenants from './pages/admin/AdminTenants';

function AppRoutes() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const authed = isAuthenticated();
    setAuthenticated(authed);
    // Le role vient du profil stocke au login: aucun compte promoteur ne
    // peut se pretendre super-admin cote client, la valeur vient du backend.
    setIsSuperAdmin(authed && getCurrentUser()?.role === 'super_admin');
    setLoading(false);
  }, [location]); // Re-vérifier à chaque changement de route

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Destination par defaut une fois authentifie: jamais melangee entre
  // l'espace plateforme et l'espace promoteur.
  const homePath = isSuperAdmin ? '/admin' : '/dashboard';

  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        {/* Routes publiques (pas d'authentification requise) */}
        <Route path="/buy/:zoneId" element={<BuyTicket />} />
        <Route path="/payment/return" element={<PaymentReturn />} />

        {/* Routes d'authentification */}
        <Route path="/login" element={!authenticated ? <Login /> : <Navigate to={homePath} replace />} />
        <Route path="/register" element={!authenticated ? <Register /> : <Navigate to={homePath} replace />} />

        {/* Espace plateforme: reserve au compte super-admin, qui ne possede */}
        {/* aucune zone et n'a rien a faire dans l'espace promoteur. */}
        <Route
          path="/admin"
          element={
            !authenticated ? <Navigate to="/login" replace />
            : isSuperAdmin ? <AdminLayout />
            : <Navigate to="/dashboard" replace />
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="withdrawals" element={<AdminWithdrawals />} />
          <Route path="tenants" element={<AdminTenants />} />
        </Route>

        {/* Espace promoteur: le super-admin n'y a pas sa place non plus. */}
        <Route
          path="/"
          element={
            !authenticated ? <Navigate to="/login" replace />
            : isSuperAdmin ? <Navigate to="/admin" replace />
            : <Layout />
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="zones" element={<WifiZones />} />
          <Route path="zones/:id" element={<WifiZoneDetail />} />
          <Route path="pricings" element={<Pricings />} />
          <Route path="tickets" element={<Tickets />} />
          <Route path="accounting" element={<Accounting />} />
          <Route path="wallet" element={<Wallet />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Routes>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
