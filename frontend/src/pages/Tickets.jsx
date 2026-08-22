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
      free: { bg: 'bg-green-100 dark:bg-green-900/20', text: 'text-green-800 dark:text-green-300', label: 'Libre' },
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

  return (
    <div className="space-y-6 md:space-y-8 w-full">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-green-700 dark:text-green-500 tracking-tight">
          Ajoutez de nouveaux tickets Wifi Zone
        </h1>
        <nav className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          <span>Accueil</span>
          <span className="mx-2">/</span>
          <span>Gestion des accès WiFi</span>
          <span className="mx-2">/</span>
          <span className="text-green-600 dark:text-green-400 font-medium">
            {showList ? 'Consulter liste ticket' : 'Ajouter un ticket'}
          </span>
        </nav>
      </div>

      {/* Section Statistiques */}
      {showList && selectedZone && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-green-100 dark:border-gray-700 p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  Total
                </p>
                <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.total || 0}
                </p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-xl">
                <Ticket className="text-blue-600 dark:text-blue-400" size={24} strokeWidth={2.5} />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-green-100 dark:border-gray-700 p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  Libres
                </p>
                <p className="text-xl md:text-2xl font-bold text-green-600 dark:text-green-400">
                  {stats.free || 0}
                </p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-xl">
                <CheckCircle className="text-green-600 dark:text-green-400" size={24} strokeWidth={2.5} />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-green-100 dark:border-gray-700 p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  Vendus
                </p>
                <p className="text-xl md:text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.sold || 0}
                </p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-xl">
                <TrendingUp className="text-blue-600 dark:text-blue-400" size={24} strokeWidth={2.5} />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-green-100 dark:border-gray-700 p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  Réservés
                </p>
                <p className="text-xl md:text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {stats.reserved || 0}
                </p>
              </div>
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-xl">
                <Clock className="text-yellow-600 dark:text-yellow-400" size={24} strokeWidth={2.5} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Formulaire d'import ou Liste des tickets */}
      {!showList ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-green-100 dark:border-gray-700 p-4 md:p-6 lg:p-8">
          {/* En-tête de section */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
            <div className="flex items-center space-x-3 mb-4 sm:mb-0">
              <div className="p-2 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 rounded-xl shadow-sm">
                <Tag className="text-green-600 dark:text-green-400" size={24} strokeWidth={2.5} />
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
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
          <div className="bg-gradient-to-r from-green-50 to-green-50/50 dark:from-green-900/20 dark:to-green-800/10 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-6">
            <div className="flex items-start space-x-3">
              <Info className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" size={20} strokeWidth={2} />
              <p className="text-sm text-green-800 dark:text-green-300">
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
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex flex-col space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
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
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
            </div>
          ) : tickets.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 md:p-12 text-center">
              <Ticket className="mx-auto text-gray-400 mb-4" size={48} strokeWidth={2} />
              <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Aucun ticket</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Importez des tickets pour commencer</p>
              <button
                onClick={() => setShowList(false)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
              >
                <Upload size={18} strokeWidth={2.5} />
                Importer des tickets
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
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
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
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
