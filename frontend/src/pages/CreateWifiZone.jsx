import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Wifi, Tag, Server, FileText, Phone, Info, Menu, Globe } from 'lucide-react';
import { createWifiZone } from '../services/wifiZones';
import { COUNTRY_LIST, DEFAULT_COUNTRY, getCountry } from '../config/countries';
import toast from 'react-hot-toast';

export default function CreateWifiZone({ onCancel, onSuccess }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    router_ip: '',
    manager_phone: '',
    // Determine les moyens de paiement proposes a vos clients
    country: DEFAULT_COUNTRY,
    address: '', // Description dans l'UI
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Vérifier que le token existe
      const token = localStorage.getItem('auth_token');
      if (!token) {
        toast.error('Vous devez être connecté pour créer une zone');
        navigate('/login');
        return;
      }

      await createWifiZone(formData);
      toast.success('Zone Wi-Fi créée avec succès !');
      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/zones');
      }
    } catch (error) {
      console.error('Error creating zone:', error);
      // Si erreur d'authentification, rediriger vers login
      if (error.message && (error.message.includes('token') || error.message.includes('401') || error.message.includes('403'))) {
        toast.error('Session expirée. Veuillez vous reconnecter.');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        navigate('/login');
      } else {
        toast.error(error.message || 'Erreur lors de la création de la zone');
      }
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
    <div className="w-full space-y-4 md:space-y-6">
      {/* Titre principal */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-green-700 dark:text-green-500">
          Créez et gérez vos zones WiFi
        </h1>
        
        {/* Breadcrumb */}
        <nav className="mt-1 md:mt-2 text-xs md:text-sm text-gray-600 dark:text-gray-400">
          <span>Accueil</span>
          <span className="mx-1 md:mx-2">/</span>
          <span>Gestion des Wifi Zone</span>
          <span className="mx-1 md:mx-2">/</span>
          <span className="text-green-600 dark:text-green-400 font-medium">
            Ajouter un Wifi Zone
          </span>
        </nav>
      </div>

      {/* Card principale */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-green-100 dark:border-gray-700 p-4 md:p-6 lg:p-8">
        {/* En-tête de section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 md:mb-6">
          <div className="flex items-center space-x-2 md:space-x-3">
            <div className="p-1.5 md:p-2 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 rounded-xl shadow-sm">
              <Wifi className="text-green-600 dark:text-green-400" size={20} />
            </div>
            <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
              Ajouter un nouveau Wifi Zone
            </h2>
          </div>
          <Link
            to="/zones"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 text-sm md:text-base"
          >
            <Menu size={16} className="mr-2" />
            <span className="hidden sm:inline">Voir mes Wifi Zones</span>
            <span className="sm:hidden">Mes Zones</span>
          </Link>
        </div>

        {/* Notice importante */}
        <div className="bg-gradient-to-r from-green-50 to-green-50/50 dark:from-green-900/20 dark:to-green-800/10 border border-green-200 dark:border-green-800 rounded-xl p-3 md:p-4 mb-4 md:mb-6">
          <div className="flex items-start space-x-2 md:space-x-3">
            <Info className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-xs md:text-sm text-green-800 dark:text-green-300">
              <strong>Important :</strong> Les informations que vous saisissez ici seront utilisées pour configurer et identifier votre zone WiFi. Assurez-vous de fournir des informations précises pour une meilleure gestion.
            </p>
          </div>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 lg:gap-8">
            {/* Colonne gauche */}
            <div className="space-y-4 md:space-y-6">
              {/* Nom du WiFi Zone */}
              <div>
                <label className="flex items-center space-x-2 text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 md:mb-2">
                  <Tag size={16} />
                  <span>Nom du WiFi Zone</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Ex: Cyber Café Central"
                  className="input text-sm md:text-base"
                  required
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Choisissez le nom correspondant à votre zone WiFi existant ou celui que vous voulez installer.
                </p>
              </div>

              {/* Adresse IP du routeur */}
              <div>
                <label className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 md:mb-2">
                  <span className="flex items-center">
                    <Server size={16} className="mr-2" />
                    <span className="sm:hidden">Adresse IP/DNS/VPN</span>
                  </span>
                  <span className="hidden sm:inline">Adresse IP du routeur ou le DNS local ou encore le VPN</span>
                </label>
                <input
                  type="text"
                  name="router_ip"
                  value={formData.router_ip}
                  onChange={handleChange}
                  placeholder="Ex: 192.168.30.1 ou galaxie.net"
                  className="input text-sm md:text-base"
                  required
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Ce champ est facultatif mais très important car il permet la connexion automatique de vos clients après la génération du ticket.
                </p>
              </div>
            </div>

            {/* Colonne droite */}
            <div className="space-y-4 md:space-y-6">
              {/* Description */}
              <div>
                <label className="flex items-center space-x-2 text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 md:mb-2">
                  <FileText size={16} />
                  <span>Description</span>
                </label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Ex: WiFi haute vitesse situé au centre-ville, idéal pour le travail et les études"
                  rows={4}
                  className="input resize-none text-sm md:text-base"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Une bonne description aide vos clients à comprendre les avantages de votre zone WiFi.
                </p>
              </div>

              {/* Pays: commande les moyens de paiement proposes au client */}
              <div>
                <label className="flex items-center space-x-2 text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 md:mb-2">
                  <Globe size={16} />
                  <span>Pays de la zone</span>
                </label>
                <select
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  className="input text-sm md:text-base"
                  required
                >
                  {COUNTRY_LIST.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Détermine les moyens de paiement proposés à vos clients (MTN, Moov,
                  Orange, Wave selon le pays).
                </p>
              </div>

              {/* Votre contact */}
              <div>
                <label className="flex items-center space-x-2 text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 md:mb-2">
                  <Phone size={16} />
                  <span>Votre contact</span>
                </label>
                <input
                  type="tel"
                  name="manager_phone"
                  value={formData.manager_phone}
                  onChange={handleChange}
                  placeholder={`Ex: +${getCountry(formData.country).dialCode} ${getCountry(formData.country).placeholder}`}
                  className="input text-sm md:text-base"
                  required
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Ce numéro sera utilisé par vos clients pour obtenir de l'assistance au besoin.
                </p>
              </div>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 sm:gap-4 pt-4 md:pt-6 border-t border-green-100 dark:border-gray-700">
            <button
              type="button"
              onClick={() => {
                if (onCancel) {
                  onCancel();
                } else {
                  navigate('/zones');
                }
              }}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-all duration-200 order-2 sm:order-1"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2"
            >
              {loading ? 'Création...' : 'Créer la zone WiFi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

