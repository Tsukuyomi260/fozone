import { useState, useEffect, useRef } from 'react';
import { getWifiZones } from '../services/wifiZones';
import { getPaymentStats, getTicketsSoldStats, getPaymentHistory, getPaymentMethodStats, exportPaymentHistoryCSV } from '../services/accounting';
import toast from 'react-hot-toast';
import { Skeleton, SkeletonTable } from '../components/Skeleton';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  Ticket, 
  Download, 
  Calendar, 
  Search, 
  Eye,
  Filter,
  Clock,
  Copy,
  Smartphone
} from 'lucide-react';

/**
 * Oeil de la colonne Ticket: les identifiants s'affichent au survol, et un clic
 * les garde ouverts (utile sur mobile, ou pour copier sans perdre le survol).
 */
function TicketPeek({ ticket }) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!pinned) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setPinned(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [pinned]);

  const copy = (value, label) => {
    navigator.clipboard?.writeText(value)
      .then(() => toast.success(`${label} copie`))
      .catch(() => toast.error('Copie impossible'));
  };

  const open = pinned || hovered;

  // Le tableau defile horizontalement (overflow-x-auto), ce qui couperait un
  // popover en position absolue: on le place en fixed sous l'icone, et on le
  // referme au defilement pour qu'il ne flotte pas loin de sa ligne.
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = 224;
      const below = window.innerHeight - r.bottom > 150;
      setPos({
        left: Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8)),
        top: below ? r.bottom : undefined,
        bottom: below ? undefined : window.innerHeight - r.top
      });
    };
    place();
    const hide = () => { setPinned(false); setHovered(false); };
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative inline-block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        ref={btnRef}
        type="button"
        onClick={() => setPinned(p => !p)}
        aria-label="Voir le ticket"
        aria-expanded={open}
        className={`text-lime-600 dark:text-lime-400 hover:text-green-700 dark:hover:text-green-300 transition-all p-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 hover:scale-110 ${pinned ? 'bg-green-50 dark:bg-green-900/20' : ''}`}
      >
        <Eye size={18} strokeWidth={2} />
      </button>
      {open && pos && (
        // Espacement en padding, pas en marge: la souris passe de l'icone au
        // popover sans traverser de vide, donc sans le refermer.
        <div className="fixed z-50 py-1" style={{ left: pos.left, top: pos.top, bottom: pos.bottom }}>
          <div className="w-56 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 shadow-lg p-3 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
              Ticket attribue
            </p>
            {[
              ['Utilisateur', ticket.username],
              ['Mot de passe', ticket.password]
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-2 py-1">
                <div className="min-w-0">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">{label}</p>
                  <p className="font-mono text-sm text-gray-900 dark:text-white truncate">{value}</p>
                </div>
                <button
                  type="button"
                  onClick={() => copy(value, label)}
                  className="shrink-0 p-1 rounded-md text-gray-400 hover:text-lime-600 hover:bg-gray-100 dark:hover:bg-white/10"
                  aria-label={`Copier ${label.toLowerCase()}`}
                >
                  <Copy size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Couleurs du camembert. Le lime de la marque pour la methode dominante,
// puis des teintes franchement distinctes: un daltonien doit pouvoir separer
// les parts, et la legende chiffree reste la pour lever tout doute.
const METHOD_COLORS = ['#84cc16', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ec4899', '#9ca3af'];

export default function Accounting() {
  const [paymentStats, setPaymentStats] = useState([]);
  const [ticketsStats, setTicketsStats] = useState([]);
  const [payments, setPayments] = useState([]);
  // Repartition par moyen de paiement: suit les filtres de l'historique
  const [methodStats, setMethodStats] = useState([]);
  const [methodTotal, setMethodTotal] = useState(0);
  const [wifiZones, setWifiZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filtres pour les graphiques
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [period, setPeriod] = useState('days');

  // Filtres pour le tableau
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPayments, setTotalPayments] = useState(0);

  useEffect(() => {
    loadZones();
    loadStats();
    loadPaymentHistory();
  }, []);

  useEffect(() => {
    loadStats();
  }, [year, month, period]);

  useEffect(() => {
    loadPaymentHistory();
  }, [startDate, endDate, searchTerm, selectedZone, page, limit]);

  // La recherche et la pagination ne changent pas la repartition: seules la
  // zone et la periode la font bouger.
  useEffect(() => {
    loadMethodStats();
  }, [startDate, endDate, selectedZone]);

  const loadZones = async () => {
    try {
      const response = await getWifiZones();
      setWifiZones(response.zones || []);
    } catch (error) {
      console.error('[Accounting] Erreur lors du chargement des zones:', error);
    }
  };

  const loadStats = async () => {
    setLoading(true);
    try {
      const [paymentData, ticketsData] = await Promise.all([
        getPaymentStats({ year, month, period }),
        getTicketsSoldStats({ month, period })
      ]);
      setPaymentStats(paymentData.stats || []);
      setTicketsStats(ticketsData.stats || []);
    } catch (error) {
      toast.error(error.message || 'Impossible de charger les statistiques');
    } finally {
      setLoading(false);
    }
  };

  const loadMethodStats = async () => {
    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (selectedZone) params.zoneId = selectedZone;

      const response = await getPaymentMethodStats(params);
      setMethodStats(response.methods || []);
      setMethodTotal(response.total || 0);
    } catch (error) {
      console.error('[Accounting] Répartition indisponible:', error);
    }
  };

  const loadPaymentHistory = async () => {
    setLoadingPayments(true);
    try {
      const params = {
        page,
        limit,
      };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (searchTerm) params.search = searchTerm;
      if (selectedZone) params.zoneId = selectedZone;

      const response = await getPaymentHistory(params);
      setPayments(response.payments || []);
      setTotalPayments(response.pagination?.total || 0);
    } catch (error) {
      toast.error(error.message || 'Impossible de charger l\'historique');
    } finally {
      setLoadingPayments(false);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (selectedZone) params.zoneId = selectedZone;

      await exportPaymentHistoryCSV(params);
      toast.success('Export CSV réussi !');
    } catch (error) {
      toast.error(error.message || 'Impossible d\'exporter les données');
    } finally {
      setExporting(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadPaymentHistory();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const months = [
    { value: 1, label: 'Janv.' },
    { value: 2, label: 'Fév.' },
    { value: 3, label: 'Mars' },
    { value: 4, label: 'Avr.' },
    { value: 5, label: 'Mai' },
    { value: 6, label: 'Juin' },
    { value: 7, label: 'Juil.' },
    { value: 8, label: 'Août' },
    { value: 9, label: 'Sept.' },
    { value: 10, label: 'Oct.' },
    { value: 11, label: 'Nov.' },
    { value: 12, label: 'Déc.' }
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-6 md:space-y-8 w-full">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
          Comptabilité
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Ventes nettes et historique des paiements
        </p>
      </div>

      {/* Graphique 1: Statistiques des paiements */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#101714] shadow-sm dark:shadow-black/30 p-5 md:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
          <div className="flex items-center space-x-3 mb-4 sm:mb-0">
            <div className="w-9 h-9 rounded-xl bg-lime-50 dark:bg-lime-400/10 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="text-lime-600 dark:text-lime-400" size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
                Ventes par jour
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Net, commission déduite</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="input text-sm py-2"
            >
              {years.map(y => (
                <option key={y} value={y}>Année : {y}</option>
              ))}
            </select>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="input text-sm py-2"
            >
              <option value="days">Par jours</option>
              <option value="weeks">Par semaines</option>
              <option value="months">Par mois</option>
            </select>
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="input text-sm py-2"
            >
              {months.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="h-64 flex flex-col justify-end gap-2 pb-6">
            {[70, 45, 85, 55, 90, 40, 65].map((h, i) => (
              <Skeleton key={i} className="w-full" style={{ height: 6 }} />
            ))}
          </div>
        ) : paymentStats.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Aucune donnée disponible</p>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-green-50/50 to-white dark:from-green-900/10 dark:to-gray-800/50 rounded-xl p-4">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={paymentStats} margin={{ top: 20, right: 20, left: 10, bottom: 60 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a3e635" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#84cc16" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af" strokeOpacity={0.3} />
                <XAxis 
                  dataKey="day" 
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  stroke="#9ca3af"
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  label={{ value: 'Chiffre d\'affaires (XOF)', angle: -90, position: 'insideLeft', style: { fill: '#6b7280', fontSize: '12px' } }}
                  stroke="#9ca3af"
                />
                <Tooltip 
                  formatter={(value) => [`${parseFloat(value).toLocaleString('fr-FR')} XOF`, 'Chiffre d\'affaires']}
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                    border: '1px solid #d1fae5',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    padding: '12px'
                  }}
                  labelStyle={{ color: '#84cc16', fontWeight: '600', marginBottom: '4px' }}
                  itemStyle={{ color: '#374151' }}
                />
                <Bar 
                  dataKey="revenue" 
                  fill="url(#revenueGradient)" 
                  radius={[12, 12, 0, 0]}
                  stroke="#a3e635"
                  strokeWidth={1}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Graphique 2: Nombre de tickets vendus */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#101714] shadow-sm dark:shadow-black/30 p-5 md:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
          <div className="flex items-center space-x-3 mb-4 sm:mb-0">
            <div className="w-9 h-9 rounded-xl bg-lime-50 dark:bg-lime-400/10 flex items-center justify-center flex-shrink-0">
              <Ticket className="text-lime-600 dark:text-lime-400" size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
                Nombre de tickets vendus
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Ventes réalisées</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="input text-sm py-2"
            >
              <option value="days">Affichage : Par Jours</option>
              <option value="weeks">Affichage : Par Semaines</option>
              <option value="months">Affichage : Par Mois</option>
            </select>
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="input text-sm py-2"
            >
              {months.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="h-64 flex flex-col justify-end gap-2 pb-6">
            {[70, 45, 85, 55, 90, 40, 65].map((h, i) => (
              <Skeleton key={i} className="w-full" style={{ height: 6 }} />
            ))}
          </div>
        ) : ticketsStats.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Aucune donnée disponible</p>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-green-50/50 to-white dark:from-green-900/10 dark:to-gray-800/50 rounded-xl p-4">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={ticketsStats} margin={{ top: 20, right: 20, left: 10, bottom: 60 }}>
                <defs>
                  <linearGradient id="ticketsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a3e635" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#84cc16" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af" strokeOpacity={0.3} />
                <XAxis 
                  dataKey="day" 
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  stroke="#9ca3af"
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  label={{ value: 'Tickets vendus', angle: -90, position: 'insideLeft', style: { fill: '#6b7280', fontSize: '12px' } }}
                  stroke="#9ca3af"
                />
                <Tooltip 
                  formatter={(value) => [value, 'Tickets vendus']}
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                    border: '1px solid #d1fae5',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    padding: '12px'
                  }}
                  labelStyle={{ color: '#84cc16', fontWeight: '600', marginBottom: '4px' }}
                  itemStyle={{ color: '#374151' }}
                />
                <Bar 
                  dataKey="tickets_sold" 
                  fill="url(#ticketsGradient)" 
                  radius={[12, 12, 0, 0]}
                  stroke="#a3e635"
                  strokeWidth={1}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Graphique 3: repartition par moyen de paiement.
          Place ici, apres les deux graphiques existants et avant l'historique:
          il suit les memes filtres de zone et de periode. */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#101714] shadow-sm dark:shadow-black/30 p-5 md:p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-lime-50 dark:bg-lime-400/10 flex items-center justify-center flex-shrink-0">
            <Smartphone className="text-lime-600 dark:text-lime-400" size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
              Moyens de paiement
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {methodTotal > 0
                ? `Sur ${methodTotal} vente${methodTotal > 1 ? 's' : ''}`
                : 'Aucune vente sur la période'}
            </p>
          </div>
        </div>

        {methodStats.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Aucune vente sur cette période
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={methodStats}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {methodStats.map((m, i) => (
                      <Cell key={m.method} fill={METHOD_COLORS[i % METHOD_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${value} vente${value > 1 ? 's' : ''}`, name]}
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.98)',
                      border: '1px solid #d1fae5',
                      borderRadius: '12px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                      padding: '12px'
                    }}
                    labelStyle={{ color: '#84cc16', fontWeight: '600', marginBottom: '4px' }}
                    itemStyle={{ color: '#374151' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Le chiffre exact a cote du graphique: un camembert seul ne se
                lit pas precisement. */}
            <ul className="space-y-3">
              {methodStats.map((m, i) => (
                <li key={m.method} className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: METHOD_COLORS[i % METHOD_COLORS.length] }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {m.label}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      {m.count} vente{m.count > 1 ? 's' : ''} · {m.amount.toLocaleString()} XOF encaissés
                    </span>
                  </span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                    {m.share} %
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Section Mes Recettes */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#101714] shadow-sm dark:shadow-black/30 p-5 md:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
          <div className="flex items-center space-x-3 mb-4 sm:mb-0">
            <div className="w-9 h-9 rounded-xl bg-lime-50 dark:bg-lime-400/10 flex items-center justify-center flex-shrink-0">
              <Clock className="text-lime-600 dark:text-lime-400" size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
                Mes Recettes
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Historique des paiements</p>
            </div>
          </div>
        </div>

        {/* Filtres de date et export */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6 pb-6 border-b border-gray-200 dark:border-white/10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-lime-50 dark:bg-lime-400/10 flex items-center justify-center flex-shrink-0">
                <Calendar size={16} className="text-lime-600 dark:text-lime-400" />
              </div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Du</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input text-sm py-2"
              />
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-lime-50 dark:bg-lime-400/10 flex items-center justify-center flex-shrink-0">
                <Calendar size={16} className="text-lime-600 dark:text-lime-400" />
              </div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Au</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input text-sm py-2"
              />
            </div>
            {wifiZones.length > 0 && (
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="input text-sm py-2"
              >
                <option value="">Toutes les zones</option>
                {wifiZones.map(zone => (
                  <option key={zone.id} value={zone.id}>{zone.name}</option>
                ))}
              </select>
            )}
          </div>
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 text-sm font-bold bg-lime-400 hover:bg-lime-300 text-[#0A1005] rounded-xl shadow-lg shadow-lime-400/25 transition-colors disabled:opacity-50"
          >
            {exporting ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-[#0A1005]/30 border-t-[#0A1005] animate-spin mr-2" />
                Export...
              </>
            ) : (
              <>
                <Download size={18} strokeWidth={2} className="mr-2" />
                Exporter en CSV
              </>
            )}
          </button>
        </div>

        {/* Recherche et pagination */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center space-x-2 flex-1 max-w-md bg-gray-100 dark:bg-white/[0.04] rounded-xl px-3 py-2 border border-transparent dark:border-white/[0.06]">
            <Search size={18} className="text-lime-600 dark:text-lime-400" />
            <form onSubmit={handleSearch} className="flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher..."
                className="bg-transparent border-0 outline-none text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 w-full"
              />
            </form>
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-700 dark:text-gray-300">Afficher</label>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(parseInt(e.target.value));
                setPage(1);
              }}
              className="input text-sm py-2"
            >
              <option value={10}>10 entrées</option>
              <option value={25}>25 entrées</option>
              <option value={50}>50 entrées</option>
              <option value={100}>100 entrées</option>
            </select>
          </div>
        </div>

        {/* Tableau */}
        {loadingPayments ? (
          <SkeletonTable rows={6} cols={6} />
        ) : payments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Aucun paiement trouvé</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-white/[0.03]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      WIFIZONE
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      TARIF
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      REVENU
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      COMMISSION
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      RÉFÉRENCE DE PAIEMENT
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      DATE/HEURE
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      RÉSEAU
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      NUMÉRO
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      TICK
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white font-semibold">
                        {payment.zone_name || 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-medium">
                        {payment.pricing_amount ? `${parseFloat(payment.pricing_amount).toLocaleString()} XOF` : `${parseFloat(payment.amount).toLocaleString()} XOF`}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-lime-600 dark:text-lime-400">
                        {payment.revenue ? `${parseFloat(payment.revenue).toFixed(2)} XOF` : 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {payment.commission_rate ? `${parseFloat(payment.commission_rate.toFixed(1))} %` : 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 font-mono text-xs">
                        {payment.moneroo_payment_id ? payment.moneroo_payment_id.substring(0, 20) + '...' : 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(payment.completed_at || payment.created_at)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {payment.network || 'Mobile Money'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {payment.phone || 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {payment.ticket ? (
                          <TicketPeek ticket={payment.ticket} />
                        ) : (
                          <span
                            className="text-gray-400 dark:text-gray-600"
                            title="Aucun ticket relie a ce paiement"
                          >
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-white/10">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 sm:mb-0">
                Affichage de {(page - 1) * limit + 1} à {Math.min(page * limit, totalPayments)} sur {totalPayments} entrées
              </p>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Précédent
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400 px-3">
                  Page {page} sur {Math.ceil(totalPayments / limit) || 1}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil(totalPayments / limit)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Suivant
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
