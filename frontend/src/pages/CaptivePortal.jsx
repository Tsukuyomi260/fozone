import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  Wifi,
  Download,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  Terminal,
  Eye,
  Router,
} from 'lucide-react';
import { getWifiZones } from '../services/wifiZones';
import { getFrontendUrl, API_URL, FRONTEND_URL } from '../config/env';
import { SkeletonHeader, SkeletonList } from '../components/Skeleton';
import {
  PORTAL_VARIANTS,
  buildLoginHtml,
  buildRedirectHtml,
  buildWalledGarden,
  toPreviewHtml,
  formatPhoneDisplay,
} from '../templates/captivePortal';

/**
 * Génère les pages du portail captif MikroTik pour une zone donnée.
 *
 * Avant cette page, le seul gabarit disponible était `hotspot/login.html`,
 * avec un UUID de zone en dur : un promoteur qui le recopiait vendait les
 * tickets de quelqu'un d'autre. Ici le fichier est toujours rempli avec la
 * zone choisie.
 */

/** Nom d'hôte seul, pour les commandes du routeur. */
function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0];
  }
}

function downloadFile(name, content) {
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

const STEPS = [
  {
    title: 'Téléchargez les deux fichiers',
    body: "Le bouton ci-dessus produit login.html et redirect.html déjà remplis avec votre zone. Ne les modifiez pas : les balises $(...) sont lues par le routeur.",
  },
  {
    title: 'Déposez-les dans /files du routeur',
    body: "Avec Winbox : menu Files, puis glissez-déposez les deux fichiers dans le dossier hotspot. Ils remplacent ceux qui portent le même nom.",
  },
  {
    title: 'Ne supprimez jamais md5.js ni le dossier img',
    body: "La page de connexion en a besoin. Ces fichiers viennent de MikroTik et ne sont pas fournis ici : s'ils disparaissent, plus personne ne peut se connecter.",
  },
  {
    title: 'Ouvrez le parcours d\'achat dans le walled garden',
    body: "Collez le bloc de commandes plus bas dans le terminal du routeur. Sans lui, le client clique sur « Acheter un ticket » et n'arrive nulle part.",
  },
  {
    title: 'Testez avec un téléphone',
    body: "Connectez-vous au Wi-Fi, laissez le portail s'ouvrir, achetez un ticket et vérifiez que vous le recevez puis qu'il ouvre la connexion.",
  },
];

export default function CaptivePortal() {
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState('');
  const [loading, setLoading] = useState(true);
  const [variant, setVariant] = useState('sombre');
  const [displayName, setDisplayName] = useState('');
  const [footerText, setFooterText] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [copied, setCopied] = useState('');
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    loadZones();
  }, []);

  const loadZones = async () => {
    try {
      const response = await getWifiZones();
      const list = response.zones || [];
      setZones(list);
      if (list.length > 0) setSelectedZone(list[0].id);
    } catch (error) {
      console.error('[CaptivePortal] Erreur:', error);
      toast.error(error.message || 'Impossible de charger les zones');
    } finally {
      setLoading(false);
    }
  };

  const zone = zones.find((z) => z.id === selectedZone);

  // Les champs suivent la zone choisie tant que le promoteur ne les a pas
  // personnalisés lui-même.
  useEffect(() => {
    if (!zone) return;
    setDisplayName(zone.name || '');
    setWhatsapp(zone.manager_phone || '');
  }, [zone?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const buyUrl = zone ? getFrontendUrl(`buy/${zone.id}`) : '';
  const recoveryUrl = getFrontendUrl('payment/return');

  const loginHtml = useMemo(
    () =>
      zone
        ? buildLoginHtml({ variant, displayName, footerText, whatsapp, buyUrl, recoveryUrl })
        : '',
    [zone, variant, displayName, footerText, whatsapp, buyUrl, recoveryUrl]
  );

  const redirectHtml = useMemo(() => buildRedirectHtml({ variant }), [variant]);

  const walledGarden = useMemo(
    () =>
      buildWalledGarden({
        frontendHost: hostOf(FRONTEND_URL),
        apiHost: hostOf(API_URL),
        whatsapp,
      }),
    [whatsapp]
  );

  const previewHtml = useMemo(() => (loginHtml ? toPreviewHtml(loginHtml) : ''), [loginHtml]);

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success('Copié');
      setTimeout(() => setCopied(''), 2000);
    } catch {
      toast.error('Impossible de copier');
    }
  };

  const downloadAll = () => {
    if (!zone) return;
    downloadFile('login.html', loginHtml);
    // Petit décalage: certains navigateurs ignorent le second téléchargement
    // s'il part dans le même geste.
    setTimeout(() => downloadFile('redirect.html', redirectHtml), 400);
    toast.success('login.html et redirect.html téléchargés');
  };

  const card =
    'rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#101714] shadow-sm dark:shadow-black/30';

  const primaryBtn =
    'inline-flex items-center justify-center gap-2 h-11 px-5 text-sm font-bold bg-lime-400 hover:bg-lime-300 text-[#0A1005] rounded-xl shadow-lg shadow-lime-400/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  const ghostBtn =
    'inline-flex items-center justify-center gap-2 h-11 px-4 text-sm font-semibold rounded-xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors';

  const field =
    'w-full h-11 px-3.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-lime-400/60 focus:ring-2 focus:ring-lime-400/15 transition-colors';

  const label =
    'block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide';

  if (loading) {
    return (
      <div className="space-y-5 md:space-y-6 w-full">
        <SkeletonHeader action={false} />
        <SkeletonList rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-5 md:space-y-6 w-full">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
          Portail captif
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Les pages à installer sur votre routeur MikroTik, remplies pour votre zone
        </p>
      </div>

      {zones.length === 0 ? (
        <div className={`${card} text-center py-16 px-6`}>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-lime-50 dark:bg-lime-400/10 mb-4">
            <Router className="text-lime-600 dark:text-lime-400" size={26} strokeWidth={2} />
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            Aucune zone Wi-Fi
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Créez d'abord une zone : le portail a besoin de son lien d'achat.
          </p>
        </div>
      ) : (
        <>
          {/* Zone */}
          <div className={`${card} p-4 flex flex-wrap items-center gap-3`}>
            <div className="w-9 h-9 rounded-xl bg-lime-50 dark:bg-lime-400/10 flex items-center justify-center flex-shrink-0">
              <Wifi size={17} strokeWidth={2.5} className="text-lime-600 dark:text-lime-400" />
            </div>
            <label
              htmlFor="zone-select"
              className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-600"
            >
              Zone
            </label>
            <select
              id="zone-select"
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="flex-1 min-w-[200px] max-w-md h-10 px-3 rounded-xl text-sm bg-gray-100 dark:bg-white/[0.04] border border-transparent dark:border-white/[0.06] text-gray-900 dark:text-white outline-none focus:border-lime-400/50 transition-colors"
            >
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>

            <a
              href={buyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={ghostBtn}
              title="Vérifier que la page d'achat affiche bien vos tarifs"
            >
              <ExternalLink size={15} strokeWidth={2.5} />
              Tester le lien d'achat
            </a>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Réglages */}
            <div className={`${card} lg:col-span-3 p-5 md:p-6`}>
              <h2 className="text-base font-bold text-gray-900 dark:text-white tracking-tight mb-1">
                Votre portail
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
                Ces réglages n'affectent que les fichiers téléchargés
              </p>

              {/* Variantes */}
              <p className={label}>Style</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-5">
                {PORTAL_VARIANTS.map((v) => {
                  const active = variant === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVariant(v.id)}
                      className={`text-left rounded-xl border p-3 transition-colors ${
                        active
                          ? 'border-lime-400 bg-lime-50 dark:bg-lime-400/10'
                          : 'border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                      }`}
                    >
                      <span
                        className={`block text-sm font-bold ${
                          active
                            ? 'text-lime-700 dark:text-lime-400'
                            : 'text-gray-900 dark:text-white'
                        }`}
                      >
                        {v.label}
                      </span>
                      <span className="block text-[11px] leading-snug text-gray-500 dark:text-gray-400 mt-1">
                        {v.description}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="display-name" className={label}>
                    Nom affiché
                  </label>
                  <input
                    id="display-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Nom de votre Wi-Fi"
                    className={field}
                  />
                  <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                    Le titre en haut du portail
                  </p>
                </div>

                <div>
                  <label htmlFor="whatsapp" className={label}>
                    WhatsApp d'assistance
                  </label>
                  <input
                    id="whatsapp"
                    type="tel"
                    inputMode="numeric"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="97 00 00 00"
                    className={field}
                  />
                  <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                    {whatsapp
                      ? `Lien affiché : ${formatPhoneDisplay(whatsapp)}`
                      : 'Laissez vide pour ne pas afficher de contact'}
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="footer" className={label}>
                    Pied de page
                  </label>
                  <input
                    id="footer"
                    type="text"
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    placeholder="Votre nom commercial"
                    className={field}
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2.5">
                <button type="button" onClick={downloadAll} className={primaryBtn} disabled={!zone}>
                  <Download size={16} strokeWidth={2.5} />
                  Télécharger les 2 fichiers
                </button>
                <button
                  type="button"
                  onClick={() => copy(loginHtml, 'login')}
                  className={ghostBtn}
                >
                  {copied === 'login' ? <Check size={15} strokeWidth={3} /> : <Copy size={15} strokeWidth={2.5} />}
                  Copier login.html
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreview((v) => !v)}
                  className={ghostBtn}
                >
                  <Eye size={15} strokeWidth={2.5} />
                  {showPreview ? "Masquer l'aperçu" : "Voir l'aperçu"}
                </button>
              </div>
            </div>

            {/* Aperçu */}
            <div className={`${card} lg:col-span-2 p-5 md:p-6`}>
              <h2 className="text-base font-bold text-gray-900 dark:text-white tracking-tight mb-1">
                Aperçu
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Rendu approximatif : sur le routeur, les messages d'erreur et le
                bouton d'essai gratuit s'ajoutent.
              </p>

              {showPreview ? (
                <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-white/10">
                  <iframe
                    key={`${variant}-${selectedZone}`}
                    title="Aperçu du portail captif"
                    srcDoc={previewHtml}
                    sandbox=""
                    className="w-full h-[520px] bg-white"
                  />
                </div>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-600">Aperçu masqué</p>
              )}
            </div>
          </div>

          {/* Walled garden */}
          <div className={`${card} p-5 md:p-6`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white tracking-tight mb-1 inline-flex items-center gap-2">
                  <Terminal size={17} strokeWidth={2.5} className="text-lime-600 dark:text-lime-400" />
                  Autoriser le paiement avant connexion
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  À coller dans le terminal RouterOS. Sans ces lignes, aucun achat
                  n'aboutit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => copy(walledGarden, 'walled')}
                className={ghostBtn}
              >
                {copied === 'walled' ? <Check size={15} strokeWidth={3} /> : <Copy size={15} strokeWidth={2.5} />}
                Copier les commandes
              </button>
            </div>

            <pre className="mt-4 overflow-x-auto rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.08] p-4 text-[12px] leading-relaxed text-gray-800 dark:text-gray-300">
              {walledGarden}
            </pre>

            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Ces règles fonctionnent parce que le routeur résout lui-même les noms
              de domaine. Si vos clients reçoivent un autre serveur DNS que le
              MikroTik, les paiements échoueront malgré ces lignes.
            </p>
          </div>

          {/* Installation */}
          <div className={`${card} p-5 md:p-6`}>
            <h2 className="text-base font-bold text-gray-900 dark:text-white tracking-tight mb-1">
              Installation
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
              Cinq étapes, une seule fois par routeur
            </p>

            <ol className="space-y-4">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-3.5">
                  <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-lime-50 dark:bg-lime-400/10 text-lime-700 dark:text-lime-400 text-xs font-bold inline-flex items-center justify-center">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {step.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-5 rounded-xl bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/20 p-4 flex gap-3">
              <AlertTriangle
                size={17}
                strokeWidth={2.5}
                className="flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"
              />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  Un portail par zone
                </p>
                <p className="text-xs text-amber-700/80 dark:text-amber-300/70 mt-1 leading-relaxed">
                  Chaque fichier contient le lien d'achat de la zone sélectionnée.
                  Installé sur le routeur d'une autre zone, il encaisse sur cette
                  zone-là. Si vous avez plusieurs points Wi-Fi, téléchargez un jeu
                  de fichiers pour chacun.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
