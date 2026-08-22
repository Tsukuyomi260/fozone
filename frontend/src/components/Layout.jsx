import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Moon, Sun, Menu, X, Wifi, Home, DollarSign, Ticket, FileText, LogOut, Settings, Search, X as XIcon, ChevronLeft } from 'lucide-react';
import { logout, getCurrentUser } from '../services/auth';
import Logo from './Logo';

export default function Layout() {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true' ||
           (!localStorage.getItem('darkMode') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  });
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setUser(getCurrentUser());

    // Appliquer le dark mode
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('darkMode', newDarkMode.toString());
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleSidebar = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', newState.toString());
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  const getUserDisplayName = () => {
    if (user?.full_name) {
      const parts = user.full_name.split(' ');
      return parts[0] || user.email?.split('@')[0] || 'Utilisateur';
    }
    return user?.email?.split('@')[0] || 'Utilisateur';
  };

  const getInitial = () => {
    const name = user?.full_name || user?.email || 'U';
    return name.trim().charAt(0).toUpperCase();
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const query = searchQuery.toLowerCase().trim();
    const routes = [
      { path: '/dashboard', keywords: ['dashboard', 'accueil', 'tableau', 'home'] },
      { path: '/zones', keywords: ['zones', 'wifi', 'zone', 'réseau'] },
      { path: '/pricings', keywords: ['tarifs', 'prix', 'forfaits', 'pricing'] },
      { path: '/tickets', keywords: ['tickets', 'billets', 'ticket'] },
      { path: '/accounting', keywords: ['comptabilité', 'compta', 'recettes', 'revenus', 'paiements'] },
      { path: '/profile', keywords: ['profil', 'compte', 'paramètres', 'settings'] },
    ];

    const matchedRoute = routes.find(route =>
      route.keywords.some(keyword => query.includes(keyword))
    );

    if (matchedRoute) {
      navigate(matchedRoute.path);
      setSearchQuery('');
      setSidebarOpen(false);
    }
  };

  // Navigation groupée en sections, l'ordre des entrées reste inchangé
  const menuSections = [
    {
      label: 'Principal',
      items: [
        { path: '/dashboard', icon: Home, label: 'Dashboard' },
      ],
    },
    {
      label: 'Exploitation',
      items: [
        { path: '/zones', icon: Wifi, label: 'Zones Wi-Fi' },
        { path: '/pricings', icon: DollarSign, label: 'Tarifs' },
        { path: '/tickets', icon: Ticket, label: 'Tickets' },
      ],
    },
    {
      label: 'Gestion',
      items: [
        { path: '/accounting', icon: FileText, label: 'Comptabilité' },
        { path: '/profile', icon: Settings, label: 'Mon Profil' },
      ],
    },
  ];

  const navLinkClass = (isActive, collapsed) =>
    `flex items-center rounded-xl transition-colors duration-150 group relative ${
      collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'
    } ${
      isActive
        ? 'bg-lime-400 text-[#0A1005] font-semibold shadow-lg shadow-lime-400/20'
        : 'text-gray-600 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-gray-200'
    }`;

  const iconBtn =
    'p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] hover:text-gray-900 dark:hover:text-white transition-colors duration-150';

  const sidebarSurface = 'bg-white dark:bg-[#0A0F0D]';

  /* --- Bloc utilisateur, en tête de barre comme dans la référence --- */
  const UserBlock = ({ collapsed = false }) => (
    <div className={`flex items-center gap-2.5 ${collapsed ? 'justify-center' : ''}`}>
      <div className="w-8 h-8 rounded-full bg-lime-400 flex items-center justify-center flex-shrink-0 text-[#0A1005] font-bold text-xs">
        {getInitial()}
      </div>
      {!collapsed && (
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-tight">
            {getUserDisplayName()}
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-600 capitalize leading-tight">
            {user?.role || 'Admin'}
          </p>
        </div>
      )}
    </div>
  );

  /* --- Champ de recherche, dans la barre --- */
  const SearchField = () => (
    <form onSubmit={handleSearch} className="relative">
      <Search
        size={15}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600 pointer-events-none"
      />
      <input
        ref={searchInputRef}
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Rechercher..."
        className="w-full pl-9 pr-8 py-2 rounded-xl text-sm bg-gray-100 dark:bg-white/[0.04] border border-transparent dark:border-white/[0.06] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-lime-400/50 focus:bg-white dark:focus:bg-white/[0.06] transition-colors"
      />
      {searchQuery && (
        <button
          type="button"
          onClick={() => setSearchQuery('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <XIcon size={14} strokeWidth={2.5} />
        </button>
      )}
    </form>
  );

  /* --- Navigation --- */
  const Nav = ({ collapsed = false, onNavigate }) => (
    <nav className="flex-1 px-3 py-4 overflow-y-auto">
      {menuSections.map((section) => (
        <div key={section.label} className="mb-5">
          {collapsed ? (
            <div className="mx-auto mb-3 h-px w-6 bg-gray-200 dark:bg-white/[0.06]" />
          ) : (
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-700">
              {section.label}
            </p>
          )}
          <div className="space-y-1">
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={navLinkClass(isActive, collapsed)}
                  onClick={onNavigate}
                  title={collapsed ? item.label : ''}
                >
                  <Icon size={18} className={`flex-shrink-0 ${collapsed ? '' : 'mr-3'}`} strokeWidth={2.2} />
                  <span className={`text-sm whitespace-nowrap transition-all duration-200 ${
                    collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
                  }`}>
                    {item.label}
                  </span>
                  {collapsed && (
                    <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap z-50 shadow-xl">
                      {item.label}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#080B0A] flex">
      {/* Sidebar Mobile */}
      <div className={`fixed inset-0 z-40 lg:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}></div>
        <div className={`fixed inset-y-0 left-0 flex flex-col w-72 ${sidebarSurface} shadow-2xl`}>
          {/* Utilisateur */}
          <div className="flex items-center justify-between gap-2 h-16 px-4 flex-shrink-0">
            <UserBlock />
            <button onClick={() => setSidebarOpen(false)} className={iconBtn}>
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          {/* Recherche */}
          <div className="px-3 pb-3 flex-shrink-0">
            <SearchField />
          </div>

          <Nav onNavigate={() => setSidebarOpen(false)} />

          {/* Pied: déconnexion + marque */}
          <div className="px-3 pb-3 pt-1 flex-shrink-0">
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-3 py-2.5 text-sm font-medium text-gray-500 dark:text-gray-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              <LogOut size={16} className="mr-2.5 flex-shrink-0" strokeWidth={2.2} />
              Déconnexion
            </button>
            <div className="px-3 pt-3 mt-1">
              <Logo size="sm" className="text-gray-300 dark:text-gray-700" />
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar Desktop */}
      <div className={`hidden lg:flex lg:flex-shrink-0 lg:fixed lg:inset-y-0 lg:left-0 z-30 p-3 transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'lg:w-[88px]' : 'lg:w-64'}`}>
        <div className="flex flex-col w-full">
          <div className={`flex flex-col flex-1 ${sidebarSurface} rounded-2xl h-full overflow-hidden`}>
            {/* Utilisateur */}
            <div className={`flex items-center h-16 flex-shrink-0 ${sidebarCollapsed ? 'justify-center px-2' : 'px-4'}`}>
              <UserBlock collapsed={sidebarCollapsed} />
            </div>

            {/* Recherche */}
            <div className={`pb-3 flex-shrink-0 ${sidebarCollapsed ? 'px-3' : 'px-3'}`}>
              {sidebarCollapsed ? (
                <button
                  onClick={toggleSidebar}
                  className="w-full flex items-center justify-center py-2 rounded-xl bg-gray-100 dark:bg-white/[0.04] text-gray-400 dark:text-gray-600 hover:text-gray-900 dark:hover:text-white transition-colors"
                  title="Rechercher"
                >
                  <Search size={16} strokeWidth={2.2} />
                </button>
              ) : (
                <SearchField />
              )}
            </div>

            <Nav collapsed={sidebarCollapsed} />

            {/* Pied: déconnexion, marque, repli */}
            <div className="px-3 pb-3 pt-1 flex-shrink-0">
              <button
                onClick={handleLogout}
                className={`flex items-center w-full py-2.5 text-sm font-medium text-gray-500 dark:text-gray-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors ${
                  sidebarCollapsed ? 'justify-center px-0' : 'px-3'
                }`}
                title={sidebarCollapsed ? 'Déconnexion' : ''}
              >
                <LogOut size={16} className={`flex-shrink-0 ${sidebarCollapsed ? '' : 'mr-2.5'}`} strokeWidth={2.2} />
                <span className={`whitespace-nowrap transition-all duration-200 ${
                  sidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
                }`}>
                  Déconnexion
                </span>
              </button>

              <div className={`flex items-center justify-between gap-2 mt-4 ${sidebarCollapsed ? 'flex-col' : ''}`}>
                <div className={`px-1 transition-all duration-200 ${sidebarCollapsed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
                  <Logo size="sm" className="text-gray-300 dark:text-gray-700" />
                </div>
                <button
                  onClick={toggleSidebar}
                  className={iconBtn}
                  title={sidebarCollapsed ? 'Agrandir le menu' : 'Réduire le menu'}
                >
                  <ChevronLeft
                    size={16}
                    strokeWidth={2.5}
                    className={`transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex flex-col flex-1 min-w-0 transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'lg:ml-[88px]' : 'lg:ml-64'}`}>
        {/* Top Bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-[#080B0A] w-full">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className={`lg:hidden ${iconBtn}`}
            >
              <Menu size={20} strokeWidth={2} />
            </button>

            {/* Message de bienvenue */}
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
              {getGreeting()},{' '}
              <span className="font-semibold text-gray-900 dark:text-white">
                {getUserDisplayName()}
              </span>
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={toggleDarkMode}
              className={iconBtn}
              title={darkMode ? 'Mode clair' : 'Mode sombre'}
            >
              {darkMode ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden min-h-0">
          <div className="max-w-[1600px] mx-auto w-full h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
