import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Moon, Sun, Menu, X, LayoutDashboard, Wallet, Users, LogOut } from 'lucide-react';
import { logout, getCurrentUser } from '../services/auth';
import Logo from './Logo';

/**
 * Arbre de navigation entierement separe de Layout.jsx (espace promoteur).
 * Le compte super-admin ne possede aucune zone: il n'a rien a faire dans
 * l'espace promoteur, et un promoteur n'a rien a faire ici (garde dans
 * App.jsx). Design volontairement identique (memes tokens de couleur) pour
 * rester dans le meme systeme visuel, mais aucun composant partage entre
 * les deux arbres.
 */
export default function AdminLayout() {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true' ||
           (!localStorage.getItem('darkMode') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setUser(getCurrentUser());
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('darkMode', next.toString());
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'Vue plateforme', end: true },
    { path: '/admin/withdrawals', icon: Wallet, label: 'Retraits' },
    { path: '/admin/tenants', icon: Users, label: 'Promoteurs' },
  ];

  const navLinkClass = (isActive) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors duration-150 ${
      isActive
        ? 'bg-lime-400 text-[#0A1005] font-semibold shadow-lg shadow-lime-400/20'
        : 'text-gray-600 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-gray-200'
    }`;

  const iconBtn =
    'p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] hover:text-gray-900 dark:hover:text-white transition-colors duration-150';

  const Nav = ({ onNavigate }) => (
    <nav className="flex-1 px-3 py-4 space-y-1">
      <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-700">
        Plateforme
      </p>
      {menuItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.end
          ? location.pathname === item.path
          : location.pathname.startsWith(item.path);
        return (
          <Link key={item.path} to={item.path} className={navLinkClass(isActive)} onClick={onNavigate}>
            <Icon size={18} strokeWidth={2.2} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#080B0A] flex">
      {/* Sidebar mobile */}
      <div className={`fixed inset-0 z-40 lg:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex flex-col w-72 bg-white dark:bg-[#0A0F0D]">
          <div className="flex items-center justify-between h-16 px-4">
            <div>
              <Logo size="md" className="text-gray-900 dark:text-white" />
              <span className="block text-[10px] font-bold uppercase tracking-wider text-lime-600 dark:text-lime-400 mt-0.5">
                Admin
              </span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className={iconBtn}>
              <X size={20} strokeWidth={2} />
            </button>
          </div>
          <Nav onNavigate={() => setSidebarOpen(false)} />
          <div className="p-3">
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-3 py-2.5 text-sm font-medium text-gray-500 dark:text-gray-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              <LogOut size={16} className="mr-2.5" strokeWidth={2.2} />
              Déconnexion
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar desktop */}
      <div className="hidden lg:flex lg:flex-shrink-0 lg:fixed lg:inset-y-0 lg:left-0 z-30 p-3 lg:w-64">
        <div className="flex flex-col w-full rounded-2xl bg-white dark:bg-[#0A0F0D] h-full overflow-hidden">
          <div className="h-16 px-4 flex items-center">
            <div>
              <Logo size="md" className="text-gray-900 dark:text-white" />
              <span className="block text-[10px] font-bold uppercase tracking-wider text-lime-600 dark:text-lime-400 mt-0.5">
                Admin
              </span>
            </div>
          </div>
          <Nav />
          <div className="p-3">
            <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-lime-400 flex items-center justify-center flex-shrink-0 text-[#0A1005] font-bold text-xs">
                {(user?.full_name || user?.email || 'S').trim().charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-tight">
                  {user?.full_name || user?.email || 'Super Admin'}
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-600 leading-tight">
                  Super admin
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-3 py-2.5 text-sm font-medium text-gray-500 dark:text-gray-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              <LogOut size={16} className="mr-2.5" strokeWidth={2.2} />
              Déconnexion
            </button>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="flex flex-col flex-1 min-w-0 lg:ml-64">
        <header className="sticky top-0 z-20 flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-[#080B0A] w-full">
          <button onClick={() => setSidebarOpen(true)} className={`lg:hidden ${iconBtn}`}>
            <Menu size={20} strokeWidth={2} />
          </button>
          <span className="hidden lg:block text-sm font-medium text-gray-500 dark:text-gray-400">
            Espace plateforme — non visible par les promoteurs
          </span>
          <button onClick={toggleDarkMode} className={iconBtn}>
            {darkMode ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
          </button>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-[1600px] mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
