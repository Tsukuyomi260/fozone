import { useState, useEffect } from 'react';
import { getWifiZones } from '../services/wifiZones';
import { getPaymentStats, getTicketsSoldStats, getPaymentHistory, exportPaymentHistoryCSV } from '../services/accounting';
import toast from 'react-hot-toast';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  Ticket, 
  Download, 
  Calendar, 
  Search, 
  Eye,
  Filter,
  Clock
} from 'lucide-react';

export default function Accounting() {
  const [paymentStats, setPaymentStats] = useState([]);
  const [ticketsStats, setTicketsStats] = useState([]);
  const [payments, setPayments] = useState([]);
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
        <h1 className="text-2xl md:text-3xl font-bold text-green-700 dark:text-green-500 tracking-tight">
          Bienvenue dans votre espace d'administration de Ticket Wifi Zone
        </h1>
        <nav className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          <span>Accueil</span>
          <span className="mx-2">/</span>
          <span>Gestion de comptabilité</span>
          <span className="mx-2">/</span>
          <span className="text-green-600 dark:text-green-400 font-medium">
            Historique des paiements
          </span>
        </nav>
      </div>

      {/* Graphique 1: Statistiques des paiements */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-green-100 dark:border-gray-700 p-4 md:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
          <div className="flex items-center space-x-3 mb-4 sm:mb-0">
            <div className="p-2 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 rounded-xl shadow-sm">
              <TrendingUp className="text-green-600 dark:text-green-400" size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                Statistiques des paiements
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Chiffre d'affaires</p>
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
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500"></div>
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
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" strokeOpacity={0.3} />
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
                  labelStyle={{ color: '#10b981', fontWeight: '600', marginBottom: '4px' }}
                  itemStyle={{ color: '#374151' }}
                />
                <Bar 
                  dataKey="revenue" 
                  fill="url(#revenueGradient)" 
                  radius={[12, 12, 0, 0]}
                  stroke="#10b981"
                  strokeWidth={1}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Graphique 2: Nombre de tickets vendus */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-green-100 dark:border-gray-700 p-4 md:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
          <div className="flex items-center space-x-3 mb-4 sm:mb-0">
            <div className="p-2 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 rounded-xl shadow-sm">
              <Ticket className="text-green-600 dark:text-green-400" size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
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
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500"></div>
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
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" strokeOpacity={0.3} />
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
                  labelStyle={{ color: '#10b981', fontWeight: '600', marginBottom: '4px' }}
                  itemStyle={{ color: '#374151' }}
                />
                <Bar 
                  dataKey="tickets_sold" 
                  fill="url(#ticketsGradient)" 
                  radius={[12, 12, 0, 0]}
                  stroke="#10b981"
                  strokeWidth={1}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Section Mes Recettes */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-green-100 dark:border-gray-700 p-4 md:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
          <div className="flex items-center space-x-3 mb-4 sm:mb-0">
            <div className="p-2 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 rounded-xl shadow-sm">
              <Clock className="text-green-600 dark:text-green-400" size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                Mes Recettes
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Historique des paiements</p>
            </div>
          </div>
        </div>

        {/* Filtres de date et export */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6 pb-6 border-b border-green-100 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 rounded-lg">
                <Calendar size={16} className="text-green-600 dark:text-green-400" />
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
              <div className="p-1.5 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 rounded-lg">
                <Calendar size={16} className="text-green-600 dark:text-green-400" />
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
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
          >
            {exporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
          <div className="flex items-center space-x-2 flex-1 max-w-md bg-gradient-to-r from-green-50 to-white dark:from-green-900/10 dark:to-gray-800/50 rounded-xl px-3 py-2 border border-green-100 dark:border-gray-700">
            <Search size={18} className="text-green-600 dark:text-green-400" />
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
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500"></div>
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Aucun paiement trouvé</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-green-100 dark:border-gray-700">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-green-50 to-green-50/50 dark:from-green-900/20 dark:to-green-800/10">
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
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-green-100 dark:divide-gray-700">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gradient-to-r hover:from-green-50/50 hover:to-white dark:hover:from-green-900/10 dark:hover:to-gray-700/50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white font-semibold">
                        {payment.zone_name || 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-medium">
                        {payment.pricing_amount ? `${parseFloat(payment.pricing_amount).toLocaleString()} XOF` : `${parseFloat(payment.amount).toLocaleString()} XOF`}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-green-600 dark:text-green-400">
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
                        {payment.network || 'MTN MoMo Benin'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {payment.phone || 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {payment.ticket && (
                          <button
                            className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-all p-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 hover:scale-110"
                            title={`Username: ${payment.ticket.username}, Password: ${payment.ticket.password}`}
                          >
                            <Eye size={18} strokeWidth={2} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between mt-4 pt-4 border-t border-green-100 dark:border-gray-700">
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
