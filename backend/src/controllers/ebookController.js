/**
 * Service du guide « Lancer sa Wi-Fi Zone ».
 *
 * Chaque acheteur a son exemplaire, marque a son nom, range dans un bucket
 * Supabase prive. Le fichier n'est jamais joignable directement: il passe par
 * ici.
 *
 * Deux serrures, qui ne servent pas a la meme chose :
 *   - le mot de passe, choisi par l'acheteur a sa premiere ouverture, rend le
 *     lien seul inutilisable ;
 *   - l'appareil, retenu par un cookie httpOnly, plafonne le nombre de postes
 *     qui peuvent lire l'exemplaire.
 *
 * Donner son lien ne sert a rien sans le mot de passe. Donner les deux coute
 * a l'acheteur une de ses propres places. Quand le plafond est atteint, seul
 * l'editeur peut liberer une place.
 *
 * Les exemplaires sont fabriques et deposes par ebook/filigrane/publier.js.
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('../config/database');
const logger = require('../config/logger');

const BUCKET_DEFAUT = 'guides';
const COOKIE = 'fz_guide';
const COOKIE_DUREE_MS = 2 * 365 * 24 * 60 * 60 * 1000;
const LONGUEUR_MOT_DE_PASSE_MIN = 6;
const TOURS_BCRYPT = 10;

/**
 * Le guide charge ses polices chez Google et porte ses styles et son script en
 * ligne. La CSP par defaut de helmet bloquerait tout cela, et l'acheteur
 * verrait une page nue. On la remplace, pour cette reponse seulement, par une
 * politique qui autorise exactement ce dont le guide a besoin et rien de plus.
 */
const CSP_GUIDE = [
  "default-src 'none'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "script-src 'unsafe-inline'",
  "img-src 'self' data:",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join('; ');

const CSP_PAGE = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

function echapper(valeur) {
  return String(valeur == null ? '' : valeur)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const STYLE_PAGE = `
  :root{color-scheme:light dark}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;
       background:#F5F7F6;color:#15211D;
       font:16px/1.6 "Segoe UI",system-ui,sans-serif;padding:24px}
  .carte{width:100%;max-width:26rem;background:#fff;border:1px solid #D3DCD8;
         border-radius:10px;padding:28px}
  h1{font-size:20px;margin:0 0 8px;letter-spacing:-.01em}
  p{margin:0 0 18px;color:#55655F;font-size:15px}
  label{display:block;font-size:14px;font-weight:600;margin:0 0 6px}
  input{width:100%;font:inherit;padding:11px 12px;margin:0 0 14px;
        border:1px solid #D3DCD8;border-radius:8px;background:#F5F7F6;color:inherit}
  input:focus{outline:2px solid #E3A23B;outline-offset:1px}
  button{width:100%;font:inherit;font-weight:600;padding:12px;border:0;
         border-radius:8px;background:#126B57;color:#fff;cursor:pointer}
  .alerte{background:#F8E3DA;color:#B4441F;border-radius:8px;padding:10px 12px;
          font-size:14px;margin:0 0 16px}
  .pied{margin:16px 0 0;font-size:13px;color:#55655F}
  a{color:#126B57}
  @media (prefers-color-scheme:dark){
    body{background:#0E1513;color:#E4ECE9}
    .carte{background:#151F1C;border-color:#2A3A35}
    p,.pied{color:#97A9A2}
    input{background:#0E1513;border-color:#2A3A35}
    button{background:#4CC2A0;color:#06231B}
    .alerte{background:#3B1F16;color:#F0896A}
    a{color:#4CC2A0}
  }`;

function enveloppe(titre, corps) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${echapper(titre)}</title>
<style>${STYLE_PAGE}</style>
</head>
<body><div class="carte">${corps}</div></body>
</html>`;
}

function enTetesPage(res) {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'no-store');
  res.set('Content-Security-Policy', CSP_PAGE);
  res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.set('Referrer-Policy', 'no-referrer');
}

function repondreMessage(res, statut, titre, message, pied) {
  enTetesPage(res);
  return res.status(statut).send(
    enveloppe(titre,
      `<h1>${echapper(titre)}</h1><p>${message}</p>` +
      (pied ? `<p class="pied">${pied}</p>` : '')
    )
  );
}

/** Formulaire de creation du mot de passe, a la toute premiere ouverture. */
function pageCreation(res, licence, erreur) {
  enTetesPage(res);
  const nom = echapper([licence.prenom, licence.nom].filter(Boolean).join(' '));

  return res.status(erreur ? 400 : 200).send(enveloppe('Protege ton acces', `
    <h1>Bienvenue ${nom}</h1>
    <p>Cet exemplaire du guide t'appartient. Choisis un mot de passe : il te
       servira a l'ouvrir sur tes appareils, et empeche quiconque recevrait ton
       lien de s'en servir.</p>
    ${erreur ? `<div class="alerte">${echapper(erreur)}</div>` : ''}
    <form method="post" autocomplete="off">
      <label for="mdp">Ton mot de passe</label>
      <input id="mdp" name="motdepasse" type="password" required
             minlength="${LONGUEUR_MOT_DE_PASSE_MIN}" autocomplete="new-password">
      <label for="mdp2">Repete-le</label>
      <input id="mdp2" name="confirmation" type="password" required
             minlength="${LONGUEUR_MOT_DE_PASSE_MIN}" autocomplete="new-password">
      <button type="submit">Ouvrir mon guide</button>
    </form>
    <p class="pied">${LONGUEUR_MOT_DE_PASSE_MIN} caracteres minimum.
       Note-le : il ne pourra pas etre retrouve, seulement remis a zero par l'editeur.</p>
  `));
}

/** Formulaire d'ouverture, pour un appareil que l'on ne connait pas encore. */
function pageOuverture(res, licence, erreur, places) {
  enTetesPage(res);

  return res.status(erreur ? 401 : 200).send(enveloppe('Ouvrir le guide', `
    <h1>Ton mot de passe</h1>
    <p>Cet appareil n'est pas encore enregistre. Entre le mot de passe que tu as
       choisi la premiere fois.</p>
    ${erreur ? `<div class="alerte">${echapper(erreur)}</div>` : ''}
    <form method="post" autocomplete="off">
      <label for="mdp">Mot de passe</label>
      <input id="mdp" name="motdepasse" type="password" required autocomplete="current-password">
      <button type="submit">Ouvrir</button>
    </form>
    <p class="pied">Il te reste ${places} place${places > 1 ? 's' : ''} sur ${licence.max_appareils} appareils.</p>
  `));
}

function pagePlafond(res, licence) {
  enTetesPage(res);
  const support = lienSupport();

  return res.status(403).send(enveloppe('Limite d\'appareils atteinte', `
    <h1>Limite atteinte</h1>
    <p>Cet exemplaire est deja ouvert sur ${licence.max_appareils} appareils,
       le maximum prevu. Ouvre-le depuis l'un d'eux, ou demande qu'une place
       soit liberee.</p>
    ${support ? `<p><a href="${echapper(support.lien)}">Ecrire a ${echapper(support.nom)} sur WhatsApp</a></p>` : ''}
    <p class="pied">Licence ${echapper(licence.reference || '')}</p>
  `));
}

/** Coordonnees du support, pour la page de plafond. Facultatif. */
function lienSupport() {
  const numero = process.env.EBOOK_SUPPORT_WHATSAPP;
  if (!numero) return null;

  const chiffres = String(numero).replace(/\D/g, '');
  if (!chiffres) return null;

  return { nom: process.env.EBOOK_SUPPORT_NOM || 'l\'editeur', lien: 'https://wa.me/' + chiffres };
}

// ---------------------------------------------------------------------------
// Appareils
// ---------------------------------------------------------------------------

function empreinte(valeur) {
  return crypto.createHash('sha256').update(String(valeur)).digest('hex');
}

/** Lit un cookie sans dependance supplementaire. */
function lireCookie(req, nom) {
  const brut = req.headers.cookie;
  if (!brut) return null;

  for (const morceau of brut.split(';')) {
    const coupure = morceau.indexOf('=');
    if (coupure < 1) continue;
    if (morceau.slice(0, coupure).trim() !== nom) continue;

    try {
      return decodeURIComponent(morceau.slice(coupure + 1).trim());
    } catch (erreur) {
      return null;
    }
  }
  return null;
}

function poserCookie(res, valeur) {
  res.cookie(COOKIE, valeur, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_DUREE_MS,
    path: '/guide'
  });
}

/** Une etiquette lisible, pour que l'editeur sache quelle place il libere. */
function etiquetteAppareil(userAgent) {
  const ua = String(userAgent || '');

  const systeme =
    /Android/i.test(ua) ? 'Android' :
    /iPhone|iPad|iPod/i.test(ua) ? 'iOS' :
    /Windows/i.test(ua) ? 'Windows' :
    /Mac OS X/i.test(ua) ? 'macOS' :
    /Linux/i.test(ua) ? 'Linux' : 'Inconnu';

  const navigateur =
    /Edg\//i.test(ua) ? 'Edge' :
    /OPR\/|Opera/i.test(ua) ? 'Opera' :
    /Chrome\//i.test(ua) ? 'Chrome' :
    /Firefox\//i.test(ua) ? 'Firefox' :
    /Safari\//i.test(ua) ? 'Safari' : 'Navigateur';

  return (systeme + ' · ' + navigateur).slice(0, 120);
}

async function appareilsActifs(licenceId) {
  const { data, error } = await supabaseAdmin
    .from('ebook_appareils')
    .select('id, jeton_hash')
    .eq('licence_id', licenceId)
    .eq('libere', false);

  if (error) throw new Error('appareils illisibles : ' + error.message);
  return data || [];
}

/**
 * Compte l'ouverture sans faire attendre le lecteur. Un echec ici n'est pas
 * une raison de lui refuser son guide: on journalise et on passe.
 */
function noterOuverture(licence, appareilId, ip) {
  const maintenant = new Date().toISOString();

  supabaseAdmin
    .from('ebook_licences')
    .update({
      ouvertures: (licence.ouvertures || 0) + 1,
      premiere_ouverture: licence.premiere_ouverture || maintenant,
      derniere_ouverture: maintenant,
      derniere_ip: ip ? String(ip).slice(0, 64) : null
    })
    .eq('id', licence.id)
    .then(({ error }) => {
      if (error) logger.warn('ebook: ouverture non comptee', { licence: licence.id, error: error.message });
    });

  if (!appareilId) return;

  supabaseAdmin
    .from('ebook_appareils')
    .update({ derniere_vue: maintenant, derniere_ip: ip ? String(ip).slice(0, 64) : null })
    .eq('id', appareilId)
    .then(({ error }) => {
      if (error) logger.warn('ebook: appareil non mis a jour', { appareil: appareilId, error: error.message });
    });
}

// ---------------------------------------------------------------------------
// Lecture de la licence et du fichier
// ---------------------------------------------------------------------------

const CHAMPS_LICENCE =
  'id, nom, prenom, reference, chemin_storage, revoquee, expire_le, ouvertures, ' +
  'premiere_ouverture, mot_de_passe_hash, max_appareils';

/**
 * Charge la licence et refuse tout de suite ce qui doit l'etre.
 * Renvoie { licence } ou { reponse: true } si la reponse est deja envoyee.
 */
async function chargerLicence(req, res) {
  const jeton = String(req.params.jeton || '').trim();

  // Le jeton est produit par nous: 32 octets en hexadecimal, rien d'autre.
  if (!/^[a-f0-9]{32,128}$/.test(jeton)) {
    repondreMessage(res, 404, 'Lien introuvable',
      'Ce lien n\'est pas valide. Verifie que tu l\'as copie en entier.');
    return { reponse: true };
  }

  const { data: licence, error } = await supabaseAdmin
    .from('ebook_licences')
    .select(CHAMPS_LICENCE)
    .eq('jeton', jeton)
    .maybeSingle();

  if (error) {
    logger.error('ebook: lecture de la licence impossible', { error: error.message });
    repondreMessage(res, 500, 'Service indisponible',
      'Impossible d\'ouvrir le guide pour le moment. Reessaie dans un instant.');
    return { reponse: true };
  }

  if (!licence) {
    repondreMessage(res, 404, 'Lien introuvable',
      'Ce lien ne correspond a aucun exemplaire. Contacte le vendeur pour en obtenir un nouveau.');
    return { reponse: true };
  }

  if (licence.revoquee) {
    repondreMessage(res, 410, 'Acces revoque',
      'Cet exemplaire a ete desactive. Contacte le vendeur si tu penses qu\'il s\'agit d\'une erreur.');
    return { reponse: true };
  }

  if (licence.expire_le && new Date(licence.expire_le) < new Date()) {
    repondreMessage(res, 410, 'Acces expire',
      'La validite de cet exemplaire est arrivee a son terme. Contacte le vendeur pour la prolonger.');
    return { reponse: true };
  }

  return { licence };
}

/** Le bucket est le premier segment du chemin enregistre. */
function decouperChemin(cheminComplet) {
  const morceaux = String(cheminComplet || '').split('/');
  if (morceaux.length < 2) return { bucket: BUCKET_DEFAUT, chemin: morceaux.join('/') };
  return { bucket: morceaux[0], chemin: morceaux.slice(1).join('/') };
}

async function envoyerGuide(req, res, licence, appareilId) {
  const { bucket, chemin } = decouperChemin(licence.chemin_storage);
  const telechargement = await supabaseAdmin.storage.from(bucket).download(chemin);

  if (telechargement.error || !telechargement.data) {
    logger.error('ebook: exemplaire absent du stockage', {
      licence: licence.id,
      chemin: licence.chemin_storage,
      error: telechargement.error ? telechargement.error.message : 'fichier vide'
    });
    return repondreMessage(res, 500, 'Exemplaire introuvable',
      'Ton acces est valide mais le fichier est inaccessible. Signale-le au vendeur.');
  }

  const html = Buffer.from(await telechargement.data.arrayBuffer());

  noterOuverture(licence, appareilId, req.ip);

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Content-Security-Policy', CSP_GUIDE);
  // Nominatif: ni cache partage, ni archivage par les moteurs.
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.set('Referrer-Policy', 'no-referrer');

  return res.send(html);
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /guide/:jeton
 * Sert le guide si l'appareil est connu, sinon demande le mot de passe.
 */
async function servirGuide(req, res) {
  const { licence, reponse } = await chargerLicence(req, res);
  if (reponse) return undefined;

  // Premiere ouverture de la vie de cet exemplaire : on fait choisir le mot de passe.
  if (!licence.mot_de_passe_hash) return pageCreation(res, licence, null);

  const jetonAppareil = lireCookie(req, COOKIE);
  if (jetonAppareil) {
    const { data: appareil } = await supabaseAdmin
      .from('ebook_appareils')
      .select('id')
      .eq('licence_id', licence.id)
      .eq('jeton_hash', empreinte(jetonAppareil))
      .eq('libere', false)
      .maybeSingle();

    if (appareil) return envoyerGuide(req, res, licence, appareil.id);
  }

  const places = licence.max_appareils - (await appareilsActifs(licence.id)).length;
  if (places <= 0) return pagePlafond(res, licence);

  return pageOuverture(res, licence, null, places);
}

/**
 * POST /guide/:jeton
 * Cree le mot de passe a la premiere ouverture, ou enregistre un appareil.
 */
async function ouvrirGuide(req, res) {
  const { licence, reponse } = await chargerLicence(req, res);
  if (reponse) return undefined;

  const motDePasse = String((req.body && req.body.motdepasse) || '');

  // --- Premiere ouverture : creation du mot de passe -----------------------
  if (!licence.mot_de_passe_hash) {
    const confirmation = String((req.body && req.body.confirmation) || '');

    if (motDePasse.length < LONGUEUR_MOT_DE_PASSE_MIN) {
      return pageCreation(res, licence,
        'Le mot de passe doit faire au moins ' + LONGUEUR_MOT_DE_PASSE_MIN + ' caracteres.');
    }
    if (motDePasse !== confirmation) {
      return pageCreation(res, licence, 'Les deux mots de passe ne sont pas identiques.');
    }

    const hash = await bcrypt.hash(motDePasse, TOURS_BCRYPT);

    // Condition sur mot_de_passe_hash : deux ouvertures simultanees ne peuvent
    // pas definir deux mots de passe differents, la seconde ne touche rien.
    const { data: pose, error } = await supabaseAdmin
      .from('ebook_licences')
      .update({ mot_de_passe_hash: hash, mot_de_passe_defini_le: new Date().toISOString() })
      .eq('id', licence.id)
      .is('mot_de_passe_hash', null)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('ebook: mot de passe non enregistre', { licence: licence.id, error: error.message });
      return repondreMessage(res, 500, 'Service indisponible',
        'Ton mot de passe n\'a pas pu etre enregistre. Reessaie dans un instant.');
    }

    if (!pose) {
      // Quelqu'un a defini le mot de passe entre-temps : on redemande.
      return pageOuverture(res, licence, 'Ce mot de passe a deja ete defini. Entre-le pour continuer.',
        licence.max_appareils);
    }

    licence.mot_de_passe_hash = hash;
    return enregistrerAppareil(req, res, licence);
  }

  // --- Ouvertures suivantes : verification ---------------------------------
  const bon = await bcrypt.compare(motDePasse, licence.mot_de_passe_hash);

  if (!bon) {
    logger.warn('ebook: mot de passe refuse', { licence: licence.id, ip: req.ip });
    const places = licence.max_appareils - (await appareilsActifs(licence.id)).length;
    return pageOuverture(res, licence, 'Mot de passe incorrect.', Math.max(places, 0));
  }

  return enregistrerAppareil(req, res, licence);
}

/** Pose le cookie, retient l'appareil, et sert le guide. */
async function enregistrerAppareil(req, res, licence) {
  const actifs = await appareilsActifs(licence.id);

  // Cet appareil est peut-etre deja connu : le mot de passe a ete resaisi
  // sans que le cookie ait disparu. On ne consomme pas une place de plus.
  const jetonExistant = lireCookie(req, COOKIE);
  if (jetonExistant) {
    const connu = actifs.find((a) => a.jeton_hash === empreinte(jetonExistant));
    if (connu) return envoyerGuide(req, res, licence, connu.id);
  }

  if (actifs.length >= licence.max_appareils) return pagePlafond(res, licence);

  const jetonAppareil = crypto.randomBytes(32).toString('hex');
  const { data: appareil, error } = await supabaseAdmin
    .from('ebook_appareils')
    .insert({
      licence_id: licence.id,
      jeton_hash: empreinte(jetonAppareil),
      etiquette: etiquetteAppareil(req.get('user-agent')),
      derniere_ip: req.ip ? String(req.ip).slice(0, 64) : null
    })
    .select('id')
    .single();

  if (error) {
    logger.error('ebook: appareil non enregistre', { licence: licence.id, error: error.message });
    return repondreMessage(res, 500, 'Service indisponible',
      'Ton appareil n\'a pas pu etre enregistre. Reessaie dans un instant.');
  }

  poserCookie(res, jetonAppareil);
  logger.info('ebook: appareil enregistre', {
    licence: licence.id,
    reference: licence.reference,
    place: actifs.length + 1,
    sur: licence.max_appareils
  });

  return envoyerGuide(req, res, licence, appareil.id);
}

module.exports = { servirGuide, ouvrirGuide };
