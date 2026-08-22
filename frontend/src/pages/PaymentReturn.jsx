import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Wifi, Copy, RefreshCw, MessageCircle } from 'lucide-react';
import { getPaymentStatus } from '../services/payments';
import toast from 'react-hot-toast';
import Logo from '../components/Logo';

export default function PaymentReturn() {
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get('paymentId');
  const paymentStatus = searchParams.get('paymentStatus');
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);


  useEffect(() => {
    if (paymentId) {
      loadPaymentStatus();
    } else {
      setLoading(false);
    }
  }, [paymentId]);

  const loadPaymentStatus = async () => {
    try {
      const response = await getPaymentStatus(paymentId);
      setPayment(response.payment);
    } catch (error) {
      toast.error(error.message || 'Erreur lors de la récupération du paiement');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setChecking(true);
    await loadPaymentStatus();
    setChecking(false);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copié dans le presse-papiers');
  };

  const formatCredentials = () => {
    if (payment?.tickets && payment.tickets.length > 0) {
      const ticket = payment.tickets[0];
      if (ticket?.username && ticket?.password) {
        return {
          username: ticket.username,
          password: ticket.password,
        };
      }
    }
    return null;
  };

  const formatDuration = (hours) => {
    if (!hours) return null;
    if (hours === 6) return '6H';
    if (hours === 24) return '24H';
    if (hours === 72) return '3J';
    if (hours === 168) return '7J';
    if (hours === 720) return '30J';
    return `${hours}H`;
  };

  const getPaymentReference = () => {
    // Utiliser l'ID interne du paiement comme référence
    if (payment?.id) {
      return payment.id.substring(0, 15).toUpperCase();
    }
    return payment?.moneroo_payment_id || 'N/A';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-green-50/30 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  const credentials = formatCredentials();
  const isSuccess = paymentStatus === 'success' && payment?.status === 'completed';
  const isPending = payment?.status === 'pending';
  const isFailed = paymentStatus === 'failed' || payment?.status === 'failed';
  const hasCredentials = credentials && credentials.username && credentials.password;

  // Récupérer la durée depuis le pricing
  // Le pricing peut être un objet ou un tableau selon Supabase
  // Le tarif fige sur le paiement fait foi: la ligne pricings peut avoir ete
  // supprimee depuis la vente. Le join ne sert que de repli pour les anciens
  // paiements crees avant la migration 007.
  // Supabase renvoie le join comme objet ou comme tableau selon la relation
  const joined = Array.isArray(payment?.pricings) ? payment.pricings[0] : payment?.pricings;
  const pricingData = {
    name: payment?.pricing_name || joined?.name,
    duration_hours: payment?.pricing_duration_hours ?? joined?.duration_hours
  };
  const duration = pricingData?.duration_hours ? formatDuration(pricingData.duration_hours) : null;

  // Récupérer le router_ip depuis la zone WiFi
  const wifiZone = payment?.wifi_zones;
  const routerIp = wifiZone?.router_ip || (Array.isArray(wifiZone) ? wifiZone[0]?.router_ip : null);
  
  // Construire l'URL de login du portail captif
  const getLoginUrl = (ip) => {
    if (!ip) return null;
    // Nettoyer l'IP (enlever http:// ou https:// si présent)
    const cleanIp = ip.replace(/^https?:\/\//, '').replace(/\/$/, '');
    // URL standard pour les portails captifs MikroTik/ChilliSpot
    return `http://${cleanIp}/login`;
  };
  
  const loginUrl = getLoginUrl(routerIp);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50/30 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-8 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-green-100 dark:border-gray-700 overflow-hidden">
          {/* Badge Logo en haut */}
          <div className="bg-gradient-to-r from-green-400 via-green-500 to-green-400 px-6 py-5 text-center">
            <div className="flex items-center justify-center gap-3">
              <Logo size="lg" className="text-white" />
            </div>
          </div>

          <div className="p-6 md:p-8">
            {/* Message de remerciement */}
            {isSuccess && (
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 rounded-full mb-4">
                  <CheckCircle className="text-green-600 dark:text-green-400" size={32} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Paiement réussi !
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                  Merci pour votre achat ! Voici vos identifiants de connexion. Vous pouvez faire une capture d'écran pour garder ou les copier.
                </p>
              </div>
            )}

            {/* Statut en attente */}
            {isPending && (
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-yellow-100 to-yellow-50 dark:from-yellow-900/30 dark:to-yellow-800/20 rounded-full mb-4">
                  <RefreshCw className="text-yellow-600 dark:text-yellow-400 animate-spin" size={32} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Paiement en cours de traitement
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Veuillez patienter, nous vérifions votre paiement...
                </p>
                <button
                  onClick={handleRefresh}
                  disabled={checking}
                  className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {checking ? 'Vérification...' : 'Actualiser'}
                </button>
              </div>
            )}

            {/* Statut échec */}
            {isFailed && (
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-800/20 rounded-full mb-4">
                  <XCircle className="text-red-600 dark:text-red-400" size={32} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Paiement échoué
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Votre paiement n'a pas pu être traité. Veuillez réessayer.
                </p>
              </div>
            )}

            {/* Message si paiement complété mais pas encore de ticket */}
            {isSuccess && !hasCredentials && (
              <div className="text-center mb-6">
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Votre paiement a été confirmé. Les identifiants de connexion sont en cours de préparation...
                </p>
                <button
                  onClick={handleRefresh}
                  disabled={checking}
                  className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {checking ? 'Vérification...' : 'Actualiser pour obtenir les identifiants'}
                </button>
              </div>
            )}

            {/* Section Identifiants de Connexion */}
            {isSuccess && hasCredentials && (
              <>
                <h2 className="text-center text-green-600 dark:text-green-400 font-bold text-xl mb-6">
                  Identifiants de Connexion
                </h2>

                <div className="space-y-4 mb-6">
                  {/* Identifiant */}
                  <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-green-50/50 dark:from-green-900/20 dark:to-green-800/10 border border-green-100 dark:border-green-800 rounded-xl px-4 py-3">
                    <span className="text-gray-700 dark:text-gray-300 text-sm font-semibold">Identifiant:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-900 dark:text-white font-mono text-sm bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-green-100 dark:border-gray-700">
                        {credentials.username}
                      </span>
                      <button
                        onClick={() => copyToClipboard(credentials.username)}
                        className="p-1.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg transition-all duration-200 hover:scale-110"
                        title="Copier"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Password */}
                  <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-green-50/50 dark:from-green-900/20 dark:to-green-800/10 border border-green-100 dark:border-green-800 rounded-xl px-4 py-3">
                    <span className="text-gray-700 dark:text-gray-300 text-sm font-semibold">Password:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-900 dark:text-white font-mono text-sm bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-green-100 dark:border-gray-700">
                        {credentials.password}
                      </span>
                      <button
                        onClick={() => copyToClipboard(credentials.password)}
                        className="p-1.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg transition-all duration-200 hover:scale-110"
                        title="Copier"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Durée de validité */}
                  {duration && (
                    <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-green-50/50 dark:from-green-900/20 dark:to-green-800/10 border border-green-100 dark:border-green-800 rounded-xl px-4 py-3">
                      <span className="text-gray-700 dark:text-gray-300 text-sm font-semibold">Durée de validité:</span>
                      <span className="text-gray-900 dark:text-white font-mono text-sm bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-green-100 dark:border-gray-700">
                        {duration}
                      </span>
                    </div>
                  )}

                  {/* Référence de paiement */}
                  <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-green-50/50 dark:from-green-900/20 dark:to-green-800/10 border border-green-100 dark:border-green-800 rounded-xl px-4 py-3">
                    <span className="text-gray-700 dark:text-gray-300 text-sm font-semibold">Référence de paiement:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-900 dark:text-white font-mono text-xs bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-green-100 dark:border-gray-700">
                        {getPaymentReference()}
                      </span>
                      <button
                        onClick={() => copyToClipboard(getPaymentReference())}
                        className="p-1.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg transition-all duration-200 hover:scale-110"
                        title="Copier"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Section Connexion */}
                <div className="mb-6">
                  <p className="text-center text-green-600 dark:text-green-400 text-sm mb-3 font-medium">
                    Connectez-vous directement en cliquant sur
                  </p>
                  

                  <button
                    onClick={() => {
                      if (loginUrl && credentials) {
                        // Navigation de premier niveau, et non soumission de formulaire:
                        // poster depuis une page HTTPS vers le portail en HTTP declenche
                        // l'avertissement de contenu mixte de Chrome. Une navigation n'est
                        // pas concernee par cette regle.
                        // dst ramene le client sur cette page une fois connecte, pour qu'il
                        // retrouve ses identifiants.
                        const params = new URLSearchParams({
                          username: credentials.username,
                          password: credentials.password,
                          dst: window.location.href
                        });
                        toast.success('Connexion au WiFi en cours...');
                        window.location.href = `${loginUrl}?${params.toString()}`;
                      } else if (credentials) {
                        // Pas de router_ip renseigne: le client se connecte a la main
                        const text = `Username: ${credentials.username}\nPassword: ${credentials.password}`;
                        copyToClipboard(text);
                        toast.success('Identifiants copiés ! Utilisez-les pour vous connecter au WiFi');
                      }
                    }}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
                  >
                    <Wifi size={20} />
                    {loginUrl ? 'Se Connecter au WiFi' : 'Copier les identifiants'}
                  </button>
                </div>
              </>
            )}

            {/* Section Support */}
            <div className="pt-6 border-t border-green-100 dark:border-gray-700">
              <p className="text-xs text-gray-600 dark:text-gray-400 text-center mb-3">
                Pour toute assistance ou un problème de ticket, contactez le :
              </p>
              <div className="flex items-center justify-center gap-2">
                <a
                  href="tel:+2290153489846"
                  className="text-green-600 dark:text-green-400 font-semibold text-sm hover:text-green-700 dark:hover:text-green-300 transition-colors"
                >
                  +2290153489846
                </a>
                <span className="text-gray-400">|</span>
                <a
                  href="https://wa.me/2290153489846"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-green-600 dark:text-green-400 font-semibold text-sm hover:text-green-700 dark:hover:text-green-300 transition-colors"
                >
                  <MessageCircle size={16} />
                  WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
