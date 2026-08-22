import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getWifiZones } from '../services/wifiZones';
import { getPricingsByZone } from '../services/pricings';
import { importTickets, getTicketsByZone, getTicketStats, deleteTicket, deleteAllTickets } from '../services/tickets';
import toast from 'react-hot-toast';
import { SkeletonHeader, SkeletonTable } from '../components/Skeleton';
import { 
  Upload, 
  FileText, 
  Wifi, 
  Tag, 
  Info, 
  Menu, 
  CheckCircle, 
  XCircle, 
  Clock, 
  DollarSign,
  Ticket,
  TrendingUp,
  Users,
  Filter,
  Trash2,
  RefreshCw
} from 'lucide-react';

export default function Tickets() {
  const [wifiZones, setWifiZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState('');
  const [pricings, setPricings] = useState([]);
  const [selectedPricing, setSelectedPricing] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingZones, setLoadingZones] = useState(true);
  const [showList, setShowList] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPricing, setFilterPricing] = useState('');
  const [listZoneId, setListZoneId] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deletingTicketId, setDeletingTicketId] = useState(null);

  useEffect(() => {
    loadZones();
  }, []);

  useEffect(() => {
    if (selectedZone) {
      loadPricings(selectedZone);
    } else {
      setPricings([]);
      setSelectedPricing('');
    }
  }, [selectedZone]);

  useEffect(() => {
    if (showList && listZoneId) {
      loadPricings(listZoneId);
      loadTickets(listZoneId);
      loadTicketStats(listZoneId);
    }
  }, [showList, listZoneId]);

  useEffect(() => {
    if (showList && listZoneId) {
      loadTickets(listZoneId);
    }
  }, [filterStatus, filterPricing]);

  const loadZones = async () => {
    try {
      const response = await getWifiZones();
      setWifiZones(response.zones || []);
      if (response.zones && response.zones.length > 0) {
        setSelectedZone(response.zones[0].id);
      }
    } catch (error) {
      toast.error(error.message || 'Impossible de charger les zones Wi-Fi');
    } finally {
      setLoadingZones(false);
    }
  };

  const loadPricings = async (zoneId) => {
    try {
      const response = await getPricingsByZone(zoneId);
      setPricings(response.pricings || []);
    } catch (error) {
      console.error('[Tickets] Erreur lors du chargement des tarifs:', error);
    }
  };

  const loadTickets = async (zoneId) => {
    setLoadingTickets(true);
    try {
      const params = { limit: 100 };
      if (filterStatus) params.status = filterStatus;
      if (filterPricing) params.pricing_id = filterPricing;
      
      const response = await getTicketsByZone(zoneId, params);
      setTickets(response.tickets || []);
    } catch (error) {
      toast.error(error.message || 'Impossible de charger les tickets');
    } finally {
      setLoadingTickets(false);
    }
  };

  const loadTicketStats = async (zoneId) => {
    setLoadingStats(true);
    try {
      const response = await getTicketStats(zoneId);
      setStats(response.stats || null);
    } catch (error) {
      console.error('[Tickets] Erreur lors du chargement des statistiques:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        toast.error('Veuillez sélectionner un fichier CSV');
        return;
      }
      setCsvFile(file);
      setFileName(file.name);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedZone) {
      toast.error('Veuillez sélectionner une zone WiFi');
      return;
    }
    
    if (!csvFile) {
      toast.error('Veuillez sélectionner un fichier CSV');
      return;
    }

    setLoading(true);
    try {
      const response = await importTickets(selectedZone, csvFile, selectedPricing || null);
      toast.success(`${response.imported || 0} ticket(s) importé(s) avec succès !`);
      
      // Réinitialiser le formulaire
      setCsvFile(null);
      setFileName('');
      setSelectedPricing('');
      const fileInput = document.getElementById('csv-file');
      if (fileInput) fileInput.value = '';
      
      // Recharger les tickets et stats si on est en mode liste
      if (showList && listZoneId) {
        await loadTickets(listZoneId);
        await loadTicketStats(listZoneId);
      }
    } catch (error) {
      console.error('[Tickets] Erreur lors de l\'import:', error);
      toast.error(error.message || 'Impossible d\'importer les tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTicket = async (ticketId) => {
    const confirmed = window.confirm(
      'Êtes-vous sûr de vouloir supprimer ce ticket ? Cette action est irréversible.'
    );

    if (!confirmed) return;

    setDeletingTicketId(ticketId);
    try {
      await deleteTicket(ticketId);
      toast.success('Ticket supprimé avec succès');
      if (listZoneId) {
        await loadTickets(listZoneId);
        await loadTicketStats(listZoneId);
      }
    } catch (error) {
      toast.error(error.message || 'Impossible de supprimer le ticket');
    } finally {
      setDeletingTicketId(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!listZoneId) {
      toast.error('Veuillez sélectionner une zone');
      return;
    }

    const confirmed = window.confirm(
      `Êtes-vous sûr de vouloir supprimer TOUS les tickets de cette zone ? Cette action est irréversible.`
    );

    if (!confirmed) return;

    setDeleting(true);
    try {
      await deleteAllTickets(listZoneId);
      toast.success('Tous les tickets ont été supprimés avec succès');
      await loadTickets(listZoneId);
      await loadTicketStats(listZoneId);
    } catch (error) {
      toast.error(error.message || 'Impossible de supprimer le ticket');
    } finally {
      setDeleting(false);
    }
  };

  const handleFilterChange = () => {
    if (listZoneId) {
      loadTickets(listZoneId);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      free: { bg: 'bg-lime-100 dark:bg-lime-400/10', text: 'text-lime-800 dark:text-lime-300', label: 'Libre' },
      reserved: { bg: 'bg-yellow-100 dark:bg-yellow-900/20', text: 'text-yellow-800 dark:text-yellow-300', label: 'Réservé' },
      sold: { bg: 'bg-blue-100 dark:bg-blue-900/20', text: 'text-blue-800 dark:text-blue-300', label: 'Vendu' },
      expired: { bg: 'bg-red-100 dark:bg-red-900/20', text: 'text-red-800 dark:text-red-300', label: 'Expiré' }
    };
    const badge = badges[status] || badges.free;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  if (loadingZones) {
    return (
      <div className="space-y-5 md:space-y-6 w-full">
        <SkeletonHeader />
        <SkeletonTable rows={6} cols={5} />
      </div>
    );
  }

  const card =
    'rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#101714] shadow-sm dark:shadow-black/30';

  const primaryBtn =
    'inline-flex items-center justify-center gap-2 h-11 px-5 text-sm font-bold bg-lime-400 hover:bg-lime-300 text-[#0A1005] rounded-xl shadow-lg shadow-lime-400/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="space-y-5 md:space-y-6 w-full">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
          Tickets
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {showList ? 'Consultez vos tickets Wi-Fi' : 'Importez de nouveaux tickets'}
        </p>
      </div>

      {/* Indicateurs de stock */}
      {showList && selectedZone && stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: stats.total || 0, icon: Ticket, tone: 'neutral' },
            { label: 'Libres', value: stats.free || 0, icon: CheckCircle, tone: 'lime' },
            { label: 'Vendus', value: stats.sold || 0, icon: TrendingUp, tone: 'blue' },
            { label: 'Réservés', value: stats.reserved || 0, icon: Clock, tone: 'amber' },
          ].map(({ label, value, icon: Icon, tone }) => {
            // Le stock de tickets libres est l'indicateur critique: il porte l'accent
            const toneClass = {
              neutral: 'text-gray-900 dark:text-white',
              lime: 'text-lime-600 dark:text-lime-400',
              blue: 'text-blue-600 dark:text-blue-400',
              amber: 'text-amber-600 dark:text-amber-400',
            }[tone];
            return (
              <div key={label} className={`${card} p-5`}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
                  <Icon className={toneClass} size={16} strokeWidth={2.5} />
                </div>
                <p className={`text-2xl md:text-[28px] leading-none font-bold tracking-tight ${toneClass}`}>
                  {value}
                </p>
              </div>
            );
          })}
        </div>
      )}
      {/* Formulaire d'import ou Liste des tickets */}
      {!showList ? (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#101714] shadow-sm dark:shadow-black/30 p-5 md:p-6">
          {/* En-tête de section */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
            <div className="flex items-center space-x-3 mb-4 sm:mb-0">
              <div className="w-9 h-9 rounded-xl bg-lime-50 dark:bg-lime-400/10 flex items-center justify-center flex-shrink-0">
                <Tag className="text-lime-600 dark:text-lime-400" size={24} strokeWidth={2.5} />
              </div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
                Ajouter un ticket
              </h2>
            </div>
            <button
              onClick={() => {
                setShowList(true);
                if (!listZoneId && wifiZones.length > 0) {
                  setListZoneId(wifiZones[0].id);
                }
              }}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-all duration-200 flex items-center"
            >
              <Menu size={18} strokeWidth={2} className="mr-2 hidden sm:inline-block" />
              <span className="sm:hidden">Liste</span>
              <span className="hidden sm:inline-block">Consulter liste ticket</span>
            </button>
          </div>

          {/* Notice importante */}
          <div className="bg-lime-50 dark:bg-lime-400/[0.07] border border-lime-200 dark:border-lime-400/20 rounded-xl p-4 mb-6">
            <div className="flex items-start space-x-3">
              <Info className="text-lime-600 dark:text-lime-400 flex-shrink-0 mt-0.5" size={20} strokeWidth={2} />
              <p className="text-sm text-lime-800 dark:text-lime-300">
                <strong>Conseil :</strong> Pour faciliter la création de nouveaux tickets, vous devez importer les fichiers au format CSV, générés depuis votre routeur MikroTik.
              </p>
            </div>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 lg:gap-8">
              {/* Zone WiFi */}
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Wifi size={18} strokeWidth={2} />
                  <span>Zone WiFi</span>
                </label>
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">-- Sélectionnez un WiFi Zone --</option>
                  {wifiZones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tarif */}
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Tag size={18} strokeWidth={2} />
                  <span>Tarif</span>
                </label>
                <select
                  value={selectedPricing}
                  onChange={(e) => setSelectedPricing(e.target.value)}
                  className="input"
                >
                  <option value="">-- Sélectionnez un tarif --</option>
                  {pricings.map((pricing) => (
                    <option key={pricing.id} value={pricing.id}>
                      {pricing.name || `FORFAIT ${pricing.amount} FCFA`}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Optionnel : Associer un tarif aux tickets importés
                </p>
              </div>
            </div>

            {/* Upload fichier CSV */}
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <FileText size={18} strokeWidth={2} />
                <span>Importer fichier (Type .CSV)</span>
              </label>
              <div className="flex items-center space-x-4">
                <label className="btn btn-secondary cursor-pointer inline-flex items-center">
                  <Upload size={18} strokeWidth={2} className="mr-2" />
                  Choisir un fichier
                  <input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                    required
                  />
                </label>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {fileName || 'Aucun fichier choisi'}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Format CSV attendu : Username,Password,Profile,Time Limit,Data Limit,Comment
              </p>
            </div>

            {/* Boutons d'action */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-end space-y-4 sm:space-y-0 sm:space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => {
                  setCsvFile(null);
                  setFileName('');
                  setSelectedPricing('');
                  const fileInput = document.getElementById('csv-file');
                  if (fileInput) fileInput.value = '';
                }}
                className="btn btn-secondary w-full sm:w-auto"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading || !selectedZone || !csvFile}
                className="btn btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-[#0A1005]/30 border-t-[#0A1005] animate-spin" />
                    Import en cours...
                  </>
                ) : (
                  <>
                    <Upload size={18} strokeWidth={2.5} />
                    Enregistrer
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          {/* En-tête liste */}
          <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#101714] shadow-sm dark:shadow-black/30 p-5 md:p-6">
            <div className="flex flex-col space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
                    Liste des tickets
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {listZoneId && wifiZones.find(z => z.id === listZoneId)?.name}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mt-4 sm:mt-0">
                  <button
                    onClick={() => setShowList(false)}
                    className="btn btn-secondary flex items-center"
                  >
                    <Upload size={18} strokeWidth={2} className="mr-2" />
                    Ajouter des tickets
                  </button>
                  {listZoneId && (
                    <button
                      onClick={handleDeleteAll}
                      disabled={deleting}
                      className="btn bg-red-600 hover:bg-red-700 text-white flex items-center"
                    >
                      {deleting ? (
                        <>
                          <span className="h-4 w-4 rounded-full border-2 border-[#0A1005]/30 border-t-[#0A1005] animate-spin mr-2" />
                          Suppression...
                        </>
                      ) : (
                        <>
                          <Trash2 size={18} strokeWidth={2} className="mr-2" />
                          Supprimer tous
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Filtres */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                {/* Sélecteur de zone */}
                <div>
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Wifi size={18} strokeWidth={2} />
                    <span>Zone WiFi</span>
                  </label>
                  <select
                    value={listZoneId}
                    onChange={(e) => {
                      setListZoneId(e.target.value);
                      setFilterStatus('');
                      setFilterPricing('');
                    }}
                    className="input"
                  >
                    <option value="">-- Sélectionnez une zone --</option>
                    {wifiZones.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filtre par statut */}
                <div>
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Filter size={18} strokeWidth={2} />
                    <span>Statut</span>
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => {
                      setFilterStatus(e.target.value);
                      handleFilterChange();
                    }}
                    className="input"
                    disabled={!listZoneId}
                  >
                    <option value="">Tous les statuts</option>
                    <option value="free">Libres</option>
                    <option value="sold">Vendus</option>
                    <option value="reserved">Réservés</option>
                    <option value="expired">Expirés</option>
                  </select>
                </div>

                {/* Filtre par tarif */}
                <div>
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Tag size={18} strokeWidth={2} />
                    <span>Tarif</span>
                  </label>
                  <select
                    value={filterPricing}
                    onChange={(e) => {
                      setFilterPricing(e.target.value);
                      handleFilterChange();
                    }}
                    className="input"
                    disabled={!listZoneId}
                  >
                    <option value="">Tous les tarifs</option>
                    {pricings.map((pricing) => (
                      <option key={pricing.id} value={pricing.id}>
                        {pricing.name || `FORFAIT ${pricing.amount} FCFA`} - {parseFloat(pricing.amount).toLocaleString()} FCFA
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bouton de rafraîchissement */}
              {listZoneId && (
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      loadTickets(listZoneId);
                      loadTicketStats(listZoneId);
                    }}
                    className="btn btn-secondary flex items-center text-sm"
                    disabled={loadingTickets}
                  >
                    <RefreshCw size={16} strokeWidth={2} className={`mr-2 ${loadingTickets ? 'animate-spin' : ''}`} />
                    Actualiser
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Liste des tickets */}
          {loadingTickets ? (
            <SkeletonTable rows={6} cols={5} />
          ) : tickets.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#101714] shadow-sm dark:shadow-black/30 py-16 px-6 text-center">
              <Ticket className="mx-auto text-gray-400 mb-4" size={48} strokeWidth={2} />
              <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Aucun ticket</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Importez des tickets pour commencer</p>
              <button
                onClick={() => setShowList(false)}
                className="inline-flex items-center justify-center gap-2 h-11 px-5 text-sm font-bold bg-lime-400 hover:bg-lime-300 text-[#0A1005] rounded-xl shadow-lg shadow-lime-400/25 transition-colors"
              >
                <Upload size={18} strokeWidth={2.5} />
                Importer des tickets
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#101714] shadow-sm dark:shadow-black/30 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-white/[0.03]">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Username
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Password
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Profile
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {tickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {ticket.username}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {ticket.password}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {ticket.profile || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(ticket.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {new Date(ticket.created_at).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteTicket(ticket.id);
                            }}
                            disabled={deletingTicketId === ticket.id}
                            className="inline-flex items-center px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Supprimer ce ticket"
                          >
                            {deletingTicketId === ticket.id ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 dark:border-red-400 mr-2"></div>
                                Suppression...
                              </>
                            ) : (
                              <>
                                <Trash2 size={16} strokeWidth={2} className="mr-1" />
                                Supprimer
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
