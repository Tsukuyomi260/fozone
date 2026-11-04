'use strict';

/**
 * Filigrane acheteur pour le guide « Lancer sa Wi-Fi Zone ».
 *
 * Marque un exemplaire au nom de son acheteur. Tout est injecté dans le HTML
 * au moment de la generation : aucun JavaScript cote navigateur, donc couper JS
 * ou bloquer les scripts n'enleve rien. Le filigrane survit a un Ctrl+S, a une
 * capture d'ecran et a une impression.
 *
 * Ce module ne fait que transformer du HTML en HTML. Il n'ouvre aucun fichier et
 * n'a aucune dépendance : la commande personnaliser.js l'utilise aujourd'hui,
 * le backend pourra l'appeler tel quel quand la vente sera branchée.
 */

/** Réglages par intensité. Les écarts sont les marges autour de chaque mention. */
const INTENSITES = {
  discret: { opaciteClair: 0.05, opaciteSombre: 0.07, ecartX: 130, ecartY: 110, taille: 12.5 },
  visible: { opaciteClair: 0.11, opaciteSombre: 0.14, ecartX: 24, ecartY: 38, taille: 13.5 }
};

const ANGLE = -24;

/**
 * Une image de fond en data: ne peut pas charger les polices du guide : elle
 * retombe sur la police système. On garde donc une pile système ici, et on
 * dimensionne la tuile sur une largeur estimée plutôt que mesurée.
 */
const POLICE_TUILE = 'Segoe UI, Roboto, Helvetica, Arial, sans-serif';
const LARGEUR_CARACTERE = 0.58; // part de la taille de police, majorée à dessein
const INK_CLAIR = '#15211D'; // --fg clair
const INK_SOMBRE = '#E4ECE9'; // --fg sombre

/**
 * Valeurs de repli, volontairement factices. Les vraies coordonnées vivent dans
 * marque.json, qui n'est pas suivi par git : voir marque.exemple.json.
 */
const MARQUE_DEFAUT = { nom: 'Fô-Zône', contact: '', whatsapp: '+229 01 00 00 00 00' };

function echapperHtml(valeur) {
  return String(valeur == null ? '' : valeur)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Un numéro WhatsApp en lien wa.me : seuls les chiffres comptent. */
function lienWhatsapp(numero) {
  const chiffres = String(numero || '').replace(/\D/g, '');
  return chiffres ? 'https://wa.me/' + chiffres : null;
}

function nomComplet(acheteur) {
  return [acheteur.prenom, acheteur.nom].filter(Boolean).join(' ').trim();
}

/**
 * Une tuile SVG portant la mention inclinée, répétée ensuite par background-repeat.
 *
 * La tuile porte deux mentions, l'une au quart haut-gauche, l'autre au trois-quarts
 * bas-droit : répétée, la grille apparaît décalée d'une rangée sur l'autre au lieu
 * de s'aligner en colonnes. Elle est dimensionnée sur l'encombrement réel du texte
 * incliné, sans quoi les mentions se coupent au bord de la tuile.
 *
 * Renvoyée en data URI prête pour url(...).
 */
function tuileSvg(mention, reglages, encre) {
  const { ecartX, ecartY, taille } = reglages;

  const radians = (Math.abs(ANGLE) * Math.PI) / 180;
  const largeurTexte = mention.length * taille * LARGEUR_CARACTERE;
  const hauteurTexte = taille * 1.3;

  // Encombrement du texte une fois incliné.
  const largeur = largeurTexte * Math.cos(radians) + hauteurTexte * Math.sin(radians);
  const hauteur = largeurTexte * Math.sin(radians) + hauteurTexte * Math.cos(radians);

  const pasX = Math.round(2 * (largeur + ecartX));
  const pasY = Math.round(2 * (hauteur + ecartY));

  const instance = (x, y) =>
    '<text x="' + x + '" y="' + y + '"' +
    ' text-anchor="middle" dominant-baseline="middle"' +
    ' transform="rotate(' + ANGLE + ' ' + x + ' ' + y + ')"' +
    ' font-family="' + POLICE_TUILE + '"' +
    ' font-size="' + taille + '" font-weight="600"' +
    ' letter-spacing="0.6"' +
    ' fill="' + encre + '">' +
    echapperHtml(mention) +
    '</text>';

  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + pasX + '" height="' + pasY + '">' +
    instance(pasX * 0.25, pasY * 0.25) +
    instance(pasX * 0.75, pasY * 0.75) +
    '</svg>';

  return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
}

function styles(acheteur, reglages) {
  const mention = [nomComplet(acheteur), acheteur.telephone].filter(Boolean).join('  ·  ');
  const tuileClaire = tuileSvg(mention, reglages, INK_CLAIR);
  const tuileSombre = tuileSvg(mention, reglages, INK_SOMBRE);

  return `
<style>
/* ===== Filigrane acheteur — injecté à la génération, sans JavaScript ===== */
:root{
  --fz-wm-tuile:${tuileClaire};
  --fz-wm-opacite:${reglages.opaciteClair};
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --fz-wm-tuile:${tuileSombre};
  --fz-wm-opacite:${reglages.opaciteSombre};
}}
:root[data-theme="dark"]{
  --fz-wm-tuile:${tuileSombre};
  --fz-wm-opacite:${reglages.opaciteSombre};
}

main{position:relative}
main::before{
  content:"";
  position:absolute;
  inset:0;
  z-index:0;
  pointer-events:none;
  background-image:var(--fz-wm-tuile);
  background-repeat:repeat;
  opacity:var(--fz-wm-opacite);
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
}
main > *{position:relative;z-index:1}

/* Bandeau d'ouverture */
.fz-licence{
  display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px;
  margin:20px 0 4px;padding:12px 14px;
  background:var(--accent-soft);border:1px solid var(--line);
  border-radius:var(--r);
  font-size:14px;line-height:1.5;
}
.fz-licence b{font-weight:600}
.fz-licence .fz-ref{
  font-family:var(--f-mono);font-size:12.5px;color:var(--muted);
  font-variant-numeric:tabular-nums;
}

/* Pied de chapitre */
.fz-pied{
  margin-top:34px;padding-top:10px;
  border-top:1px solid var(--line);
  font-family:var(--f-mono);font-size:11.5px;line-height:1.5;
  color:var(--muted);
  display:flex;flex-wrap:wrap;gap:4px 12px;
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
}

/* Bloc de clôture */
.fz-colophon{
  margin-top:56px;padding:20px 18px;
  background:var(--surface);border:1px solid var(--line);
  border-radius:var(--r);font-size:14.5px;line-height:1.6;
}
.fz-colophon h2{
  font-family:var(--f-display);font-size:18px;font-weight:700;
  margin:0 0 10px;letter-spacing:-.01em;
}
.fz-colophon dl{display:grid;grid-template-columns:auto 1fr;gap:4px 16px;margin:0 0 14px}
.fz-colophon dt{color:var(--muted);font-size:13.5px}
.fz-colophon dd{margin:0;font-weight:500}
.fz-colophon .fz-avis{color:var(--muted);font-size:13.5px;margin:0}
.fz-colophon .fz-aide{margin:14px 0 0}

/* À l'impression, la mention reste sur chaque page */
@media print{
  .toc,.toc-mobile{display:none}
  main::before{position:fixed}
  .fz-pied{break-inside:avoid}
}
</style>`;
}

function bandeau(acheteur) {
  const nom = echapperHtml(nomComplet(acheteur));
  const tel = echapperHtml(acheteur.telephone || '');
  const ref = echapperHtml(acheteur.reference || '');

  return (
    '<div class="fz-licence">' +
    '<span>Exemplaire personnel de <b>' + nom + '</b>' + (tel ? ' &middot; ' + tel : '') + '</span>' +
    (ref ? '<span class="fz-ref">licence ' + ref + '</span>' : '') +
    '</div>'
  );
}

function pied(acheteur) {
  const parts = [nomComplet(acheteur), acheteur.telephone, acheteur.reference ? 'licence ' + acheteur.reference : null]
    .filter(Boolean)
    .map(echapperHtml);

  return (
    '\n  <div class="fz-pied">' +
    parts.map((p) => '<span>' + p + '</span>').join('') +
    '<span>exemplaire nominatif, reproduction et revente interdites</span>' +
    '</div>\n'
  );
}

function colophon(acheteur, marque) {
  const nom = echapperHtml(nomComplet(acheteur));
  const tel = echapperHtml(acheteur.telephone || '');
  const ref = echapperHtml(acheteur.reference || '');
  const date = echapperHtml(acheteur.date || '');
  const lien = lienWhatsapp(marque.whatsapp);

  let aide = '';
  if (lien) {
    const aQui = marque.contact
      ? echapperHtml(marque.contact) + ' (' + echapperHtml(marque.nom) + ')'
      : echapperHtml(marque.nom);
    aide =
      '<p class="fz-aide">Une question sur le guide ? Écris à <b>' +
      aQui +
      '</b> sur WhatsApp : <a href="' +
      echapperHtml(lien) +
      '">' +
      echapperHtml(marque.whatsapp) +
      '</a></p>';
  }

  return (
    '\n<section class="fz-colophon" aria-label="Licence de cet exemplaire">' +
    '<h2>Cet exemplaire</h2>' +
    '<dl>' +
    '<dt>Délivré à</dt><dd>' + nom + '</dd>' +
    (tel ? '<dt>Numéro</dt><dd>' + tel + '</dd>' : '') +
    (ref ? '<dt>Licence</dt><dd>' + ref + '</dd>' : '') +
    (date ? '<dt>Date</dt><dd>' + date + '</dd>' : '') +
    '<dt>Éditeur</dt><dd>' + echapperHtml(marque.nom) + '</dd>' +
    (marque.contact ? '<dt>Contact</dt><dd>' + echapperHtml(marque.contact) + '</dd>' : '') +
    '</dl>' +
    '<p class="fz-avis">Ce guide est vendu sous licence individuelle. Il porte le nom ' +
    'et le numéro ci-dessus sur chacune de ses pages. Le partager, le revendre ou le ' +
    'rediffuser, en entier ou par extraits, engage la responsabilité de son titulaire.</p>' +
    aide +
    '</section>\n'
  );
}

/**
 * Applique le filigrane à un exemplaire.
 *
 * @param {string} html      Le guide d'origine, inchangé sur le disque.
 * @param {object} acheteur  { prenom, nom, telephone, reference, date }
 * @param {object} [options] { intensite: 'visible'|'discret', marque: { nom, whatsapp } }
 * @returns {string} Le HTML de l'exemplaire nominatif.
 */
function appliquerFiligrane(html, acheteur, options) {
  const opts = options || {};
  const reglages = INTENSITES[opts.intensite] || INTENSITES.visible;
  const marque = Object.assign({}, MARQUE_DEFAUT, opts.marque || {});

  if (!acheteur || !nomComplet(acheteur)) {
    throw new Error('filigrane : il faut au moins un prénom ou un nom d\'acheteur.');
  }
  if (html.indexOf('class="fz-licence"') !== -1) {
    throw new Error('filigrane : ce fichier porte déjà un filigrane. Repartir du guide d\'origine.');
  }
  if (html.indexOf('</head>') === -1 || html.indexOf('<main>') === -1) {
    throw new Error('filigrane : HTML inattendu, </head> ou <main> introuvable.');
  }

  const marqueur =
    '<meta name="fz-licence" content="' + echapperHtml(acheteur.reference || '') + '">\n' +
    '<meta name="fz-titulaire" content="' + echapperHtml(nomComplet(acheteur)) + '">\n';

  let sortie = html;

  // 1. Styles et marqueurs dans le <head>.
  sortie = sortie.replace('</head>', marqueur + styles(acheteur, reglages) + '\n</head>');

  // 2. Bandeau en tête de contenu.
  sortie = sortie.replace('<main>', '<main>\n' + bandeau(acheteur));

  // 3. Mention au pied de chaque chapitre.
  const piedChapitre = pied(acheteur);
  sortie = sortie.replace(/<\/section>/g, piedChapitre + '</section>');

  // 4. Bloc de clôture avant la fin du contenu.
  sortie = sortie.replace('</main>', colophon(acheteur, marque) + '</main>');

  // 5. Le bandeau d'accueil salue l'acheteur par son prénom.
  sortie = sortie.replace(
    '<span id="accueilNom">toi</span>',
    '<span id="accueilNom">' + echapperHtml(acheteur.prenom || acheteur.nom) + '</span>'
  );

  // 6. La carte d'aide de la barre latérale pointe sur le support de l'éditeur.
  // replace('') insérerait le bloc en tête de fichier : on ne touche à rien
  // si la carte n'est pas trouvée.
  const origine = carteAideOrigine(sortie);
  if (origine) sortie = sortie.replace(origine, carteAide(marque));

  return sortie;
}

/** La carte d'aide telle qu'elle est dans le guide, pour la remplacer en bloc. */
function carteAideOrigine(html) {
  const debut = html.indexOf('<div class="aide" id="aideCarte">');
  if (debut === -1) return '';

  const fin = html.indexOf('</div>', debut);
  return fin === -1 ? '' : html.slice(debut, fin + '</div>'.length);
}

/** Sans coordonnées connues, on garde la carte d'origine. */
function carteAide(marque) {
  const lien = lienWhatsapp(marque.whatsapp);
  if (!lien) return carteAideOrigineDefaut();

  return '<div class="aide" id="aideCarte">' +
    '<b>Besoin d\'aide ?</b>' +
    '<p>Une question sur une étape, un blocage que le chapitre 14 ne couvre pas ? ' +
    'Écris directement à ' + echapperHtml(marque.contact || marque.nom) + '.</p>' +
    '<a href="' + echapperHtml(lien) + '">Écrire sur WhatsApp</a>' +
    '</div>';
}

function carteAideOrigineDefaut() {
  return '<div class="aide" id="aideCarte">' +
    '<b>Bloqué quelque part ?</b>' +
    '<p>Le chapitre 14 rassemble les pannes réellement rencontrées et la façon ' +
    'de les décrire à Claude pour qu\'il les corrige.</p>' +
    '<a href="#c14">Aller au dépannage</a>' +
    '</div>';
}

module.exports = { appliquerFiligrane, INTENSITES };
