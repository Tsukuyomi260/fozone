/**
 * Service du guide « Lancer sa Wi-Fi Zone ».
 *
 * Chaque acheteur a son exemplaire, marque a son nom, range dans un bucket
 * Supabase prive. Le fichier n'est jamais joignable directement: il passe par
 * ici, qui verifie le jeton avant de le rendre.
 *
 * Les exemplaires sont fabriques et deposes par ebook/filigrane/publier.js.
 */

const { supabaseAdmin } = require('../config/database');
const logger = require('../config/logger');

const BUCKET_DEFAUT = 'guides';

/**
 * Le guide charge ses polices chez Google et porte ses styles et son script en
 * ligne. La CSP par defaut de helmet bloquerait tout cela, et l'acheteur
 * verrait une page nue. On la remplace, pour cette reponse seulement, par une
 * politique qui autorise exactement ce dont le guide a besoin et rien de plus:
 * aucune image, aucun cadre, aucun appel reseau sortant.
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

function pageMessage(titre, message) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titre}</title>
<style>
  :root{color-scheme:light dark}
  body{margin:0;min-height:100vh;display:grid;place-items:center;
       background:#F5F7F6;color:#15211D;
       font:16px/1.6 "Segoe UI",system-ui,sans-serif;padding:24px}
  .carte{max-width:30rem;background:#fff;border:1px solid #D3DCD8;border-radius:10px;padding:28px}
  h1{font-size:20px;margin:0 0 10px}
  p{margin:0;color:#55655F}
  @media (prefers-color-scheme:dark){
    body{background:#0E1513;color:#E4ECE9}
    .carte{background:#151F1C;border-color:#2A3A35}
    p{color:#97A9A2}
  }
</style>
</head>
<body><div class="carte"><h1>${titre}</h1><p>${message}</p></div></body>
</html>`;
}

function repondreMessage(res, statut, titre, message) {
  res.status(statut);
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'no-store');
  res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
  return res.send(pageMessage(titre, message));
}

/** Le bucket est le premier segment du chemin enregistre. */
function decouperChemin(cheminComplet) {
  const morceaux = String(cheminComplet || '').split('/');
  if (morceaux.length < 2) {
    return { bucket: BUCKET_DEFAUT, chemin: morceaux.join('/') };
  }
  return { bucket: morceaux[0], chemin: morceaux.slice(1).join('/') };
}

/**
 * Compte l'ouverture sans faire attendre le lecteur. Un echec ici n'est pas
 * une raison de lui refuser son guide: on journalise et on passe.
 */
function noterOuverture(licence, ip) {
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
      if (error) {
        logger.warn('ebook: ouverture non comptee', { licence: licence.id, error: error.message });
      }
    });
}

/**
 * GET /guide/:jeton
 * Ouvert a tous: le jeton est la seule preuve demandee.
 */
async function servirGuide(req, res) {
  const jeton = String(req.params.jeton || '').trim();

  // Le jeton est produit par nous: 32 octets en hexadecimal, rien d'autre.
  if (!/^[a-f0-9]{32,128}$/.test(jeton)) {
    return repondreMessage(
      res, 404, 'Lien introuvable',
      'Ce lien n\'est pas valide. Verifie que tu l\'as copie en entier.'
    );
  }

  const { data: licence, error } = await supabaseAdmin
    .from('ebook_licences')
    .select('id, nom, prenom, reference, chemin_storage, revoquee, expire_le, ouvertures, premiere_ouverture')
    .eq('jeton', jeton)
    .maybeSingle();

  if (error) {
    logger.error('ebook: lecture de la licence impossible', { error: error.message });
    return repondreMessage(
      res, 500, 'Service indisponible',
      'Impossible d\'ouvrir le guide pour le moment. Reessaie dans un instant.'
    );
  }

  if (!licence) {
    return repondreMessage(
      res, 404, 'Lien introuvable',
      'Ce lien ne correspond a aucun exemplaire. Contacte le vendeur pour en obtenir un nouveau.'
    );
  }

  if (licence.revoquee) {
    return repondreMessage(
      res, 410, 'Acces revoque',
      'Cet exemplaire a ete desactive. Contacte le vendeur si tu penses qu\'il s\'agit d\'une erreur.'
    );
  }

  if (licence.expire_le && new Date(licence.expire_le) < new Date()) {
    return repondreMessage(
      res, 410, 'Acces expire',
      'La validite de cet exemplaire est arrivee a son terme. Contacte le vendeur pour la prolonger.'
    );
  }

  const { bucket, chemin } = decouperChemin(licence.chemin_storage);
  const telechargement = await supabaseAdmin.storage.from(bucket).download(chemin);

  if (telechargement.error || !telechargement.data) {
    logger.error('ebook: exemplaire absent du stockage', {
      licence: licence.id,
      chemin: licence.chemin_storage,
      error: telechargement.error ? telechargement.error.message : 'fichier vide'
    });
    return repondreMessage(
      res, 500, 'Exemplaire introuvable',
      'Ton acces est valide mais le fichier est inaccessible. Signale-le au vendeur.'
    );
  }

  const html = Buffer.from(await telechargement.data.arrayBuffer());

  noterOuverture(licence, req.ip);

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Content-Security-Policy', CSP_GUIDE);
  // Nominatif: ni cache partage, ni archivage par les moteurs.
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.set('Referrer-Policy', 'no-referrer');

  return res.send(html);
}

module.exports = { servirGuide };
