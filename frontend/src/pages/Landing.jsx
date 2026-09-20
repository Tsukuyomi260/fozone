import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  Layers,
  Lock,
  MessageCircle,
  Search,
  Smartphone,
  Upload,
  Wallet,
  Wifi,
} from 'lucide-react';
import Logo from '../components/Logo';

/**
 * Page d'accueil publique.
 *
 * Avant elle, fozone.org renvoyait directement au formulaire de connexion :
 * un promoteur qui entendait parler de la plateforme tombait sur une demande
 * de mot de passe, sans savoir ce qu'on lui proposait ni ce que ça coûtait.
 *
 * Tout le contenu rédactionnel vit dans les tableaux ci-dessous, pour qu'une
 * correction de texte se fasse à un seul endroit.
 *
 * Les chiffres de commission viennent de backend/src/config/platformCommission.js
 * (5 % du brut, frais d'agrégateur compris dedans). Ne pas les modifier ici
 * sans changer le backend : la page deviendrait mensongère.
 */

const WHATSAPP = 'https://wa.me/2290153489846';
const WHATSAPP_DISPLAY = '+229 01 53 48 98 46';

/* --- Jetons visuels, même convention que les autres pages du projet ------- */

const container = 'mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-8';
const section = 'py-16 sm:py-20 lg:py-24';

const card =
  'rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#101714] shadow-sm dark:shadow-black/30';

// Aucun bouton du projet n'avait d'anneau de focus visible: un visiteur au
// clavier ne savait pas où il se trouvait.
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-50 dark:focus-visible:ring-offset-[#080B0A]';

const primaryBtn = `inline-flex items-center justify-center gap-2 h-12 px-6 text-[15px] font-bold bg-lime-400 hover:bg-lime-300 text-[#0A1005] rounded-xl shadow-lg shadow-lime-400/25 transition-colors ${focusRing}`;

const ghostBtn = `inline-flex items-center justify-center gap-2 h-12 px-6 text-[15px] font-semibold rounded-xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors ${focusRing}`;

const eyebrow =
  'text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide';

// Le H1 du projet (text-2xl md:text-3xl) est calibré pour un tableau de bord.
// Une page d'accueil a besoin d'une accroche plus haute: déviation assumée.
const h2Class =
  'text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white tracking-tight';

const bodyClass = 'text-[15px] leading-relaxed text-gray-600 dark:text-gray-400';

const iconTile =
  'inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-lime-50 dark:bg-lime-400/10 text-lime-700 dark:text-lime-400';

/* --- Contenu -------------------------------------------------------------- */

const STEPS = [
  {
    icon: Wifi,
    title: 'Créez votre zone Wi-Fi',
    body: "Déclarez votre hotspot et fixez vos tarifs : 200 F pour 24 heures, 500 F pour trois jours, ce que vous décidez. Autant de zones que vous avez de points Wi-Fi.",
  },
  {
    icon: Upload,
    title: 'Importez vos tickets',
    body: "Exportez vos identifiants depuis MikroTik et déposez le fichier CSV. Des milliers de tickets deviennent vendables en une seule opération.",
  },
  {
    icon: Wallet,
    title: 'Vos clients achètent, vous encaissez',
    body: "Le client paie depuis le portail captif et reçoit son ticket immédiatement. Le montant net s'ajoute à votre solde, sans que vous ayez à intervenir.",
  },
];

const CLIENT_STEPS = [
  ['Choisir un forfait', "Sur la page d'achat de votre zone Wi-Fi."],
  ['Payer avec son téléphone', 'MTN MoMo ou Moov Money, sans quitter la page.'],
  ['Se connecter', "L'identifiant et le mot de passe s'affichent tout de suite."],
];

// Les montants nets sont le résultat exact du calcul du backend: prix - 5 %.
const PRICING_ROWS = [
  { price: 100, fee: 5, net: 95 },
  { price: 200, fee: 10, net: 190 },
  { price: 500, fee: 25, net: 475 },
  { price: 1000, fee: 50, net: 950 },
];

const INCLUDED = [
  'Encaissement MTN MoMo et Moov Money',
  'Remise automatique du ticket au client',
  "Récupération d'un ticket perdu par numéro de téléphone",
  'Autant de zones Wi-Fi que vous voulez',
  'Comptabilité brut et net, jour par jour',
  'Modèles de portail captif MikroTik',
  'Assistance par WhatsApp',
];

const FEATURES = [
  {
    icon: Smartphone,
    title: 'Paiement Mobile Money',
    body: "MTN MoMo et Moov Money via nos partenaires de paiement. Chaque confirmation est signée puis vérifiée avant qu'un ticket ne soit remis : un paiement qui n'est pas authentique ne déclenche rien.",
  },
  {
    icon: Lock,
    title: 'Un ticket, un seul acheteur',
    body: "L'attribution est verrouillée en base de données. Deux clients qui paient à la même seconde reçoivent deux tickets différents, jamais le même.",
  },
  {
    icon: Search,
    title: 'Ticket perdu, ticket retrouvé',
    body: "Le client saisit le numéro de téléphone utilisé pour le paiement et récupère son identifiant. Une sollicitation de moins pour vous.",
  },
  {
    icon: Upload,
    title: 'Import CSV',
    body: "Exportez vos utilisateurs depuis MikroTik, déposez le fichier. Vos tickets sont prêts à la vente en une fois.",
  },
  {
    icon: Layers,
    title: 'Plusieurs zones, un seul compte',
    body: "Un quartier, un maquis, une cité universitaire : chaque zone garde ses tarifs, ses tickets et ses chiffres.",
  },
  {
    icon: FileText,
    title: 'Comptabilité claire',
    body: "Montant brut encaissé, commission, montant net, jour par jour. Vous savez toujours ce qui vous revient.",
  },
];

const FAQ = [
  [
    'Combien coûte Fô-Zône ?',
    "5 % du prix de chaque ticket vendu, frais de paiement compris. Pas d'abonnement, pas de frais d'ouverture de compte, aucun prélèvement supplémentaire.",
  ],
  [
    'Faut-il payer avant de commencer ?',
    "Non. La création de compte est gratuite et votre tableau de bord est accessible immédiatement. Fô-Zône ne gagne quelque chose que lorsque vous vendez.",
  ],
  [
    'Comment je récupère mon argent ?',
    "Le montant net de chaque vente s'ajoute à votre solde. Vous demandez un retrait depuis votre tableau de bord, notre équipe vérifie votre identité, puis la somme vous est envoyée par Mobile Money.",
  ],
  [
    'Et si un client perd son ticket ?',
    "Il le retrouve seul, avec le numéro de téléphone utilisé pour le paiement. Vous n'avez rien à faire.",
  ],
  [
    'Deux clients peuvent-ils recevoir le même ticket ?',
    "Non. Chaque ticket est verrouillé au moment où il est attribué : il ne peut être vendu qu'une seule fois.",
  ],
  ['Quels opérateurs sont acceptés ?', 'MTN MoMo et Moov Money.'],
  [
    'Puis-je gérer plusieurs points Wi-Fi ?',
    'Oui, autant que vous le souhaitez, depuis le même compte.',
  ],
  [
    "De quel matériel ai-je besoin ?",
    "D'un hotspot MikroTik en état de marche et d'une connexion Internet. Les modèles de portail captif, c'est nous qui les fournissons.",
  ],
];

/* --- Briques ------------------------------------------------------------- */

const fmt = (n) => n.toLocaleString('fr-FR');

function Halo() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-100"
      style={{
        background:
          'radial-gradient(70% 45% at 50% -5%, rgba(163, 230, 53, 0.16), transparent 70%)',
      }}
    />
  );
}

function WhatsAppLink({ className = '', children }) {
  return (
    <a
      href={WHATSAPP}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}

function Header() {
  const navLink = `text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg px-1 ${focusRing}`;

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200/70 dark:border-white/[0.06] bg-gray-50/90 dark:bg-[#080B0A]/90">
      <div className={`${container} h-16 flex items-center justify-between gap-4`}>
        <Link to="/" className={`rounded-lg ${focusRing}`} aria-label="Fô-Zône, accueil">
          <Logo size="md" className="text-gray-900 dark:text-white" />
        </Link>

        <nav aria-label="Principal" className="hidden md:flex items-center gap-7">
          <a href="#fonctionnement" className={navLink}>Fonctionnement</a>
          <a href="#tarif" className={navLink}>Tarif</a>
          <a href="#questions" className={navLink}>Questions</a>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className={`hidden sm:inline-flex items-center h-10 px-4 text-sm font-semibold rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors ${focusRing}`}
          >
            Se connecter
          </Link>
          <Link
            to="/register"
            className={`inline-flex items-center h-10 px-4 text-sm font-bold bg-lime-400 hover:bg-lime-300 text-[#0A1005] rounded-xl shadow-lg shadow-lime-400/25 transition-colors ${focusRing}`}
          >
            Créer un compte
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero({ sentinelRef }) {
  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-titre">
      <Halo />

      <div className={`${container} relative pt-14 pb-16 sm:pt-20 sm:pb-20 lg:pt-24 lg:pb-28`}>
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300">
              <Smartphone size={13} strokeWidth={2.5} aria-hidden="true" />
              MTN MoMo · Moov Money
            </span>

            <h1
              id="hero-titre"
              className="mt-6 text-[34px] leading-[1.1] sm:text-5xl lg:text-[56px] font-bold text-gray-900 dark:text-white tracking-tight"
            >
              Vendez vos tickets Wi-Fi.
              <br />
              <span className="text-lime-700 dark:text-lime-400">Encaissez</span> par
              Mobile Money.
            </h1>

            <p className={`mt-6 text-base sm:text-lg leading-relaxed text-gray-600 dark:text-gray-400 max-w-xl`}>
              Fô-Zône transforme votre hotspot MikroTik en point de vente automatique.
              Votre client paie avec MTN MoMo ou Moov Money et reçoit son ticket en
              quelques secondes. Vous gardez 95 % de chaque vente.
            </p>

            <div ref={sentinelRef} className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link to="/register" className={`${primaryBtn} w-full sm:w-auto`}>
                Créer mon compte gratuitement
                <ArrowRight size={17} strokeWidth={2.5} aria-hidden="true" />
              </Link>
              <Link to="/login" className={`${ghostBtn} w-full sm:w-auto`}>
                Se connecter
              </Link>
            </div>

            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Une question avant de commencer ?{' '}
              <WhatsAppLink
                className={`font-semibold text-lime-700 dark:text-lime-400 hover:text-lime-600 dark:hover:text-lime-300 transition-colors rounded ${focusRing}`}
              >
                Écrivez-nous sur WhatsApp
              </WhatsAppLink>
            </p>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
              {['Inscription gratuite', 'Sans abonnement', 'Tableau de bord immédiat'].map(
                (item) => (
                  <li
                    key={item}
                    className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
                  >
                    <Check
                      size={15}
                      strokeWidth={3}
                      className="text-lime-600 dark:text-lime-400"
                      aria-hidden="true"
                    />
                    {item}
                  </li>
                )
              )}
            </ul>
          </div>

          {/* Le visuel de la page est le calcul lui-même: c'est l'argument. */}
          <div className={`${card} p-6 sm:p-8`}>
            <p className={eyebrow}>Sur un ticket de 200 FCFA</p>

            <dl className="mt-6 space-y-3 tabular-nums">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-gray-600 dark:text-gray-400">Le client paie</dt>
                <dd className="text-lg font-semibold text-gray-900 dark:text-white">200 F</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 pb-3 border-b border-gray-100 dark:border-white/[0.08]">
                <dt className="text-sm text-gray-600 dark:text-gray-400">
                  Commission Fô-Zône (5 %)
                </dt>
                <dd className="text-lg font-semibold text-gray-500 dark:text-gray-400">
                  − 10 F
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 rounded-xl bg-lime-50 dark:bg-lime-400/10 -mx-2 px-3 py-3">
                <dt className="text-sm font-semibold text-gray-900 dark:text-white">
                  Vous recevez
                </dt>
                <dd className="text-2xl font-extrabold text-lime-700 dark:text-lime-400 tracking-tight">
                  190 F
                </dd>
              </div>
            </dl>

            <p className="mt-5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              Les frais de nos partenaires de paiement sont déjà compris dans ces 5 %.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="fonctionnement" className={section} aria-labelledby="fonctionnement-titre">
      <div className={container}>
        <p className={eyebrow}>Comment ça marche</p>
        <h2 id="fonctionnement-titre" className={`${h2Class} mt-2`}>
          De votre hotspot à votre solde
        </h2>
        <p className={`${bodyClass} mt-3 max-w-2xl`}>
          Trois étapes, une seule fois. Ensuite, la plateforme tourne toute seule.
        </p>

        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className={`${card} p-6`}>
                <div className="flex items-center justify-between">
                  <span className={iconTile}>
                    <Icon size={22} strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span
                    className="text-2xl font-extrabold text-gray-200 dark:text-white/10 tabular-nums"
                    aria-hidden="true"
                  >
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-base font-bold text-gray-900 dark:text-white tracking-tight">
                  {step.title}
                </h3>
                <p className={`${bodyClass} mt-2 text-sm`}>{step.body}</p>
              </li>
            );
          })}
        </ol>

        <div className={`${card} mt-4 p-6`}>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">
            Et pour vos clients, trois gestes
          </h3>
          <ul className="mt-4 grid gap-4 sm:grid-cols-3">
            {CLIENT_STEPS.map(([title, body]) => (
              <li key={title} className="flex gap-3">
                <Check
                  size={16}
                  strokeWidth={3}
                  className="mt-0.5 flex-shrink-0 text-lime-600 dark:text-lime-400"
                  aria-hidden="true"
                />
                <span className="text-sm">
                  <span className="font-semibold text-gray-900 dark:text-white">{title}</span>
                  <span className="block text-gray-500 dark:text-gray-400 mt-0.5">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="tarif" className={section} aria-labelledby="tarif-titre">
      <div className={container}>
        <p className={eyebrow}>Tarif</p>
        <h2 id="tarif-titre" className={`${h2Class} mt-2`}>
          Un seul prélèvement : 5 %
        </h2>
        <p className={`${bodyClass} mt-3 max-w-2xl`}>
          Cinq pour cent du prix du ticket, frais de paiement compris. Pas d'abonnement
          mensuel, pas de frais d'ouverture, et aucun second prélèvement au moment du
          retrait.
        </p>

        <div className="mt-10 grid gap-4 lg:grid-cols-5">
          <div className={`${card} lg:col-span-3 p-5 sm:p-6`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm sm:text-base tabular-nums">
                <caption className="sr-only">
                  Commission et montant net selon le prix du ticket
                </caption>
                <thead>
                  <tr className="border-b border-gray-100 dark:border-white/[0.08]">
                    <th
                      scope="col"
                      className="py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
                    >
                      Prix du ticket
                    </th>
                    <th
                      scope="col"
                      className="py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
                    >
                      Commission
                    </th>
                    <th
                      scope="col"
                      className="py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
                    >
                      Vous recevez
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {PRICING_ROWS.map((row) => (
                    <tr key={row.price}>
                      <td className="py-3.5 text-gray-900 dark:text-white font-medium">
                        {fmt(row.price)} F
                      </td>
                      <td className="py-3.5 text-right text-gray-500 dark:text-gray-400">
                        − {fmt(row.fee)} F
                      </td>
                      <td className="py-3.5 text-right font-bold text-lime-700 dark:text-lime-400">
                        {fmt(row.net)} F
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-5 text-xs text-gray-500 dark:text-gray-400">
              Vous fixez librement le prix de vos tickets. Le calcul reste toujours le
              même. Sur 100 tickets à 200 F : 20 000 F encaissés, 19 000 F pour vous.
            </p>
          </div>

          <div className={`${card} lg:col-span-2 p-5 sm:p-6`}>
            <h3 className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
              Compris dans les 5 %
            </h3>
            <ul className="mt-4 space-y-2.5">
              {INCLUDED.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm text-gray-600 dark:text-gray-400">
                  <Check
                    size={16}
                    strokeWidth={3}
                    className="mt-0.5 flex-shrink-0 text-lime-600 dark:text-lime-400"
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className={section} aria-labelledby="plateforme-titre">
      <div className={container}>
        <p className={eyebrow}>La plateforme</p>
        <h2 id="plateforme-titre" className={`${h2Class} mt-2`}>
          Ce que Fô-Zône gère à votre place
        </h2>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <li key={feature.title} className={`${card} p-6`}>
                <span className={iconTile}>
                  <Icon size={22} strokeWidth={2} aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-base font-bold text-gray-900 dark:text-white tracking-tight">
                  {feature.title}
                </h3>
                <p className={`${bodyClass} mt-2 text-sm`}>{feature.body}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Hardware() {
  return (
    <section className="pb-4" aria-labelledby="materiel-titre">
      <div className={container}>
        <div className="rounded-2xl p-8 sm:p-10 lg:p-12 bg-gradient-to-br from-lime-400 to-lime-500 dark:from-lime-400 dark:to-lime-600 shadow-lg shadow-lime-500/20">
          <div className="max-w-2xl">
            <h2
              id="materiel-titre"
              className="text-2xl sm:text-3xl font-bold text-[#0A1005] tracking-tight"
            >
              Votre MikroTik, tel quel
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[#0A1005]/80">
              Fô-Zône ne remplace pas votre routeur et ne touche pas à votre
              configuration réseau. Vous gardez votre hotspot MikroTik : vous remplacez
              simplement la page d'accueil de votre portail captif par un modèle que
              nous vous fournissons. Si vous bloquez, écrivez-nous sur WhatsApp, nous
              regardons votre configuration avec vous.
            </p>
            <WhatsAppLink
              className="mt-7 inline-flex items-center justify-center gap-2 h-12 px-6 text-[15px] font-bold rounded-xl bg-[#0A1005] text-lime-400 hover:bg-[#0A1005]/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A1005] focus-visible:ring-offset-2 focus-visible:ring-offset-lime-400"
            >
              <MessageCircle size={17} strokeWidth={2.5} aria-hidden="true" />
              Écrire sur WhatsApp
            </WhatsAppLink>
          </div>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  // <details> natif: accessible au clavier sans une ligne de JavaScript.
  return (
    <section id="questions" className={section} aria-labelledby="questions-titre">
      <div className={container}>
        <p className={eyebrow}>Questions fréquentes</p>
        <h2 id="questions-titre" className={`${h2Class} mt-2`}>
          Ce que les promoteurs nous demandent
        </h2>

        <div className="mt-10 max-w-3xl divide-y divide-gray-200 dark:divide-white/[0.08] border-t border-b border-gray-200 dark:border-white/[0.08]">
          {FAQ.map(([question, answer]) => (
            <details key={question} className="group">
              <summary
                className={`flex items-center justify-between gap-4 py-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden text-[15px] font-semibold text-gray-900 dark:text-white rounded-lg ${focusRing}`}
              >
                {question}
                <ChevronDown
                  size={18}
                  strokeWidth={2.5}
                  aria-hidden="true"
                  className="flex-shrink-0 text-gray-400 dark:text-gray-600 transition-transform group-open:rotate-180"
                />
              </summary>
              <p className={`${bodyClass} pb-5 pr-8 text-sm`}>{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden" aria-labelledby="cta-titre">
      <Halo />
      <div className={`${container} relative py-16 sm:py-20 lg:py-24 text-center`}>
        <h2 id="cta-titre" className={h2Class}>
          Votre Wi-Fi peut commencer à vendre aujourd'hui
        </h2>
        <p className={`${bodyClass} mt-4 max-w-xl mx-auto`}>
          Créez votre compte, déclarez votre zone, importez vos tickets. C'est gratuit,
          et vous gardez 95 % de chaque vente.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/register" className={`${primaryBtn} w-full sm:w-auto`}>
            Créer mon compte
            <ArrowRight size={17} strokeWidth={2.5} aria-hidden="true" />
          </Link>
          <WhatsAppLink className={`${ghostBtn} w-full sm:w-auto`}>
            <MessageCircle size={17} strokeWidth={2.5} aria-hidden="true" />
            Nous écrire sur WhatsApp
          </WhatsAppLink>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const linkClass = `text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded ${focusRing}`;

  return (
    <footer
      aria-label="Pied de page"
      className="border-t border-gray-200 dark:border-white/[0.06]"
    >
      <div className={`${container} py-12`}>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Logo size="lg" className="text-gray-900 dark:text-white" />
            <p className={`${bodyClass} mt-3 text-sm max-w-xs`}>
              Vente de tickets Wi-Fi par Mobile Money, au Bénin.
            </p>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-600">
              Plateforme
            </h2>
            <ul className="mt-4 space-y-2.5">
              <li><a href="#fonctionnement" className={linkClass}>Fonctionnement</a></li>
              <li><a href="#tarif" className={linkClass}>Tarif</a></li>
              <li><a href="#questions" className={linkClass}>Questions</a></li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-600">
              Compte
            </h2>
            <ul className="mt-4 space-y-2.5">
              <li><Link to="/register" className={linkClass}>Créer un compte</Link></li>
              <li><Link to="/login" className={linkClass}>Se connecter</Link></li>
              <li>
                <WhatsAppLink className={linkClass}>
                  WhatsApp {WHATSAPP_DISPLAY}
                </WhatsAppLink>
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-10 pt-6 border-t border-gray-200 dark:border-white/[0.06] text-xs text-gray-400 dark:text-gray-600">
          © {new Date().getFullYear()} Fô-Zône. Tous droits réservés.
        </p>
      </div>
    </footer>
  );
}

/* --- Page ---------------------------------------------------------------- */

export default function Landing() {
  const sentinelRef = useRef(null);
  const [showStickyCta, setShowStickyCta] = useState(false);

  // Le fichier de la page d'inscription est chargé pendant un temps mort:
  // le bouton principal répond alors instantanément.
  useEffect(() => {
    const prefetch = () => import('./Register');
    const idle = window.requestIdleCallback;

    if (idle) {
      const id = idle(prefetch);
      return () => window.cancelIdleCallback?.(id);
    }
    const id = setTimeout(prefetch, 1500);
    return () => clearTimeout(id);
  }, []);

  // Barre d'appel mobile, affichée seulement une fois les boutons du héros
  // sortis de l'écran: sinon elle double un bouton déjà visible.
  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !window.IntersectionObserver) return;

    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyCta(!entry.isIntersecting),
      { rootMargin: '0px 0px -40px 0px' }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#080B0A] pb-24 lg:pb-0">
      <a
        href="#contenu"
        className={`sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-xl focus:bg-lime-400 focus:text-[#0A1005] focus:font-bold ${focusRing}`}
      >
        Aller au contenu
      </a>

      <Header />

      <main id="contenu">
        <Hero sentinelRef={sentinelRef} />
        <HowItWorks />
        <Pricing />
        <Features />
        <Hardware />
        <Faq />
        <FinalCta />
      </main>

      <Footer />

      {showStickyCta && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 dark:border-white/10 bg-white/95 dark:bg-[#080B0A]/95 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3">
            <Link to="/register" className={`${primaryBtn} flex-1`}>
              Créer mon compte
              <ArrowRight size={17} strokeWidth={2.5} aria-hidden="true" />
            </Link>
            <WhatsAppLink
              className={`inline-flex items-center justify-center h-12 w-12 flex-shrink-0 rounded-xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors ${focusRing}`}
            >
              <MessageCircle size={20} strokeWidth={2} aria-hidden="true" />
              <span className="sr-only">Poser une question sur WhatsApp</span>
            </WhatsAppLink>
          </div>
        </div>
      )}
    </div>
  );
}
