import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ShoppingCart, Wifi, MessageCircle } from 'lucide-react';
import { getPublicWifiZoneById } from '../services/wifiZones';
import { getPublicPricingsByZone } from '../services/pricings';
import { createPaymentIntent } from '../services/payments';
import toast from 'react-hot-toast';

export default function BuyTicket() {
  const { zoneId } = useParams();
  const [zone, setZone] = useState(null);
  const [pricings, setPricings] = useState([]);
  const [selectedPricing, setSelectedPricing] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, [zoneId]);

  const loadData = async () => {
    try {
      const [zoneData, pricingsData] = await Promise.all([
        getPublicWifiZoneById(zoneId),
        getPublicPricingsByZone(zoneId),
      ]);
      setZone(zoneData.zone);
      setPricings(pricingsData.pricings || []);
    } catch (error) {
      toast.error(error.message || 'Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const formatPricingLabel = (pricing) => {
    // Utiliser le nom du forfait si disponible
    if (pricing.name) {
      return `${pricing.name} - ${parseFloat(pricing.amount).toLocaleString()} FCFA`;
    }
    // Sinon, utiliser la description ou la durée
    if (pricing.description) {
      return `${pricing.description} - ${parseFloat(pricing.amount).toLocaleString()} FCFA`;
    }
    if (pricing.duration_hours) {
      const hours = pricing.duration_hours;
      if (hours === 24) return `24h - ${parseFloat(pricing.amount).toLocaleString()} FCFA`;
      if (hours === 72) return `3J - ${parseFloat(pricing.amount).toLocaleString()} FCFA`;
      if (hours === 168) return `7j - ${parseFloat(pricing.amount).toLocaleString()} FCFA`;
      if (hours === 720) return `30j - ${parseFloat(pricing.amount).toLocaleString()} FCFA`;
      if (hours === 6) return `6H - ${parseFloat(pricing.amount).toLocaleString()} FCFA`;
      return `${hours}h - ${parseFloat(pricing.amount).toLocaleString()} FCFA`;
    }
    return `${parseFloat(pricing.amount).toLocaleString()} FCFA`;
  };

  // Le numero part chez Moneroo et sert de reference client dans la
  // comptabilite. On n'envoie que des chiffres: un numero beninois saisi
  // a 8 chiffres recoit l'indicatif 229.
  const normalizePhone = (value) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 8) return `229${digits}`;
    return digits;
  };

  const normalizedPhone = normalizePhone(phone);
  const phoneIsValid = normalizedPhone.length >= 8;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedPricing) {
      toast.error('Veuillez sélectionner un tarif');
      return;
    }

    if (!phoneIsValid) {
      toast.error('Veuillez saisir un numéro de téléphone valide');
      return;
    }

    setProcessing(true);

    try {
      const response = await createPaymentIntent({
        wifi_zone_id: zoneId,
        pricing_id: selectedPricing,
        customer: {
          email: `client-${Date.now()}@wifi.local`,
          first_name: 'Client',
          last_name: 'WiFi',
          phone: normalizedPhone,
        },
      });

      if (response.payment?.checkout_url) {
        // Rediriger vers Moneroo
        window.location.href = response.payment.checkout_url;
      } else {
        toast.error('Erreur lors de la création du paiement');
      }
    } catch (error) {
      toast.error(error.message || 'Erreur lors de la création du paiement');
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!zone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Zone Wi-Fi introuvable</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50/30 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Card principale */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-green-100 dark:border-gray-700 p-6">
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center mb-4">
              <Wifi className="text-green-600 dark:text-green-400" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-green-600 dark:text-green-400">
              Fo-Zone
            </h1>
          </div>

          {/* Message de connexion */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Vous êtes connecté sur le Wifi Zone :{' '}
              <span className="text-green-600 dark:text-green-400">{zone.name}</span>
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Vous êtes sur le point d'acheter un accès internet sur Ticket Wifi Zone. 
              Sélectionnez le tarif qui convient le mieux à vos besoins.
            </p>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Sélection du tarif */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tarifs Internet
              </label>
              <select
                value={selectedPricing}
                onChange={(e) => setSelectedPricing(e.target.value)}
                className="input w-full"
                required
              >
                <option value="">-- Sélectionnez un tarif --</option>
                {pricings.map((pricing) => (
                  <option key={pricing.id} value={pricing.id}>
                    {formatPricingLabel(pricing)}
                  </option>
                ))}
              </select>
            </div>

            {/* Numéro de téléphone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Numéro de téléphone
              </label>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="97 00 00 00"
                className="input w-full"
                required
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Le numéro Mobile Money qui servira au paiement.
              </p>
            </div>

            {/* Bouton Acheter */}
            <button
              type="submit"
              disabled={processing || !selectedPricing || !phoneIsValid}
              className="w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Traitement...
                </>
              ) : (
                <>
                  <ShoppingCart size={20} className="mr-2" />
                  Acheter
                </>
              )}
            </button>
          </form>

          {/* Contact support */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
              Si vous avez besoin d'assistance ou besoin d'aide pour acheter le ticket, veuillez contacter le :
            </p>
            <div className="flex items-center justify-center mt-2">
              <MessageCircle className="text-green-600 dark:text-green-400 mr-2" size={20} />
              <a
                href={`https://wa.me/2290153489846`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 dark:text-green-400 font-medium text-sm hover:underline"
              >
                +229 01 53 48 98 46
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

