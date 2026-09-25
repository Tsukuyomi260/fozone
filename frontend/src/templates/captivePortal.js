/**
 * Génération des pages du portail captif MikroTik.
 *
 * Pourquoi ce fichier existe : jusqu'ici `hotspot/login.html` était un fichier
 * unique avec l'UUID de zone en dur. Un promoteur qui le copiait tel quel
 * vendait les tickets du propriétaire d'origine, et l'argent tombait sur le
 * mauvais solde. Ici, chaque promoteur obtient un fichier rempli avec SA zone.
 *
 * ATTENTION — les balises `$(...)` sont du langage de gabarit RouterOS, pas du
 * JavaScript. Elles doivent traverser la génération intactes : c'est MikroTik
 * qui les remplace au moment de servir la page. `$(` n'entre pas en conflit
 * avec `${` des gabarits JS, mais toute transformation par expression
 * régulière sur `$(...)` les détruirait.
 *
 * Le fichier généré dépend aussi de trois fichiers fournis par MikroTik et
 * absents de ce dépôt : `/md5.js`, `img/user.svg`, `img/password.svg`. Ils
 * doivent rester dans `/files` du routeur, sinon la connexion casse.
 */

export const PORTAL_VARIANTS = [
  {
    id: 'sombre',
    label: 'Sombre',
    description: 'Noir profond et vert lime, le style de Fô-Zône.',
  },
  {
    id: 'clair',
    label: 'Clair',
    description: 'Fond blanc, plus lisible en plein soleil.',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Aucun effet, très léger sur les téléphones anciens.',
  },
  {
    id: 'verre',
    label: 'Verre',
    description: 'Carte translucide sur fond sombre, effet premium.',
  },
  {
    id: 'editorial',
    label: 'Éditorial',
    description: 'Noir et blanc, angles droits, très typographique.',
  },
  {
    id: 'industriel',
    label: 'Industriel',
    description: 'Gris anthracite et vert électrique, allure technique.',
  },
];

/**
 * Icônes dessinées en ligne.
 *
 * Les gabarits d'origine chargeaient Bootstrap Icons et Phosphor depuis un
 * CDN. Sur un portail captif c'est fatal : le client n'a pas encore d'accès
 * internet au moment où la page s'affiche, donc aucune icône n'arrive. Idem
 * pour l'image de fond Unsplash et les logos hébergés ailleurs. Tout ce qui
 * s'affiche ici doit venir du routeur.
 */
const ICONS = {
  cart: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h2.2l2.3 11.4a1.8 1.8 0 0 0 1.8 1.4h8.6a1.8 1.8 0 0 0 1.8-1.4L21 7H5.4"/></svg>',
  ticket: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9V7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a2.5 2.5 0 0 0 0 5v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a2.5 2.5 0 0 0 0-5Z"/><path d="M13 6v2M13 11v2M13 16v2"/></svg>',
  user: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
  lock: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  bolt: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7Z"/></svg>',
  shield: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 5 6v5.5c0 4.2 2.9 7.6 7 9.5 4.1-1.9 7-5.3 7-9.5V6Z"/><path d="M9.5 12.5 11 14l3.5-3.5"/></svg>',
};

/** Empêche une saisie du promoteur de casser le HTML généré. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 8 chiffres = numéro béninois local, on préfixe l'indicatif pays. */
export function normalizePhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 8 ? `229${digits}` : digits;
}

export function formatPhoneDisplay(value) {
  const digits = normalizePhone(value);
  if (!digits) return '';
  return `+${digits}`;
}

/* ------------------------------------------------------------------ styles */

const STYLES = {
  sombre: `
        :root {
            --bg: #080B0A;
            --surface: #111815;
            --field: #0D1310;
            --line: rgba(255, 255, 255, 0.08);
            --line-soft: rgba(255, 255, 255, 0.05);
            --lime: #A3E635;
            --lime-deep: #7CCF19;
            --green: #22C55E;
            --text: #E9F1EB;
            --muted: #8B9A91;
            --danger: #FF6B6B;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { -webkit-text-size-adjust: 100%; }

        body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
            min-height: 100vh;
            min-height: 100dvh;
            display: flex;
            flex-direction: column;
            background: var(--bg);
            color: var(--text);
            position: relative;
            overflow-x: hidden;
            color-scheme: dark;
        }

        /* Halo vert diffus */
        body::before {
            content: '';
            position: fixed;
            inset: 0;
            background:
                radial-gradient(80% 55% at 50% -10%, rgba(34, 197, 94, 0.28), transparent 70%),
                radial-gradient(60% 40% at 100% 100%, rgba(163, 230, 53, 0.10), transparent 70%);
            pointer-events: none;
            z-index: 0;
        }

        /* Trame discrète */
        body::after {
            content: '';
            position: fixed;
            inset: 0;
            background-image:
                linear-gradient(rgba(255, 255, 255, 0.022) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255, 255, 255, 0.022) 1px, transparent 1px);
            background-size: 44px 44px;
            mask-image: radial-gradient(75% 60% at 50% 0%, #000 40%, transparent 100%);
            -webkit-mask-image: radial-gradient(75% 60% at 50% 0%, #000 40%, transparent 100%);
            pointer-events: none;
            z-index: 0;
        }

        .ie-fixMinHeight { flex: 1; display: flex; align-items: center; justify-content: center; width: 100%; }

        .main {
            width: 100%;
            display: flex;
            justify-content: center;
            padding: 24px 16px calc(24px + env(safe-area-inset-bottom));
            position: relative;
            z-index: 1;
        }

        .wrap {
            background: linear-gradient(180deg, rgba(23, 32, 27, 0.92), rgba(13, 19, 16, 0.92));
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            border: 1px solid var(--line);
            border-radius: 22px;
            padding: 26px 20px 22px;
            max-width: 420px;
            width: 100%;
            box-shadow: 0 1px 0 rgba(255, 255, 255, 0.05) inset, 0 24px 60px rgba(0, 0, 0, 0.55);
        }

        .animated.fadeIn { animation: slideUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) both; }
        @keyframes slideUp {
            from { opacity: 0; transform: translateY(16px); }
            to   { opacity: 1; transform: translateY(0); }
        }

        h1 {
            font-size: 19px;
            font-weight: 700;
            letter-spacing: -0.2px;
            text-align: center;
            margin: 4px 0 8px;
            line-height: 1.3;
        }

        .info {
            text-align: center;
            color: var(--muted);
            margin-bottom: 20px;
            font-size: 13.5px;
            line-height: 1.6;
        }

        .info.alert {
            background: rgba(255, 107, 107, 0.10);
            border: 1px solid rgba(255, 107, 107, 0.32);
            color: var(--danger);
            padding: 11px 14px;
            border-radius: 13px;
            font-weight: 500;
            text-align: left;
        }

        .info a { color: var(--lime); text-decoration: none; font-weight: 600; }
        .info a:hover { text-decoration: underline; }

        .wifi-container { display: flex; flex-direction: column; gap: 10px; margin-bottom: 22px; }

        .wifi-button {
            display: block;
            padding: 14px 18px;
            font-weight: 650;
            font-size: 14.5px;
            text-decoration: none;
            border-radius: 14px;
            text-align: center;
            width: 100%;
            letter-spacing: 0.1px;
            transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
        }

        .wifi-button-primary {
            background: linear-gradient(180deg, var(--lime), var(--lime-deep));
            color: #0A1005;
            box-shadow: 0 8px 22px rgba(163, 230, 53, 0.24);
        }

        .wifi-button-secondary {
            background: rgba(34, 197, 94, 0.09);
            border: 1px solid rgba(34, 197, 94, 0.32);
            color: #7DE8A5;
        }

        .wifi-button:active { transform: translateY(1px); }

        @media (hover: hover) {
            .wifi-button-primary:hover { box-shadow: 0 12px 28px rgba(163, 230, 53, 0.34); }
            .wifi-button-secondary:hover { background: rgba(34, 197, 94, 0.16); }
        }

        .sep {
            display: flex;
            align-items: center;
            gap: 12px;
            margin: 0 0 18px;
            color: var(--muted);
            font-size: 11.5px;
            text-transform: uppercase;
            letter-spacing: 1.1px;
        }

        .sep::before, .sep::after { content: ''; flex: 1; height: 1px; background: var(--line-soft); }

        label { display: block; position: relative; margin-bottom: 11px; }

        label img.ico {
            position: absolute;
            left: 15px;
            top: 50%;
            transform: translateY(-50%);
            width: 18px;
            height: 18px;
            /* Force l'icône en clair quelle que soit la couleur du SVG d'origine */
            filter: brightness(0) invert(1);
            opacity: 0.38;
            pointer-events: none;
            z-index: 1;
        }

        input[type="text"], input[type="password"] {
            width: 100%;
            padding: 14px 15px 14px 44px;
            border: 1px solid var(--line);
            border-radius: 14px;
            font-size: 16px; /* 16px minimum: évite le zoom auto sur iOS */
            background: var(--field);
            color: var(--text);
            font-family: inherit;
            transition: border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
        }

        input[type="text"]:focus, input[type="password"]:focus {
            outline: none;
            border-color: rgba(163, 230, 53, 0.55);
            background: #0F1712;
            box-shadow: 0 0 0 3px rgba(163, 230, 53, 0.14);
        }

        input[type="text"]::placeholder, input[type="password"]::placeholder { color: #5F6E66; }

        input[type="submit"] {
            width: 100%;
            padding: 15px;
            background: linear-gradient(180deg, var(--lime), var(--lime-deep));
            color: #0A1005;
            border: none;
            border-radius: 14px;
            font-size: 15px;
            font-weight: 750;
            font-family: inherit;
            cursor: pointer;
            letter-spacing: 0.4px;
            box-shadow: 0 10px 26px rgba(163, 230, 53, 0.26);
            margin-top: 9px;
            -webkit-appearance: none;
            appearance: none;
            transition: transform 0.16s ease, box-shadow 0.16s ease;
        }

        input[type="submit"]:active { transform: translateY(1px); }

        @media (hover: hover) {
            input[type="submit"]:hover { box-shadow: 0 14px 32px rgba(163, 230, 53, 0.36); }
        }

        .info.bt {
            margin: 20px 0 0;
            padding-top: 16px;
            border-top: 1px solid var(--line-soft);
            color: #6B7A72;
            font-size: 11.5px;
            letter-spacing: 0.2px;
        }

        .help { margin: 14px 0 0; text-align: center; font-size: 12.5px; }
        .help a { color: var(--lime); text-decoration: none; font-weight: 600; }

        @media (min-width: 480px) {
            .main { padding: 40px 24px; }
            .wrap { padding: 34px 30px 28px; border-radius: 26px; }
            h1 { font-size: 23px; }
            .info { font-size: 14px; }
            .wifi-button { padding: 15px 20px; font-size: 15px; }
        }

        @media (prefers-reduced-motion: reduce) {
            .animated.fadeIn { animation: none; }
            * { transition: none !important; }
        }`,

  clair: `
        :root {
            --bg: #F6F7F5;
            --surface: #FFFFFF;
            --field: #F3F4F1;
            --line: #E3E6E1;
            --line-soft: #EDEFEA;
            --lime: #A3E635;
            --lime-deep: #7CCF19;
            --ink: #0A1005;
            --text: #14201A;
            --muted: #5E6B63;
            --accent-text: #4D7C0F;
            --danger: #B42318;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { -webkit-text-size-adjust: 100%; }

        body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
            min-height: 100vh;
            min-height: 100dvh;
            display: flex;
            flex-direction: column;
            background: var(--bg);
            color: var(--text);
            position: relative;
            overflow-x: hidden;
            color-scheme: light;
        }

        body::before {
            content: '';
            position: fixed;
            inset: 0;
            background: radial-gradient(70% 45% at 50% -5%, rgba(163, 230, 53, 0.22), transparent 70%);
            pointer-events: none;
            z-index: 0;
        }

        .ie-fixMinHeight { flex: 1; display: flex; align-items: center; justify-content: center; width: 100%; }

        .main {
            width: 100%;
            display: flex;
            justify-content: center;
            padding: 24px 16px calc(24px + env(safe-area-inset-bottom));
            position: relative;
            z-index: 1;
        }

        .wrap {
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 22px;
            padding: 26px 20px 22px;
            max-width: 420px;
            width: 100%;
            box-shadow: 0 12px 34px rgba(16, 24, 20, 0.08);
        }

        .animated.fadeIn { animation: slideUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) both; }
        @keyframes slideUp {
            from { opacity: 0; transform: translateY(16px); }
            to   { opacity: 1; transform: translateY(0); }
        }

        h1 {
            font-size: 19px;
            font-weight: 700;
            letter-spacing: -0.2px;
            text-align: center;
            margin: 4px 0 8px;
            line-height: 1.3;
        }

        .info {
            text-align: center;
            color: var(--muted);
            margin-bottom: 20px;
            font-size: 13.5px;
            line-height: 1.6;
        }

        .info.alert {
            background: #FEF3F2;
            border: 1px solid #FDA29B;
            color: var(--danger);
            padding: 11px 14px;
            border-radius: 13px;
            font-weight: 500;
            text-align: left;
        }

        .info a { color: var(--accent-text); text-decoration: none; font-weight: 600; }
        .info a:hover { text-decoration: underline; }

        .wifi-container { display: flex; flex-direction: column; gap: 10px; margin-bottom: 22px; }

        .wifi-button {
            display: block;
            padding: 14px 18px;
            font-weight: 650;
            font-size: 14.5px;
            text-decoration: none;
            border-radius: 14px;
            text-align: center;
            width: 100%;
            letter-spacing: 0.1px;
            transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
        }

        .wifi-button-primary {
            background: linear-gradient(180deg, var(--lime), var(--lime-deep));
            color: var(--ink);
            box-shadow: 0 8px 20px rgba(124, 207, 25, 0.28);
        }

        .wifi-button-secondary {
            background: #FFFFFF;
            border: 1px solid var(--line);
            color: var(--accent-text);
        }

        .wifi-button:active { transform: translateY(1px); }

        @media (hover: hover) {
            .wifi-button-primary:hover { box-shadow: 0 12px 26px rgba(124, 207, 25, 0.36); }
            .wifi-button-secondary:hover { background: #F5F8F0; }
        }

        .sep {
            display: flex;
            align-items: center;
            gap: 12px;
            margin: 0 0 18px;
            color: var(--muted);
            font-size: 11.5px;
            text-transform: uppercase;
            letter-spacing: 1.1px;
        }

        .sep::before, .sep::after { content: ''; flex: 1; height: 1px; background: var(--line); }

        label { display: block; position: relative; margin-bottom: 11px; }

        label img.ico {
            position: absolute;
            left: 15px;
            top: 50%;
            transform: translateY(-50%);
            width: 18px;
            height: 18px;
            opacity: 0.45;
            pointer-events: none;
            z-index: 1;
        }

        input[type="text"], input[type="password"] {
            width: 100%;
            padding: 14px 15px 14px 44px;
            border: 1px solid var(--line);
            border-radius: 14px;
            font-size: 16px; /* 16px minimum: évite le zoom auto sur iOS */
            background: var(--field);
            color: var(--text);
            font-family: inherit;
            transition: border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
        }

        input[type="text"]:focus, input[type="password"]:focus {
            outline: none;
            border-color: var(--lime-deep);
            background: #FFFFFF;
            box-shadow: 0 0 0 3px rgba(163, 230, 53, 0.25);
        }

        input[type="text"]::placeholder, input[type="password"]::placeholder { color: #98A29B; }

        input[type="submit"] {
            width: 100%;
            padding: 15px;
            background: linear-gradient(180deg, var(--lime), var(--lime-deep));
            color: var(--ink);
            border: none;
            border-radius: 14px;
            font-size: 15px;
            font-weight: 750;
            font-family: inherit;
            cursor: pointer;
            letter-spacing: 0.4px;
            box-shadow: 0 10px 24px rgba(124, 207, 25, 0.3);
            margin-top: 9px;
            -webkit-appearance: none;
            appearance: none;
            transition: transform 0.16s ease, box-shadow 0.16s ease;
        }

        input[type="submit"]:active { transform: translateY(1px); }

        .info.bt {
            margin: 20px 0 0;
            padding-top: 16px;
            border-top: 1px solid var(--line-soft);
            color: #8A948C;
            font-size: 11.5px;
            letter-spacing: 0.2px;
        }

        .help { margin: 14px 0 0; text-align: center; font-size: 12.5px; }
        .help a { color: var(--accent-text); text-decoration: none; font-weight: 600; }

        @media (min-width: 480px) {
            .main { padding: 40px 24px; }
            .wrap { padding: 34px 30px 28px; border-radius: 26px; }
            h1 { font-size: 23px; }
            .info { font-size: 14px; }
            .wifi-button { padding: 15px 20px; font-size: 15px; }
        }

        @media (prefers-reduced-motion: reduce) {
            .animated.fadeIn { animation: none; }
            * { transition: none !important; }
        }`,

  // Volontairement sans dégradé, sans ombre, sans animation et sans filtre:
  // ces effets sont ce qui rame sur un téléphone d'entrée de gamme.
  minimal: `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { -webkit-text-size-adjust: 100%; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            background: #FFFFFF;
            color: #111111;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            color-scheme: light;
        }

        .ie-fixMinHeight { flex: 1; display: flex; align-items: flex-start; justify-content: center; width: 100%; }
        .main { width: 100%; display: flex; justify-content: center; padding: 20px 14px; }

        .wrap {
            width: 100%;
            max-width: 400px;
            border: 1px solid #D8D8D8;
            border-radius: 10px;
            padding: 20px 16px;
        }

        h1 { font-size: 20px; font-weight: 700; text-align: center; margin-bottom: 8px; line-height: 1.3; }

        .info { text-align: center; color: #555555; font-size: 14px; line-height: 1.5; margin-bottom: 18px; }

        .info.alert {
            border: 1px solid #C62828;
            color: #C62828;
            padding: 10px 12px;
            border-radius: 8px;
            text-align: left;
        }

        .info a { color: #2E6B00; font-weight: 700; }

        .wifi-container { display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px; }

        .wifi-button {
            display: block;
            padding: 14px 16px;
            font-size: 15px;
            font-weight: 700;
            text-align: center;
            text-decoration: none;
            border-radius: 8px;
        }

        .wifi-button-primary { background: #A3E635; color: #0A1005; }
        .wifi-button-secondary { background: #FFFFFF; border: 1px solid #C9C9C9; color: #2E6B00; }

        .sep { text-align: center; color: #777777; font-size: 12px; text-transform: uppercase; margin-bottom: 14px; }

        label { display: block; position: relative; margin-bottom: 10px; }
        label img.ico { display: none; }

        input[type="text"], input[type="password"] {
            width: 100%;
            padding: 13px 12px;
            border: 1px solid #C9C9C9;
            border-radius: 8px;
            font-size: 16px; /* 16px minimum: évite le zoom auto sur iOS */
            font-family: inherit;
            color: #111111;
            background: #FFFFFF;
        }

        input[type="submit"] {
            width: 100%;
            padding: 14px;
            background: #A3E635;
            color: #0A1005;
            border: none;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 700;
            font-family: inherit;
            cursor: pointer;
            margin-top: 8px;
            -webkit-appearance: none;
            appearance: none;
        }

        .info.bt {
            margin-top: 18px;
            padding-top: 14px;
            border-top: 1px solid #E5E5E5;
            color: #777777;
            font-size: 12px;
        }

        .help { margin-top: 12px; text-align: center; font-size: 13px; }
        .help a { color: #2E6B00; font-weight: 700; }`,

  // Reprise du gabarit « Glassmorph ». Seule entorse à l'original: la photo
  // Unsplash du fond est remplacée par un dégradé CSS, car une image distante
  // ne se charge pas tant que le client n'est pas authentifié.
  verre: `
        :root {
            --brand-color: #007BFF;
            --brand-hover: #0056b3;
            --glass-bg: rgba(255, 255, 255, 0.08);
            --glass-border: rgba(255, 255, 255, 0.18);
            --text-main: #FFFFFF;
            --text-muted: rgba(255, 255, 255, 0.7);
            --shadow-card: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            min-height: 100vh;
            min-height: 100dvh;
            display: flex;
            justify-content: center;
            align-items: center;
            background:
                radial-gradient(90% 70% at 15% 0%, #1b3a5c 0%, transparent 60%),
                radial-gradient(80% 60% at 100% 100%, #123047 0%, transparent 65%),
                linear-gradient(135deg, #060b12 0%, #0d1621 100%);
            background-attachment: fixed;
            color: var(--text-main);
            padding: 20px;
            position: relative;
            color-scheme: dark;
        }

        body::before {
            content: '';
            position: fixed;
            inset: 0;
            background: linear-gradient(135deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.35) 100%);
            pointer-events: none;
        }

        .login-card {
            position: relative;
            background: var(--glass-bg);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid var(--glass-border);
            border-radius: 24px;
            padding: 40px;
            width: 100%;
            max-width: 420px;
            box-shadow: var(--shadow-card);
            display: flex;
            flex-direction: column;
            gap: 25px;
            animation: fadeIn 0.5s ease-out;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .card-header { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 15px; }

        h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }

        .subtitle { font-size: 15px; color: var(--text-muted); line-height: 1.5; }

        .action-container { display: flex; flex-direction: column; gap: 12px; }

        .btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            width: 100%;
            padding: 14px 20px;
            font-size: 16px;
            font-weight: 600;
            text-decoration: none;
            border-radius: 12px;
            transition: all 0.2s ease;
            border: none;
            cursor: pointer;
            font-family: inherit;
        }

        .btn .ico { width: 20px; height: 20px; flex-shrink: 0; }

        .btn-primary { background-color: var(--brand-color); color: #fff; }
        .btn-primary:hover { background-color: var(--brand-hover); transform: translateY(-1px); }

        .btn-secondary {
            background-color: rgba(255, 255, 255, 0.05);
            color: var(--text-main);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .btn-secondary:hover { background-color: rgba(255, 255, 255, 0.1); }

        .divider {
            display: flex;
            align-items: center;
            text-transform: uppercase;
            font-size: 11px;
            color: var(--text-muted);
            letter-spacing: 1px;
        }
        .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.1); }
        .divider span { padding: 0 15px; }

        .form-group { position: relative; }

        .form-icon {
            position: absolute;
            left: 15px;
            top: 50%;
            transform: translateY(-50%);
            width: 20px;
            height: 20px;
            color: var(--text-muted);
            opacity: 0.6;
            pointer-events: none;
        }

        .form-input {
            width: 100%;
            padding: 15px 15px 15px 45px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            font-size: 16px;
            color: #fff;
            font-family: inherit;
            transition: all 0.3s ease;
        }

        .form-input::placeholder { color: rgba(255, 255, 255, 0.4); }

        .form-input:focus {
            outline: none;
            border-color: var(--brand-color);
            background: rgba(255, 255, 255, 0.1);
            box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
        }

        .alert-box {
            background: rgba(220, 53, 69, 0.15);
            border: 1px solid rgba(220, 53, 69, 0.3);
            color: #ff8b94;
            padding: 15px;
            border-radius: 12px;
            font-size: 14px;
            text-align: center;
        }

        .card-footer {
            text-align: center;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.5);
            margin-top: -10px;
        }

        .help { text-align: center; font-size: 13px; margin-top: -10px; }
        .help a { color: #fff; font-weight: 600; text-decoration: underline; }

        @media (max-width: 480px) {
            .login-card { padding: 30px; }
            h1 { font-size: 22px; }
        }

        @media (prefers-reduced-motion: reduce) {
            .login-card { animation: none; }
            * { transition: none !important; }
        }`,

  // Reprise du gabarit « Max Edit ». Le logo distant est remplacé par le nom
  // de la zone en typographie, pour la même raison que ci-dessus.
  editorial: `
        :root {
            --brand-color: #000000;
            --brand-hover: #333333;
            --bg-page: #FFFFFF;
            --text-main: #000000;
            --text-muted: #666666;
            --border-color: #E0E0E0;
            --input-bg: #FAFAFA;
            --error-bg: #FFF5F5;
            --error-text: #D93025;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            -webkit-font-smoothing: antialiased;
            min-height: 100vh;
            min-height: 100dvh;
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: var(--bg-page);
            color: var(--text-main);
            padding: 20px;
            color-scheme: light;
        }

        .minimal-card {
            width: 100%;
            max-width: 400px;
            background: #FFFFFF;
            /* Pas d'ombre portée lourde, juste une fine bordure */
            border: 1px solid var(--border-color);
            padding: 50px 40px;
            display: flex;
            flex-direction: column;
            gap: 40px;
        }

        .card-header { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 20px; }

        h1 {
            font-size: 28px;
            font-weight: 800;
            letter-spacing: -1px;
            text-transform: uppercase;
            line-height: 1.15;
        }

        .subtitle { font-size: 16px; color: var(--text-muted); line-height: 1.6; font-weight: 300; }

        .action-container { display: flex; flex-direction: column; gap: 15px; }

        .btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            width: 100%;
            padding: 16px 20px;
            font-size: 14px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            text-decoration: none;
            border-radius: 0; /* Carré, strict */
            transition: all 0.3s ease;
            border: 1px solid var(--brand-color);
            cursor: pointer;
            font-family: inherit;
        }

        .btn .ico { width: 18px; height: 18px; flex-shrink: 0; }

        .btn-primary { background-color: var(--brand-color); color: #FFFFFF; }
        .btn-primary:hover { background-color: var(--brand-hover); border-color: var(--brand-hover); }

        .btn-secondary { background-color: transparent; color: var(--brand-color); }
        .btn-secondary:hover { background-color: rgba(0,0,0,0.05); }

        .divider {
            text-align: center;
            font-size: 12px;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 2px;
            position: relative;
        }
        .divider::before { content: ''; position: absolute; left: 0; top: 50%; width: 40%; height: 1px; background: var(--border-color); }
        .divider::after { content: ''; position: absolute; right: 0; top: 50%; width: 40%; height: 1px; background: var(--border-color); }

        .form-group { position: relative; }

        .form-icon {
            position: absolute;
            left: 15px;
            top: 50%;
            transform: translateY(-50%);
            width: 18px;
            height: 18px;
            color: var(--text-muted);
            pointer-events: none;
        }

        .form-input {
            width: 100%;
            padding: 18px 15px 18px 50px;
            background: var(--input-bg);
            border: 1px solid var(--border-color);
            border-radius: 0;
            font-size: 16px;
            color: var(--text-main);
            font-family: inherit;
            transition: border-color 0.3s ease;
        }

        .form-input:focus { outline: none; border-color: var(--text-main); }

        ::placeholder { color: #BBBBBB; }

        .alert-box {
            background: var(--error-bg);
            color: var(--error-text);
            padding: 15px;
            text-align: center;
            font-size: 13px;
            border: 1px solid #ffcccc;
        }

        .card-footer {
            text-align: center;
            font-size: 11px;
            color: #AAAAAA;
            letter-spacing: 1px;
            text-transform: uppercase;
        }

        .help { text-align: center; font-size: 12px; letter-spacing: 0.5px; }
        .help a { color: var(--brand-color); font-weight: 700; }

        @media (max-width: 480px) {
            .minimal-card { padding: 40px 30px; }
            h1 { font-size: 24px; }
        }

        @media (prefers-reduced-motion: reduce) {
            * { transition: none !important; }
        }`,

  // Reprise du gabarit « Dark Industrie ».
  industriel: `
        :root {
            --brand-color: #32CD32;
            --brand-hover: #2E8B57;
            --bg-body: #121212;
            --bg-card: #1E1E1E;
            --text-main: #FFFFFF;
            --text-muted: #AAAAAA;
            --border-color: #333333;
            --input-bg: #2C2C2C;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            min-height: 100vh;
            min-height: 100dvh;
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: var(--bg-body);
            color: var(--text-main);
            padding: 20px;
            color-scheme: dark;
        }

        .dark-card {
            width: 100%;
            max-width: 420px;
            background-color: var(--bg-card);
            border: 1px solid var(--border-color);
            padding: 40px;
            display: flex;
            flex-direction: column;
            gap: 30px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.5);
        }

        .card-header { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 15px; }

        h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.5px; line-height: 1.25; }

        .subtitle { font-size: 14px; color: var(--text-muted); line-height: 1.5; }

        .action-container { display: flex; flex-direction: column; gap: 12px; }

        .btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            width: 100%;
            padding: 15px 20px;
            font-size: 15px;
            font-weight: 600;
            text-decoration: none;
            border-radius: 8px;
            transition: all 0.3s ease;
            border: none;
            cursor: pointer;
            font-family: inherit;
        }

        .btn .ico { width: 19px; height: 19px; flex-shrink: 0; }

        .btn-primary { background-color: var(--brand-color); color: #000000; }
        .btn-primary:hover { background-color: var(--brand-hover); }

        .btn-secondary { background-color: transparent; border: 1px solid var(--border-color); color: var(--text-main); }
        .btn-secondary:hover { background-color: rgba(255,255,255,0.05); }

        .divider { display: flex; align-items: center; font-size: 12px; color: var(--text-muted); }
        .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--border-color); }
        .divider span { padding: 0 15px; }

        .form-group { position: relative; }

        .form-icon {
            position: absolute;
            left: 15px;
            top: 50%;
            transform: translateY(-50%);
            width: 18px;
            height: 18px;
            color: var(--text-muted);
            pointer-events: none;
        }

        .form-input {
            width: 100%;
            padding: 16px 15px 16px 45px;
            background-color: var(--input-bg);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            font-size: 16px;
            color: var(--text-main);
            font-family: inherit;
            transition: border-color 0.3s ease;
        }

        .form-input:focus { outline: none; border-color: var(--brand-color); }

        ::placeholder { color: var(--text-muted); opacity: 0.5; }

        .alert-box {
            background-color: rgba(239, 83, 80, 0.2);
            color: #ef5350;
            padding: 12px;
            text-align: center;
            font-size: 13px;
            border-radius: 8px;
            border: 1px solid rgba(239, 83, 80, 0.3);
        }

        .card-footer { text-align: center; font-size: 11px; color: var(--text-muted); margin-top: -10px; }

        .help { text-align: center; font-size: 13px; margin-top: -10px; }
        .help a { color: var(--brand-color); font-weight: 600; }

        @media (prefers-reduced-motion: reduce) {
            * { transition: none !important; }
        }`,
};

const THEME_COLOR = {
  sombre: '#080B0A',
  clair: '#F6F7F5',
  minimal: '#FFFFFF',
  verre: '#0d1621',
  editorial: '#FFFFFF',
  industriel: '#121212',
};

/** Bloc CHAP de MikroTik, identique pour tous les gabarits. */
const CHAP_BLOCK = `    $(if chap-id)
    <form name="sendin" action="$(link-login-only)" method="post" style="display:none">
        <input type="hidden" name="username" />
        <input type="hidden" name="password" />
        <input type="hidden" name="dst" value="$(link-orig)" />
        <input type="hidden" name="popup" value="true" />
    </form>
    <script src="/md5.js"></script>
    <script>
        function doLogin() {
            document.sendin.username.value = document.login.username.value;
            document.sendin.password.value = hexMD5('$(chap-id)' + document.login.password.value + '$(chap-challenge)');
            document.sendin.submit();
            return false;
        }
    </script>
    $(endif)`;

/* ------------------------------------------------------------------- login */

/**
 * Page de connexion du portail captif, remplie pour une zone précise.
 *
 * Les blocs `$(if ...)`, `$(endif)` et `$(variable)` sont recopiés tels quels:
 * ils sont interprétés par le routeur, pas ici.
 */
export function buildLoginHtml(options = {}) {
  const variant = options.variant || 'sombre';

  if (variant === 'verre') return buildVerreLogin(options);
  if (variant === 'editorial') return buildEditorialLogin(options);
  if (variant === 'industriel') return buildIndustrielLogin(options);

  return buildFozoneLogin(options);
}

/** Gabarits d'origine Fô-Zône: sombre, clair, minimal. */
function buildFozoneLogin({
  variant = 'sombre',
  displayName = 'Wi-Fi Zone',
  footerText = '',
  whatsapp = '',
  buyUrl,
  recoveryUrl,
}) {
  const style = STYLES[variant] || STYLES.sombre;
  const themeColor = THEME_COLOR[variant] || THEME_COLOR.sombre;
  const phone = normalizePhone(whatsapp);

  const helpBlock = phone
    ? `
                <p class="help">
                    Un souci&nbsp;? <a href="https://wa.me/${phone}">Écrivez-nous sur WhatsApp</a>
                </p>`
    : '';

  const footerBlock = footerText
    ? `
                <p class="info bt">${escapeHtml(footerText)}</p>`
    : '';

  return `<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta http-equiv="pragma" content="no-cache" />
    <meta http-equiv="expires" content="-1" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="${themeColor}" />
    <title>Internet hotspot - Log in</title>
    <style>${style}
    </style>
</head>
<body>
    $(if chap-id)
    <form name="sendin" action="$(link-login-only)" method="post" style="display:none">
        <input type="hidden" name="username" />
        <input type="hidden" name="password" />
        <input type="hidden" name="dst" value="$(link-orig)" />
        <input type="hidden" name="popup" value="true" />
    </form>
    <script src="/md5.js"></script>
    <script>
        function doLogin() {
            document.sendin.username.value = document.login.username.value;
            document.sendin.password.value = hexMD5('$(chap-id)' + document.login.password.value + '$(chap-challenge)');
            document.sendin.submit();
            return false;
        }
    </script>
    $(endif)
    <div class="ie-fixMinHeight">
        <div class="main">
            <div class="wrap animated fadeIn">
                <form name="login" action="$(link-login-only)" method="post" $(if chap-id) onSubmit="return doLogin()" $(endif)>
                    <input type="hidden" name="dst" value="$(link-orig)" />
                    <input type="hidden" name="popup" value="true" />
                    <h1>${escapeHtml(displayName)}</h1>
                    <p class="info $(if error)alert$(endif)">
                        $(if error == "")Entrez votre nom d'utilisateur et votre mot de passe pour vous connecter $(if trial == 'yes')<br />Essai gratuit disponible, <a href="$(link-login-only)?dst=$(link-orig-esc)&amp;username=T-$(mac-esc)">cliquez ici</a>.$(endif)
                        $(endif)
                        $(if error)$(error)$(endif)
                    </p>
                    <div class="wifi-container">
                        <a href="${buyUrl}" class="wifi-button wifi-button-primary">
                            Acheter un ticket Wi-Fi
                        </a>
                        <a href="${recoveryUrl}" class="wifi-button wifi-button-secondary">
                            Récupérer mon ticket
                        </a>
                    </div>
                    <div class="sep">ou connectez-vous</div>
                    <label>
                        <img class="ico" src="img/user.svg" alt="" />
                        <input name="username" type="text" value="$(username)" placeholder="Nom d'utilisateur" />
                    </label>
                    <label>
                        <img class="ico" src="img/password.svg" alt="" />
                        <input name="password" type="password" placeholder="Mot de passe" />
                    </label>
                    <input type="submit" value="SE CONNECTER" />
                </form>${helpBlock}${footerBlock}
            </div>
        </div>
    </div>
</body>
</html>
`;
}

/**
 * « Verre » — carte translucide sur fond sombre.
 * Le fond photo distant de l'original est devenu un dégradé CSS : une image
 * hébergée ailleurs ne se charge pas avant que le client soit connecté.
 */
function buildVerreLogin({
  displayName = 'Wi-Fi Zone',
  footerText = '',
  whatsapp = '',
  buyUrl,
  recoveryUrl,
}) {
  const phone = normalizePhone(whatsapp);

  return `<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta http-equiv="pragma" content="no-cache" />
    <meta http-equiv="expires" content="-1" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="${THEME_COLOR.verre}" />
    <title>Internet hotspot - Log in</title>
    <style>${STYLES.verre}
    </style>
</head>
<body>
${CHAP_BLOCK}

    <div class="login-card">
        <div class="card-header">
            <h1>${escapeHtml(displayName)}</h1>
            <p class="subtitle">Veuillez vous identifier pour accéder à internet.</p>
        </div>

        $(if error)
        <div class="alert-box">$(error)</div>
        $(endif)

        <div class="action-container">
            <a href="${buyUrl}" class="btn btn-primary">
                ${ICONS.cart}
                Acheter un accès
            </a>
            <a href="${recoveryUrl}" class="btn btn-secondary">
                ${ICONS.ticket}
                J'ai déjà un ticket
            </a>
        </div>

        <div class="divider"><span>ou</span></div>

        <form name="login" action="$(link-login-only)" method="post" $(if chap-id) onSubmit="return doLogin()" $(endif) class="login-form">
            <input type="hidden" name="dst" value="$(link-orig)" />
            <input type="hidden" name="popup" value="true" />

            <div style="display: flex; flex-direction: column; gap: 15px;">
                <div class="form-group">
                    <span class="form-icon">${ICONS.user}</span>
                    <input name="username" type="text" value="$(username)" placeholder="Nom d'utilisateur" class="form-input" required />
                </div>

                <div class="form-group">
                    <span class="form-icon">${ICONS.lock}</span>
                    <input name="password" type="password" placeholder="Mot de passe" class="form-input" />
                </div>

                <button type="submit" class="btn btn-primary">
                    Se connecter
                </button>
            </div>
        </form>
${phone ? `
        <p class="help">Un souci&nbsp;? <a href="https://wa.me/${phone}">Écrivez-nous sur WhatsApp</a></p>` : ''}${footerText ? `
        <div class="card-footer"><p>${escapeHtml(footerText)}</p></div>` : ''}
    </div>

</body>
</html>
`;
}

/**
 * « Éditorial » — noir et blanc, angles droits.
 * Le logo distant de l'original est remplacé par le nom de la zone en
 * typographie : c'est déjà la vocation de ce gabarit.
 */
function buildEditorialLogin({
  displayName = 'Wi-Fi Zone',
  footerText = '',
  whatsapp = '',
  buyUrl,
  recoveryUrl,
}) {
  const phone = normalizePhone(whatsapp);

  return `<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta http-equiv="pragma" content="no-cache" />
    <meta http-equiv="expires" content="-1" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="${THEME_COLOR.editorial}" />
    <title>Internet hotspot - Log in</title>
    <style>${STYLES.editorial}
    </style>
</head>
<body>
${CHAP_BLOCK}

    <div class="minimal-card">
        <div class="card-header">
            <h1>${escapeHtml(displayName)}</h1>
            <p class="subtitle">Veuillez vous authentifier pour continuer.</p>
        </div>

        $(if error)
        <div class="alert-box">$(error)</div>
        $(endif)

        <div class="action-container">
            <a href="${buyUrl}" class="btn btn-primary">
                ${ICONS.cart}
                Acheter un accès
            </a>
            <a href="${recoveryUrl}" class="btn btn-secondary">
                ${ICONS.ticket}
                Récupérer mon ticket
            </a>
        </div>

        <div class="divider"><span>ou</span></div>

        <form name="login" action="$(link-login-only)" method="post" $(if chap-id) onSubmit="return doLogin()" $(endif) class="login-form">
            <input type="hidden" name="dst" value="$(link-orig)" />
            <input type="hidden" name="popup" value="true" />

            <div style="display: flex; flex-direction: column; gap: 20px;">
                <div class="form-group">
                    <span class="form-icon">${ICONS.user}</span>
                    <input name="username" type="text" value="$(username)" placeholder="Identifiant" class="form-input" required />
                </div>

                <div class="form-group">
                    <span class="form-icon">${ICONS.lock}</span>
                    <input name="password" type="password" placeholder="Mot de passe" class="form-input" />
                </div>

                <button type="submit" class="btn btn-primary">
                    Connexion sécurisée
                </button>
            </div>
        </form>
${phone ? `
        <p class="help">Un souci&nbsp;? <a href="https://wa.me/${phone}">Écrivez-nous sur WhatsApp</a></p>` : ''}${footerText ? `
        <div class="card-footer"><p>${escapeHtml(footerText)}</p></div>` : ''}
    </div>

</body>
</html>
`;
}

/** « Industriel » — anthracite et vert électrique. */
function buildIndustrielLogin({
  displayName = 'Wi-Fi Zone',
  footerText = '',
  whatsapp = '',
  buyUrl,
  recoveryUrl,
}) {
  const phone = normalizePhone(whatsapp);

  return `<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta http-equiv="pragma" content="no-cache" />
    <meta http-equiv="expires" content="-1" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="${THEME_COLOR.industriel}" />
    <title>Internet hotspot - Log in</title>
    <style>${STYLES.industriel}
    </style>
</head>
<body>
${CHAP_BLOCK}

    <div class="dark-card">
        <div class="card-header">
            <h1>${escapeHtml(displayName)}</h1>
            <p class="subtitle">Connectez-vous pour accéder à internet.</p>
        </div>

        $(if error)
        <div class="alert-box">$(error)</div>
        $(endif)

        <div class="action-container">
            <a href="${buyUrl}" class="btn btn-primary">
                ${ICONS.bolt}
                Acheter un pass rapide
            </a>
            <a href="${recoveryUrl}" class="btn btn-secondary">
                ${ICONS.ticket}
                Utiliser un code existant
            </a>
        </div>

        <div class="divider"><span>ou identifiez-vous</span></div>

        <form name="login" action="$(link-login-only)" method="post" $(if chap-id) onSubmit="return doLogin()" $(endif) class="login-form">
            <input type="hidden" name="dst" value="$(link-orig)" />
            <input type="hidden" name="popup" value="true" />

            <div style="display: flex; flex-direction: column; gap: 15px;">
                <div class="form-group">
                    <span class="form-icon">${ICONS.user}</span>
                    <input name="username" type="text" value="$(username)" placeholder="Utilisateur" class="form-input" required />
                </div>

                <div class="form-group">
                    <span class="form-icon">${ICONS.shield}</span>
                    <input name="password" type="password" placeholder="Mot de passe" class="form-input" />
                </div>

                <button type="submit" class="btn btn-primary">
                    CONNEXION
                </button>
            </div>
        </form>
${phone ? `
        <p class="help">Un souci&nbsp;? <a href="https://wa.me/${phone}">Écrivez-nous sur WhatsApp</a></p>` : ''}${footerText ? `
        <div class="card-footer"><p>${escapeHtml(footerText)}</p></div>` : ''}
    </div>

</body>
</html>
`;
}

/* ---------------------------------------------------------------- redirect */

/**
 * Page affichée juste après une connexion réussie. Rien n'y est propre à un
 * promoteur : seul le style suit la variante choisie.
 */
export function buildRedirectHtml({ variant = 'sombre' } = {}) {
  const dark = ['sombre', 'verre', 'industriel'].includes(variant);
  const themeColor = THEME_COLOR[variant] || THEME_COLOR.sombre;

  const palette = dark
    ? { bg: '#080B0A', surface: 'rgba(23, 32, 27, 0.92)', line: 'rgba(255,255,255,0.08)', text: '#E9F1EB', muted: '#8B9A91' }
    : { bg: '#F6F7F5', surface: '#FFFFFF', line: '#E3E6E1', text: '#14201A', muted: '#5E6B63' };

  const decoration = dark
    ? `
        body::before {
            content: '';
            position: fixed;
            inset: 0;
            background: radial-gradient(80% 55% at 50% -10%, rgba(34, 197, 94, 0.28), transparent 70%);
            pointer-events: none;
        }`
    : '';

  return `<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta http-equiv="refresh" content="2; url=$(link-redirect)">
    <meta http-equiv="pragma" content="no-cache" />
    <meta http-equiv="expires" content="-1" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="${themeColor}" />
    <title>Internet hotspot &gt; redirect</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: ${palette.bg};
            color: ${palette.text};
            padding: 24px 16px;
            color-scheme: ${dark ? 'dark' : 'light'};
        }
${decoration}

        .wrap {
            position: relative;
            background: ${palette.surface};
            border: 1px solid ${palette.line};
            border-radius: 22px;
            padding: 30px 24px;
            max-width: 400px;
            width: 100%;
            text-align: center;
        }

        h1 { font-size: 20px; font-weight: 700; margin-bottom: 8px; letter-spacing: -0.2px; }

        .info { color: ${palette.muted}; font-size: 13.5px; line-height: 1.6; }
        .info a { color: #7CCF19; text-decoration: none; font-weight: 600; }

        .bar {
            margin-top: 20px;
            height: 4px;
            border-radius: 999px;
            background: ${palette.line};
            overflow: hidden;
        }

        .bar span {
            display: block;
            height: 100%;
            width: 40%;
            border-radius: 999px;
            background: linear-gradient(90deg, #A3E635, #7CCF19);
            animation: slide 1.1s ease-in-out infinite;
        }

        @keyframes slide {
            0%   { transform: translateX(-100%); }
            100% { transform: translateX(300%); }
        }

        @media (prefers-reduced-motion: reduce) {
            .bar span { animation: none; width: 100%; }
        }
    </style>
    <script>
        function startClock() {
            $(if popup == 'true')
            open('$(link-status)', 'hotspot_status', 'toolbar=0,location=0,directories=0,status=0,menubars=0,resizable=1,width=290,height=200');
            $(endif)
            location.href = unescape('$(link-redirect-esc)');
        }
    </script>
</head>
<body onLoad="startClock()">
    <div class="wrap">
        <h1>Vous êtes connecté</h1>
        <p class="info">Redirection en cours. Si rien ne se passe, <a href="$(link-redirect)">cliquez ici</a>.</p>
        <div class="bar"><span></span></div>
    </div>
</body>
</html>
`;
}

/* ---------------------------------------------------------- walled garden */

/**
 * Commandes RouterOS autorisant le parcours d'achat avant connexion.
 *
 * Sans elles, le client clique sur « Acheter un ticket » et n'arrive nulle
 * part : le hotspot bloque tout tant qu'il n'est pas authentifié. C'est la
 * panne numéro un d'un nouveau promoteur.
 *
 * `walled-garden ip` (couche 3) est celle qui fait passer le HTTPS ; la liste
 * `walled-garden` simple ne couvre que le HTTP.
 */
export function buildWalledGarden({ frontendHost, apiHost, whatsapp = '' }) {
  const hosts = [
    [frontendHost, 'Fo-Zone portail'],
    [`www.${frontendHost}`, 'Fo-Zone portail'],
    [apiHost, 'Fo-Zone API'],
    ['checkout.moneroo.io', 'Moneroo checkout'],
    ['api.moneroo.io', 'Moneroo API'],
    ['process.fedapay.com', 'FedaPay passerelle'],
    ['api.fedapay.com', 'FedaPay API'],
    ['fonts.googleapis.com', 'Polices'],
    ['fonts.gstatic.com', 'Polices'],
  ];

  // Le lien d'aide du portail pointe vers WhatsApp: sans ces hotes, il ne
  // s'ouvre pas non plus avant connexion.
  if (normalizePhone(whatsapp)) {
    hosts.push(['wa.me', 'Assistance WhatsApp']);
    hosts.push(['api.whatsapp.com', 'Assistance WhatsApp']);
  }

  const ipLines = hosts
    .map(([host, comment]) => `add action=accept dst-host=${host} comment="${comment}"`)
    .join('\n');

  const httpLines = [
    `add action=allow dst-host=${frontendHost}`,
    `add action=allow dst-host=*.${frontendHost}`,
    'add action=allow dst-host=*.moneroo.io',
    'add action=allow dst-host=*.fedapay.com',
  ].join('\n');

  return `/ip hotspot walled-garden ip
${ipLines}

/ip hotspot walled-garden
${httpLines}`;
}

/* -------------------------------------------------------------- aperçu ---- */

// Icônes fournies par MikroTik (img/user.svg, img/password.svg): absentes de
// ce dépôt, donc remplacées par des équivalentes pour l'aperçu seulement.
// Gris neutre: la variante sombre applique de toute facon un filtre qui les
// force en clair, la variante claire les garde tels quels.
const PREVIEW_USER_ICON =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23808080' stroke-width='2'><circle cx='12' cy='8' r='4'/><path d='M4 21c0-4 3.6-7 8-7s8 3 8 7'/></svg>";
const PREVIEW_LOCK_ICON =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23808080' stroke-width='2'><rect x='4' y='10' width='16' height='10' rx='2'/><path d='M8 10V7a4 4 0 0 1 8 0v3'/></svg>";

/**
 * Rend le gabarit affichable dans un navigateur ordinaire.
 *
 * Les balises `$(...)` ne veulent rien dire hors d'un routeur MikroTik : sans
 * cette résolution, l'aperçu afficherait du code brut à la place du texte.
 * Utilisé uniquement pour l'aperçu — jamais pour le fichier téléchargé.
 */
export function toPreviewHtml(html) {
  return (
    html
      // Bloc CHAP: dépend de /md5.js, absent hors routeur
      .replace(/\$\(if chap-id\)[\s\S]*?\$\(endif\)\s*/, '')
      .replace(/\$\(if chap-id\)[\s\S]*?\$\(endif\)/g, '')
      // Cas nominal: pas d'erreur, pas d'essai gratuit
      .replace(/\$\(if error\)alert\$\(endif\)/g, '')
      // Bloc d'erreur complet des gabarits Verre, Editorial et Industriel
      .replace(/\$\(if error\)[\s\S]*?\$\(endif\)/g, '')
      .replace(/\$\(if trial == 'yes'\)[\s\S]*?\$\(endif\)/g, '')
      .replace(/\$\(if error == ""\)/g, '')
      .replace(/\$\(if error\)\$\(error\)\$\(endif\)/g, '')
      .replace(/\$\(if popup == 'true'\)[\s\S]*?\$\(endif\)/g, '')
      .replace(/\$\(endif\)/g, '')
      // Liens et valeurs: neutralisés, l'aperçu ne doit rien déclencher
      .replace(/action="\$\(link-login-only\)"/g, 'action="#" onsubmit="return false"')
      .replace(/href="\$\(link-redirect\)"/g, 'href="#"')
      .replace(/\$\(username\)/g, '')
      .replace(/\$\([a-z-]+\)/g, '#')
      // Icônes du routeur
      .replace(/src="img\/user\.svg"/g, `src="${PREVIEW_USER_ICON}"`)
      .replace(/src="img\/password\.svg"/g, `src="${PREVIEW_LOCK_ICON}"`)
      .replace(/<meta http-equiv="refresh"[^>]*>/g, '')
  );
}
