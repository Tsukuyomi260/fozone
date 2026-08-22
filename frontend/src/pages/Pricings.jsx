import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getWifiZones } from '../services/wifiZones';
import { getPricingsByZone, createPricing, deletePricing, updatePricing } from '../services/pricings';
import toast from 'react-hot-toast';
import { SkeletonHeader, SkeletonGrid } from '../components/Skeleton';
import { Plus, Tag, Wifi, DollarSign, Clock, FileText, Edit, Trash2, Check, X, Menu, Info } from 'lucide-react';

export default function Pricings() {
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState('');
  const [pricings, setPricings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPricing, setEditingPricing] = useState(null);

  useEffect(() => {
    loadZones();
  }, []);

  useEffect(() => {
    if (selectedZone) {
      loadPricings(selectedZone);
    } else {
      setPricings([]);
    }
  }, [selectedZone]);

  const loadZones = async () => {
    try {
      const response = await getWifiZones();
      setZones(response.zones || []);
      if (response.zones && response.zones.length > 0) {
        setSelectedZone(response.zones[0].id);
      }
    } catch (error) {
      toast.error('Erreur lors du chargement des zones');
    } finally {
      setLoading(false);
    }
  };

  const loadPricings = async (zoneId) => {
    try {
      const response = await getPricingsByZone(zoneId);
      const pricings = response.pricings || [];
      // Vérifier et logger les tarifs sans nom
      pricings.forEach(p => {
        if (!p.name) {
          console.error(`⚠️ Tarif ${p.id} n'a pas de nom!`, p);
        }
      });
      setPricings(pricings);
    } catch (error) {
      toast.error('Erreur lors du chargement des tarifs');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce tarif ?')) return;

    try {
      const response = await deletePricing(id);
      // Un tarif deja vendu est desactive et non supprime: on remonte le message
      // du serveur pour que l'utilisateur comprenne ce qui s'est passe.
      toast.success(response?.message || 'Tarif supprimé');
      loadPricings(selectedZone);
    } catch (error) {
      toast.error(error.message || 'Erreur lors de la suppression');
    }
  };

  if (loading) {
    return (
      <div className="space-y-5 md:space-y-6 w-full">
        <SkeletonHeader />
        <SkeletonGrid count={6} />
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
            Tarifs
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {!selectedZone
              ? 'Choisissez une zone pour voir ses tarifs'
              : `${pricings.length} tarif${pricings.length > 1 ? 's' : ''} sur cette zone`}
          </p>
        </div>
        {selectedZone && !showCreateForm && (
          <button onClick={() => setShowCreateForm(true)} className={primaryBtn}>
            <Plus size={18} strokeWidth={2.5} />
            Nouveau tarif
          </button>
        )}
      </div>

      {/* Sélection de zone */}
      {zones.length === 0 ? (
        <div className={`${card} py-16 px-6 text-center`}>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-lime-50 dark:bg-lime-400/10 mb-4">
            <Wifi className="text-lime-600 dark:text-lime-400" size={26} strokeWidth={2} />
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Aucune zone Wi-Fi</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">Créez d'abord une zone pour y ajouter des tarifs</p>
          <Link to="/zones" className={primaryBtn}>
            <Plus size={18} strokeWidth={2.5} />
            Créer une zone
          </Link>
        </div>
      ) : (
        <>
          <div className={`${card} p-4 flex flex-wrap items-center gap-3`}>
            <div className="w-9 h-9 rounded-xl bg-lime-50 dark:bg-lime-400/10 flex items-center justify-center flex-shrink-0">
              <Wifi size={17} strokeWidth={2.5} className="text-lime-600 dark:text-lime-400" />
            </div>
            <label htmlFor="zone-select" className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-600">
              Zone
            </label>
            <select
              id="zone-select"
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="flex-1 min-w-[200px] max-w-md h-10 px-3 rounded-xl text-sm bg-gray-100 dark:bg-white/[0.04] border border-transparent dark:border-white/[0.06] text-gray-900 dark:text-white outline-none focus:border-lime-400/50 transition-colors"
            >
              <option value="">Sélectionnez une zone Wi-Fi</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </div>

          {/* Formulaire de création */}
          {showCreateForm && selectedZone && (
            <CreatePricingForm
              zoneId={selectedZone}
              zoneName={zones.find(z => z.id === selectedZone)?.name}
              onCancel={() => {
                setShowCreateForm(false);
                setEditingPricing(null);
              }}
              onSuccess={() => {
                setShowCreateForm(false);
                setEditingPricing(null);
                loadPricings(selectedZone);
              }}
              editingPricing={editingPricing}
            />
          )}

          {/* Liste des tarifs */}
          {!showCreateForm && selectedZone && (
            <>
              {pricings.length === 0 ? (
                <div className={`${card} py-16 px-6 text-center`}>
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-lime-50 dark:bg-lime-400/10 mb-4">
                    <Tag className="text-lime-600 dark:text-lime-400" size={26} strokeWidth={2} />
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Aucun tarif</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">Créez votre premier tarif pour cette zone</p>
                  <button onClick={() => setShowCreateForm(true)} className={primaryBtn}>
                    <Plus size={18} strokeWidth={2.5} />
                    Créer un tarif
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {pricings.map((pricing) => (
                    <div
                      key={pricing.id}
                      className={`${card} p-5 flex flex-col transition-colors hover:border-lime-400/40 dark:hover:border-lime-400/30`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-4">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 truncate">
                            {pricing.name || 'Sans nom'}
                          </h3>
                          <p className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mt-1.5 leading-none">
                            {parseFloat(pricing.amount).toLocaleString()}
                            <span className="text-sm font-bold text-gray-400 dark:text-gray-500 ml-1.5">FCFA</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button
                            onClick={() => {
                              setEditingPricing(pricing);
                              setShowCreateForm(true);
                            }}
                            className="p-2 rounded-lg text-gray-400 dark:text-gray-600 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
                            title="Modifier"
                          >
                            <Edit size={16} strokeWidth={2} />
                          </button>
                          <button
                            onClick={() => handleDelete(pricing.id)}
                            className="p-2 rounded-lg text-gray-400 dark:text-gray-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={16} strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                      <div className="flex-1">
                        {pricing.duration_hours && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-lime-50 dark:bg-lime-400/10 text-lime-700 dark:text-lime-400">
                            <Clock size={12} strokeWidth={2.5} />
                            {pricing.duration_hours}h
                          </span>
                        )}
                        {pricing.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-3">
                            {pricing.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function CreatePricingForm({ zoneId, zoneName, onCancel, onSuccess, editingPricing }) {
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    duration_hours: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingPricing) {
      setFormData({
        name: editingPricing.name || '',
        amount: editingPricing.amount?.toString() || '',
        duration_hours: editingPricing.duration_hours?.toString() || '',
        description: editingPricing.description || '',
      });
    } else {
      // Réinitialiser le formulaire si on n'est pas en mode édition
      setFormData({
        name: '',
        amount: '',
        duration_hours: '',
        description: '',
      });
    }
  }, [editingPricing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Préparer les données avec les bons types
      const pricingData = {
        name: formData.name?.trim() || '', // S'assurer que name est toujours une string
        amount: parseFloat(formData.amount),
        description: formData.description?.trim() || null,
      };
      
      // Vérifier que name n'est pas vide
      if (!pricingData.name || pricingData.name === '') {
        toast.error('Le nom du forfait est requis');
        setLoading(false);
        return;
      }
      
      console.log('Données envoyées au backend:', pricingData); // Debug

      // Ajouter duration_hours seulement si fourni et valide
      const durationStr = formData.duration_hours?.toString().trim() || '';
      if (durationStr !== '') {
        const hours = parseInt(durationStr);
        if (!isNaN(hours) && hours > 0) {
          pricingData.duration_hours = hours;
        }
      }

      if (editingPricing) {
        const response = await updatePricing(editingPricing.id, pricingData);
        console.log('Tarif mis à jour:', response); // Debug
        if (response.pricing && !response.pricing.name) {
          console.error('⚠️ Le tarif mis à jour n\'a pas de nom!', response.pricing);
        }
        toast.success('Tarif mis à jour avec succès !');
      } else {
        const response = await createPricing(zoneId, pricingData);
        console.log('Tarif créé:', response); // Debug
        if (response.pricing && !response.pricing.name) {
          console.error('⚠️ Le tarif créé n\'a pas de nom!', response.pricing);
          console.error('Données envoyées:', pricingData);
        }
        toast.success('Tarif créé avec succès !');
      }
      
      // Réinitialiser le formulaire
      setFormData({
        name: '',
        amount: '',
        duration_hours: '',
        description: '',
      });
      
      // Attendre un peu avant de recharger pour s'assurer que la DB est à jour
      await new Promise(resolve => setTimeout(resolve, 300));
      
      onSuccess();
    } catch (error) {
      console.error('Erreur création tarif:', error);
      console.error('Détails complets:', {
        message: error.message,
        details: error.details,
        response: error.response,
        status: error.status
      });
      
      // Construire un message d'erreur détaillé
      let errorMessage = error.message || 'Erreur lors de la création du tarif';
      
      // Si on a des détails de validation
      if (error.details && Array.isArray(error.details)) {
        const validationErrors = error.details
          .map(err => err.message || err.msg || `${err.path || err.param}: ${err.msg || 'Erreur de validation'}`)
          .join('; ');
        errorMessage = `Erreur de validation: ${validationErrors}`;
      } else if (error.details && typeof error.details === 'string') {
        errorMessage = `${errorMessage}: ${error.details}`;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#101714] shadow-sm dark:shadow-black/30 p-5 md:p-6">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-lime-50 dark:bg-lime-400/10 flex items-center justify-center flex-shrink-0">
            <Tag className="text-lime-600 dark:text-lime-400" size={20} strokeWidth={2.5} />
          </div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            {editingPricing ? 'Modifier le tarif' : 'Créer un nouveau tarif'}
          </h2>
        </div>
        <Link
          to="/pricings"
          className="inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-bold bg-lime-400 hover:bg-lime-300 text-[#0A1005] rounded-xl shadow-lg shadow-lime-400/25 transition-colors"
        >
          <Menu size={18} className="mr-2" />
          <span className="hidden sm:inline">Voir tous les tarifs</span>
          <span className="sm:hidden">Voir tarifs</span>
        </Link>
      </div>

      {/* Notice importante */}
      <div className="bg-lime-50 dark:bg-lime-400/[0.07] border border-lime-200 dark:border-lime-400/20 rounded-xl p-3 md:p-4 mb-6">
        <div className="flex items-start space-x-2 md:space-x-3">
          <Info className="text-lime-600 dark:text-lime-400 flex-shrink-0 mt-0.5" size={18} />
          <p className="text-xs md:text-sm text-lime-800 dark:text-lime-300">
            <strong>Conseil :</strong> Créez des tarifs attractifs et adaptés à votre clientèle. Une bonne structure tarifaire est essentielle pour maximiser vos ventes.
          </p>
        </div>
      </div>

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 lg:gap-8">
          {/* Colonne gauche */}
          <div className="space-y-4 md:space-y-6">
            {/* Zone WiFi (affichage seulement si création) */}
            {!editingPricing && (
              <div>
                <label className="flex items-center space-x-2 text-xs md:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 md:mb-2">
                  <Wifi size={16} strokeWidth={2} />
                  <span>Zone WiFi</span>
                </label>
                <input
                  type="text"
                  value={zoneName || ''}
                  disabled
                  className="input text-sm md:text-base bg-gray-50 dark:bg-gray-700 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Choisissez la zone WiFi à laquelle ce tarif sera associé
                </p>
              </div>
            )}

            {/* Nom du forfait */}
            <div>
              <label className="flex items-center space-x-2 text-xs md:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 md:mb-2">
                <Tag size={16} strokeWidth={2} />
                <span>Nom du forfait</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Ex: 1 HEURE"
                className="input text-sm md:text-base"
                required
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Donnez un nom clair et attractif à votre forfait
              </p>
            </div>

            {/* Durée de validité */}
            <div>
              <label className="flex items-center space-x-2 text-xs md:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 md:mb-2">
                <Clock size={16} strokeWidth={2} />
                <span>Durée de validité</span>
              </label>
              <input
                type="text"
                name="duration_hours"
                value={formData.duration_hours}
                onChange={handleChange}
                placeholder="Ex: 1H, 24H, 7J"
                className="input text-sm md:text-base"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Précisez la durée de validité du forfait (heures ou jours). Ex: 1 pour 1 heure, 24 pour 24 heures, 168 pour 7 jours
              </p>
            </div>
          </div>

          {/* Colonne droite */}
          <div className="space-y-4 md:space-y-6">
            {/* Description */}
            <div>
              <label className="flex items-center space-x-2 text-xs md:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 md:mb-2">
                <FileText size={16} strokeWidth={2} />
                <span>Description</span>
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Ex: Internet haute vitesse illimité"
                rows={4}
                className="input resize-none text-sm md:text-base"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Décrivez les avantages de ce forfait
              </p>
            </div>

            {/* Prix */}
            <div>
              <label className="flex items-center space-x-2 text-xs md:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 md:mb-2">
                <DollarSign size={16} strokeWidth={2} />
                <span>Prix (FCFA)</span>
              </label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                placeholder="Ex: 500"
                className="input text-sm md:text-base"
                required
                min="100"
                step="1"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Valeur minimum 100 FCFA
              </p>
            </div>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 sm:gap-4 pt-4 md:pt-6 border-t border-gray-200 dark:border-white/10">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-all duration-200 order-2 sm:order-1 flex items-center justify-center gap-2"
          >
            <X size={18} strokeWidth={2} />
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="h-11 px-5 text-sm font-bold bg-lime-400 hover:bg-lime-300 text-[#0A1005] rounded-xl shadow-lg shadow-lime-400/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2 inline-flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-[#0A1005]/30 border-t-[#0A1005] animate-spin" />
                {editingPricing ? 'Modification...' : 'Création...'}
              </>
            ) : (
              <>
                <Check size={18} strokeWidth={2} />
                {editingPricing ? 'Modifier le tarif' : 'Créer le tarif'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
