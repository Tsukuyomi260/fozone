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

  return (
    <div className="space-y-6 md:space-y-8 w-full">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">
            Tarifs
          </h1>
          <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 font-medium">
            Gérez les tarifs de vos zones Wi-Fi
          </p>
        </div>
        {selectedZone && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center justify-center gap-2 h-11 px-6 font-semibold bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 transition-all duration-200 hover:scale-105"
          >
            <Plus size={20} strokeWidth={2.5} />
            Nouveau tarif
          </button>
        )}
      </div>

      {/* Sélection de zone */}
      {zones.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-green-100 dark:border-gray-700 p-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 rounded-2xl mb-4">
            <Wifi className="text-green-600 dark:text-green-400" size={40} strokeWidth={2} />
          </div>
          <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Aucune zone Wi-Fi</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Créez d'abord une zone Wi-Fi pour ajouter des tarifs</p>
          <Link to="/zones" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105">
            <Plus size={18} strokeWidth={2.5} />
            Créer une zone
          </Link>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-green-100 dark:border-gray-700 p-4 md:p-6">
            <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              <div className="p-1.5 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 rounded-lg">
                <Wifi size={18} strokeWidth={2} className="text-green-600 dark:text-green-400" />
              </div>
              <span>Zone WiFi</span>
            </label>
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="input w-full max-w-md"
            >
              <option value="">Sélectionnez la zone WiFi concernée</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Choisissez la zone WiFi à laquelle ce tarif sera associé
            </p>
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
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-green-100 dark:border-gray-700 p-8 md:p-12 text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 rounded-2xl mb-4">
                    <Tag className="text-green-600 dark:text-green-400" size={40} strokeWidth={2} />
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Aucun tarif</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Créez votre premier tarif pour cette zone</p>
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                  >
                    <Plus size={18} strokeWidth={2.5} />
                    Créer un tarif
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {pricings.map((pricing) => (
                    <div
                      key={pricing.id}
                      className="group bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-green-100 dark:border-gray-700 p-5 md:p-6 hover:shadow-xl hover:border-green-300 dark:hover:border-green-700 hover:scale-[1.02] transition-all duration-200"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                            {pricing.name || 'Sans nom'}
                          </h3>
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {parseFloat(pricing.amount).toLocaleString()} FCFA
                          </p>
                        </div>
                        <div className="flex space-x-1.5 ml-2">
                          <button
                            onClick={() => {
                              setEditingPricing(pricing);
                              setShowCreateForm(true);
                            }}
                            className="p-2 text-gray-500 hover:text-green-600 dark:hover:text-green-400 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20 transition-all"
                            title="Modifier"
                          >
                            <Edit size={18} strokeWidth={2} />
                          </button>
                          <button
                            onClick={() => handleDelete(pricing.id)}
                            className="p-2 text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                            title="Supprimer"
                          >
                            <Trash2 size={18} strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        {pricing.duration_hours && (
                          <p className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                            <Clock size={16} strokeWidth={2} />
                            <span>{pricing.duration_hours}h</span>
                          </p>
                        )}
                        {pricing.description && (
                          <p className="text-gray-600 dark:text-gray-400 line-clamp-2">
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
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-green-100 dark:border-gray-700 p-6 md:p-8">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 rounded-xl shadow-sm">
            <Tag className="text-green-600 dark:text-green-400" size={20} strokeWidth={2.5} />
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
            {editingPricing ? 'Modifier le tarif' : 'Créer un nouveau tarif'}
          </h2>
        </div>
        <Link
          to="/pricings"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 text-sm md:text-base"
        >
          <Menu size={18} className="mr-2" />
          <span className="hidden sm:inline">Voir tous les tarifs</span>
          <span className="sm:hidden">Voir tarifs</span>
        </Link>
      </div>

      {/* Notice importante */}
      <div className="bg-gradient-to-r from-green-50 to-green-50/50 dark:from-green-900/20 dark:to-green-800/10 border border-green-200 dark:border-green-800 rounded-xl p-3 md:p-4 mb-6">
        <div className="flex items-start space-x-2 md:space-x-3">
          <Info className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" size={18} />
          <p className="text-xs md:text-sm text-green-800 dark:text-green-300">
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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 sm:gap-4 pt-4 md:pt-6 border-t border-green-100 dark:border-gray-700">
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
            className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
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
