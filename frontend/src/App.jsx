import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect, useState, lazy, Suspense } from 'react';
import { isAuthenticated, getCurrentUser } from './services/auth';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import PageFallback from './components/PageFallback';

// Apres un deploiement, un onglet reste ouvert reclame d'anciens fichiers qui
// n'existent plus chez Vercel: l'import echoue et la page reste blanche. On
// recharge une seule fois pour recuperer la nouvelle version; si l'echec
// persiste, l'erreur remonte normalement.
const RELOAD_FLAG = 'fozone-chunk-reload';

function lazyPage(importer) {
  return lazy(() =>
    importer()
      .then((module) => {
        try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* stockage indisponible */ }
        return module;
      })
      .catch((error) => {
        let alreadyReloaded = true;
        try {
          alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === '1';
          if (!alreadyReloaded) sessionStorage.setItem(RELOAD_FLAG, '1');
        } catch { /* stockage indisponible: pas de boucle de rechargement possible */ }

        if (!alreadyReloaded) {
          window.location.reload();
          return new Promise(() => {});
        }
        throw error;
      })
  );
}

// Chaque page est un fichier a part, telecharge a la premiere visite.
// Avant, tout arrivait en un bloc de 760 Ko: le client du portail captif
// recevait le tableau de bord et les graphiques de la compta pour acheter
// un ticket, sur le Wi-Fi le plus lent du parcours.
const Login = lazyPage(() => import('./pages/Login'));
const Register = lazyPage(() => import('./pages/Register'));
const Dashboard = lazyPage(() => import('./pages/Dashboard'));
const WifiZones = lazyPage(() => import('./pages/WifiZones'));
const WifiZoneDetail = lazyPage(() => import('./pages/WifiZoneDetail'));
const Pricings = lazyPage(() => import('./pages/Pricings'));
const Tickets = lazyPage(() => import('./pages/Tickets'));
const Accounting = lazyPage(() => import('./pages/Accounting'));
const Profile = lazyPage(() => import('./pages/Profile'));
const BuyTicket = lazyPage(() => import('./pages/BuyTicket'));
const PaymentReturn = lazyPage(() => import('./pages/PaymentReturn'));
const Wallet = lazyPage(() => import('./pages/Wallet'));
const AdminDashboard = lazyPage(() => import('./pages/admin/AdminDashboard'));
const AdminWithdrawals = lazyPage(() => import('./pages/admin/AdminWithdrawals'));
const AdminTenants = lazyPage(() => import('./pages/admin/AdminTenants'));

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
      {/* Filet pour les pages hors espace connecte (achat, login). Les pages */}
      {/* du tableau de bord ont leur propre attente dans Layout, pour que la */}
      {/* barre laterale reste affichee pendant le chargement. */}
      <Suspense fallback={<PageFallback fullScreen />}>
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
      </Suspense>
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
