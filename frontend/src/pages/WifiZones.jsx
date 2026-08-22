import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getWifiZones, deleteWifiZone } from '../services/wifiZones';
import toast from 'react-hot-toast';
import { Plus, MapPin, Trash2, Edit, Wifi, Phone, ArrowUpRight, Server } from 'lucide-react';
import CreateWifiZone from './CreateWifiZone';

export default function WifiZones() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    loadZones();
  }, []);

  const loadZones = async () => {
    try {
      const response = await getWifiZones();
      setZones(response.zones || []);
    } catch (error) {
      toast.error('Erreur lors du chargement des zones');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette zone ?')) return;

    try {
      await deleteWifiZone(id);
      toast.success('Zone supprimée');
      loadZones();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const formatDate = (value) => {
    if (!value) return null;
    return new Date(value).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-lime-400/25 border-t-lime-400"></div>
      </div>
    );
  }

  const card =
    'rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#101714] shadow-sm dark:shadow-black/30';

  const primaryBtn =
    'inline-flex items-center justify-center gap-2 h-11 px-5 text-sm font-bold bg-lime-400 hover:bg-lime-300 text-[#0A1005] rounded-xl shadow-lg shadow-lime-400/25 transition-colors';

  return (
    <div className="space-y-5 md:space-y-6 w-full">
      {/* En-tête */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            Zones Wi-Fi
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {zones.length === 0
              ? 'Aucun point d\'accès configuré'
              : `${zones.length} point${zones.length > 1 ? 's' : ''} d'accès`}
          </p>
        </div>
        {!showCreateForm && (
          <button onClick={() => setShowCreateForm(true)} className={primaryBtn}>
            <Plus size={18} strokeWidth={2.5} />
            Nouvelle zone
          </button>
        )}
      </div>

      {/* Formulaire de création */}
      {showCreateForm && (
        <CreateWifiZone
          onCancel={() => setShowCreateForm(false)}
          onSuccess={() => {
            setShowCreateForm(false);
            loadZones();
          }}
        />
      )}

      {/* Liste des zones */}
      {!showCreateForm && (
        <>
          {zones.length === 0 ? (
            <div className={`${card} text-center py-16 px-6`}>
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-lime-50 dark:bg-lime-400/10 mb-4">
                <MapPin className="text-lime-600 dark:text-lime-400" size={26} strokeWidth={2} />
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                Aucune zone Wi-Fi
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
                Commencez par créer votre première zone
              </p>
              <button onClick={() => setShowCreateForm(true)} className={primaryBtn}>
                <Plus size={18} strokeWidth={2.5} />
                Créer votre première zone
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {zones.map((zone) => (
                <div
                  key={zone.id}
                  className={`${card} p-5 flex flex-col transition-colors hover:border-lime-400/40 dark:hover:border-lime-400/30`}
                >
                  {/* Titre + actions */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-lime-50 dark:bg-lime-400/10 flex items-center justify-center">
                        <Wifi className="text-lime-600 dark:text-lime-400" size={19} strokeWidth={2.5} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white truncate leading-tight">
                          {zone.name}
                        </h3>
                        {zone.created_at && (
                          <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-1">
                            Créée le {formatDate(zone.created_at)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <Link
                        to={`/zones/${zone.id}`}
                        className="p-2 rounded-lg text-gray-400 dark:text-gray-600 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
                        title="Modifier"
                      >
                        <Edit size={16} strokeWidth={2} />
                      </Link>
                      <button
                        onClick={() => handleDelete(zone.id)}
                        className="p-2 rounded-lg text-gray-400 dark:text-gray-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={16} strokeWidth={2} />
                      </button>
                    </div>
                  </div>

                  {/* Détails */}
                  <div className="space-y-2 mb-5 flex-1">
                    <div className="flex items-center gap-2.5 text-xs">
                      <Server size={13} className="text-gray-400 dark:text-gray-600 flex-shrink-0" strokeWidth={2} />
                      <span className="text-gray-600 dark:text-gray-400 truncate font-mono">
                        {zone.router_ip}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs">
                      <Phone size={13} className="text-gray-400 dark:text-gray-600 flex-shrink-0" strokeWidth={2} />
                      <span className="text-gray-600 dark:text-gray-400 truncate">
                        {zone.manager_phone}
                      </span>
                    </div>
                    {zone.address && (
                      <div className="flex items-start gap-2.5 text-xs">
                        <MapPin size={13} className="text-gray-400 dark:text-gray-600 flex-shrink-0 mt-0.5" strokeWidth={2} />
                        <span className="text-gray-600 dark:text-gray-400 line-clamp-2">
                          {zone.address}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Lien détails */}
                  <Link
                    to={`/zones/${zone.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-lime-700 dark:text-lime-400 hover:text-lime-600 dark:hover:text-lime-300 transition-colors"
                  >
                    Voir les détails
                    <ArrowUpRight size={14} strokeWidth={2.5} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
