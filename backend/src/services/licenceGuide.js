/**
 * Fabrication d'un acces au guide.
 *
 * Une seule piece, appelee par deux chemins : le formulaire de l'espace
 * super-admin, et le webhook Chariow qui recoit les ventes. Ce qui s'y passe
 * est delicat - marquer, deposer, enregistrer, et ne rien laisser d'orphelin
 * si une etape echoue - donc cela ne doit exister qu'une fois.
 *
 * Le guide de reference ne vient pas du disque mais du bucket, a
 * `_master/guide.html` : le serveur n'a donc besoin d'aucun fichier local, ce
 * qui le rend indifferent a la facon dont Render decoupe le depot. La commande
 * `node filigrane/publier.js --publier-guide` y depose la version courante.
 */

const crypto = require('crypto');
const { supabaseAdmin } = require('../config/database');
const logger = require('../config/logger');
const { appliquerFiligrane } = require('./filigrane');

const BUCKET = 'guides';
const CHEMIN_MAITRE = '_master/guide.html';
const PREFIXE_REFERENCE = 'NZ';
const PROVENANCES = ['chariow', 'whatsapp', 'especes', 'offert', 'autre'];

const CHAMPS =
  'id, reference, prenom, nom, telephone, email, pays, montant, devise, provenance, note, ' +
  'jeton, chemin_storage, revoquee, expire_le, ouvertures, derniere_ouverture, ' +
  'max_appareils, mot_de_passe_hash, cree_le';

/** Coordonnees de l'editeur, imprimees dans le bloc de cloture. */
function marque() {
  return {
    nom: process.env.EBOOK_EDITEUR_NOM || process.env.EBOOK_SUPPORT_NOM || 'NET ZONE',
    contact: process.env.EBOOK_EDITEUR_CONTACT || '',
    whatsapp: process.env.EBOOK_SUPPORT_WHATSAPP || ''
  };
}

function racineDuLien() {
  const base = process.env.EBOOK_LIEN_BASE || process.env.API_BASE_URL || '';
  return String(base).replace(/\/+$/, '');
}

function lienDe(jeton) {
  const racine = racineDuLien();
  return racine ? racine + '/guide/' + jeton : null;
}

/** Le guide de reference, tel que depose par --publier-guide. */
async function lireGuideMaitre() {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(CHEMIN_MAITRE);
  if (!data) {
    throw new Error(
      'Le guide de référence est absent du stockage' +
      (error ? ' (' + error.message + ')' : '') +
      '. Lance « node filigrane/publier.js --publier-guide ».'
    );
  }
  return Buffer.from(await data.arrayBuffer()).toString('utf8');
}

/** NZ-0019 apres NZ-0018. Les references non numerotees sont ignorees. */
async function prochaineReference() {
  const { data, error } = await supabaseAdmin
    .from('ebook_licences')
    .select('reference')
    .like('reference', PREFIXE_REFERENCE + '-%');

  if (error) throw new Error('Références illisibles : ' + error.message);

  let max = 0;
  for (const ligne of data || []) {
    const trouve = /^[A-Z]+-(\d+)$/.exec(ligne.reference || '');
    if (trouve) max = Math.max(max, parseInt(trouve[1], 10));
  }
  return PREFIXE_REFERENCE + '-' + String(max + 1).padStart(4, '0');
}

function nomDeFichier(valeur) {
  return String(valeur)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function dateDuJour() {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    .format(new Date());
}

/** Ce que l'interface affiche : jamais le jeton brut sans le lien complet. */
function versReponse(licence, appareils) {
  return {
    id: licence.id,
    reference: licence.reference,
    prenom: licence.prenom,
    nom: licence.nom,
    telephone: licence.telephone,
    email: licence.email,
    pays: licence.pays,
    montant: licence.montant,
    devise: licence.devise,
    provenance: licence.provenance,
    note: licence.note,
    lien: lienDe(licence.jeton),
    revoquee: licence.revoquee,
    expire_le: licence.expire_le,
    ouvertures: licence.ouvertures,
    derniere_ouverture: licence.derniere_ouverture,
    max_appareils: licence.max_appareils,
    appareils: appareils || 0,
    mot_de_passe_pose: Boolean(licence.mot_de_passe_hash),
    cree_le: licence.cree_le
  };
}

/** Marque un exemplaire au nom de l'acheteur, a partir du guide de reference. */
async function fabriquerExemplaire(acheteur) {
  return appliquerFiligrane(
    await lireGuideMaitre(),
    {
      prenom: acheteur.prenom || '',
      nom: acheteur.nom || '',
      telephone: acheteur.telephone || '',
      reference: acheteur.reference || '',
      date: acheteur.date || dateDuJour()
    },
    { intensite: 'visible', marque: marque() }
  );
}

/**
 * Cree un acces complet : reference, exemplaire marque, depot, licence.
 *
 * Si l'enregistrement echoue apres le depot, le fichier est retire : on ne
 * laisse jamais un orphelin dans le bucket.
 *
 * @param {object} acheteur  prenom, nom, telephone, email, pays
 * @param {object} vente     montant, devise, provenance, note, max_appareils,
 *                           chariow_sale_id, chariow_delivery_id
 * @returns {Promise<object>} la licence, telle que l'interface l'attend
 */
async function creerAcces(acheteur, vente) {
  const details = vente || {};
  const reference = await prochaineReference();

  const html = await fabriquerExemplaire({ ...acheteur, reference });

  const chemin = nomDeFichier(reference) + '-' + crypto.randomBytes(16).toString('hex') + '.html';
  const envoi = await supabaseAdmin.storage.from(BUCKET).upload(chemin, Buffer.from(html, 'utf8'), {
    contentType: 'text/html; charset=utf-8',
    upsert: false
  });

  if (envoi.error) {
    throw new Error("L'exemplaire n'a pas pu être déposé : " + envoi.error.message);
  }

  const jeton = crypto.randomBytes(16).toString('hex');
  const { data: licence, error } = await supabaseAdmin
    .from('ebook_licences')
    .insert({
      reference,
      prenom: acheteur.prenom || null,
      nom: acheteur.nom || acheteur.prenom,
      telephone: acheteur.telephone || null,
      email: acheteur.email || null,
      pays: acheteur.pays || null,
      montant: details.montant == null ? null : details.montant,
      devise: details.devise || 'XOF',
      provenance: details.provenance || null,
      note: details.note || null,
      max_appareils: details.max_appareils || 2,
      chariow_sale_id: details.chariow_sale_id || null,
      chariow_delivery_id: details.chariow_delivery_id || null,
      jeton,
      chemin_storage: BUCKET + '/' + chemin
    })
    .select(CHAMPS)
    .single();

  if (error) {
    await supabaseAdmin.storage.from(BUCKET).remove([chemin]);
    throw new Error("L'accès n'a pas pu être enregistré : " + error.message);
  }

  logger.info('guide: acces cree', { reference, provenance: details.provenance || 'manuel' });

  return versReponse(licence, 0);
}

/**
 * Remplace le fichier d'une licence par la version actuelle du guide.
 * Le lien, le mot de passe et les appareils ne bougent pas.
 */
async function regenererExemplaire(licence) {
  const html = await fabriquerExemplaire(licence);

  const morceaux = String(licence.chemin_storage).split('/');
  const bucket = morceaux.shift();
  const chemin = morceaux.join('/');

  const envoi = await supabaseAdmin.storage.from(bucket).upload(chemin, Buffer.from(html, 'utf8'), {
    contentType: 'text/html; charset=utf-8',
    upsert: true
  });

  if (envoi.error) {
    throw new Error("Le fichier n'a pas pu être remplacé : " + envoi.error.message);
  }
}

module.exports = {
  BUCKET,
  CHAMPS,
  PROVENANCES,
  marque,
  lienDe,
  versReponse,
  prochaineReference,
  creerAcces,
  regenererExemplaire,
  dateDuJour
};
