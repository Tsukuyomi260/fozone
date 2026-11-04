/**
 * Generation et suivi des acces au guide, depuis l'espace super-admin.
 *
 * Ce que faisait le terminal (ebook/filigrane/publier.js) se fait ici : on
 * marque un exemplaire au nom de l'acheteur, on le depose dans le bucket
 * prive, on enregistre la licence, et on rend le lien a coller dans WhatsApp.
 *
 * Le guide de reference ne vient pas du disque mais du bucket, a
 * `_master/guide.html` : le serveur n'a donc besoin d'aucun fichier local, ce
 * qui le rend indifferent a la facon dont Render decoupe le depot. La commande
 * `node filigrane/publier.js --publier-guide` y depose la version courante.
 */

const crypto = require('crypto');
const { supabaseAdmin } = require('../config/database');
const logger = require('../config/logger');
const { appliquerFiligrane } = require('../services/filigrane');
const { listePays, verifierTelephone, DEFAUT } = require('../config/paysTelephone');

const BUCKET = 'guides';
const CHEMIN_MAITRE = '_master/guide.html';
const PREFIXE_REFERENCE = 'NZ';
const PROVENANCES = ['chariow', 'whatsapp', 'especes', 'offert', 'autre'];

const CHAMPS =
  'id, reference, prenom, nom, telephone, pays, montant, devise, provenance, note, ' +
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
  if (error || !data) {
    throw new Error(
      'Le guide de référence est absent du stockage. Lance « node filigrane/publier.js --publier-guide ».'
    );
  }
  return Buffer.from(await data.arrayBuffer()).toString('utf8');
}

/** NZ-0007 apres NZ-0006. Les references non numerotees sont ignorees. */
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

/** Ce que l'interface affiche : jamais le jeton brut sans le lien complet. */
function versReponse(licence, appareils) {
  return {
    id: licence.id,
    reference: licence.reference,
    prenom: licence.prenom,
    nom: licence.nom,
    telephone: licence.telephone,
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

// ---------------------------------------------------------------------------

/** GET /api/ebook/licences */
async function listerLicences(req, res) {
  const { data, error } = await supabaseAdmin
    .from('ebook_licences')
    .select(CHAMPS)
    .order('cree_le', { ascending: false });

  if (error) {
    logger.error('ebook admin: lecture impossible', { error: error.message });
    return res.status(500).json({ message: 'Impossible de charger les accès' });
  }

  const { data: appareils } = await supabaseAdmin
    .from('ebook_appareils')
    .select('licence_id')
    .eq('libere', false);

  const parLicence = new Map();
  for (const a of appareils || []) {
    parLicence.set(a.licence_id, (parLicence.get(a.licence_id) || 0) + 1);
  }

  const licences = (data || []).map((l) => versReponse(l, parLicence.get(l.id)));

  const vendus = licences.filter((l) => l.montant > 0);
  const parCanal = {};
  for (const l of vendus) {
    const canal = l.provenance || 'autre';
    parCanal[canal] = (parCanal[canal] || 0) + (l.montant || 0);
  }

  return res.json({
    licences,
    pays: listePays(),
    provenances: PROVENANCES,
    resume: {
      total: licences.length,
      actives: licences.filter((l) => !l.revoquee).length,
      jamais_ouvertes: licences.filter((l) => !l.mot_de_passe_pose && !l.revoquee).length,
      revoquees: licences.filter((l) => l.revoquee).length,
      chiffre: vendus.reduce((somme, l) => somme + (l.montant || 0), 0),
      par_canal: parCanal
    }
  });
}

/** POST /api/ebook/licences */
async function creerLicence(req, res) {
  const corps = req.body || {};
  const prenom = String(corps.prenom || '').trim();
  const nom = String(corps.nom || '').trim();

  if (!prenom && !nom) {
    return res.status(400).json({ message: 'Il faut au moins un prénom ou un nom.' });
  }

  const pays = String(corps.pays || DEFAUT).trim().toUpperCase();
  let telephone = '';

  if (corps.telephone) {
    const verifie = verifierTelephone(corps.telephone, pays);
    if (!verifie.ok) return res.status(400).json({ message: verifie.message });
    telephone = verifie.affichage;
  }

  const montant = corps.montant === '' || corps.montant == null ? null : Number(corps.montant);
  if (montant !== null && (!Number.isFinite(montant) || montant < 0)) {
    return res.status(400).json({ message: 'Le montant doit être un nombre positif.' });
  }

  const provenance = corps.provenance ? String(corps.provenance) : null;
  if (provenance && !PROVENANCES.includes(provenance)) {
    return res.status(400).json({ message: 'Provenance inconnue.' });
  }

  const maxAppareils = corps.max_appareils ? Number(corps.max_appareils) : 2;
  if (!Number.isInteger(maxAppareils) || maxAppareils < 1 || maxAppareils > 10) {
    return res.status(400).json({ message: "Le nombre d'appareils doit être entre 1 et 10." });
  }

  // La reference se calcule avant le filigrane : elle est imprimee dans le
  // bandeau, dans chaque pied de chapitre et dans le bloc de cloture.
  let reference;
  let html;
  try {
    reference = await prochaineReference();
    html = appliquerFiligrane(
      await lireGuideMaitre(),
      {
        prenom,
        nom,
        telephone,
        reference,
        date: new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())
      },
      { intensite: 'visible', marque: marque() }
    );
  } catch (erreur) {
    logger.error('ebook admin: fabrication impossible', { error: erreur.message });
    return res.status(500).json({ message: erreur.message });
  }

  const chemin = nomDeFichier(reference) + '-' + crypto.randomBytes(16).toString('hex') + '.html';
  const envoi = await supabaseAdmin.storage.from(BUCKET).upload(chemin, Buffer.from(html, 'utf8'), {
    contentType: 'text/html; charset=utf-8',
    upsert: false
  });

  if (envoi.error) {
    logger.error('ebook admin: depot impossible', { error: envoi.error.message });
    return res.status(500).json({ message: "L'exemplaire n'a pas pu être déposé." });
  }

  const jeton = crypto.randomBytes(16).toString('hex');
  const { data: licence, error } = await supabaseAdmin
    .from('ebook_licences')
    .insert({
      reference,
      prenom: prenom || null,
      nom: nom || prenom,
      telephone: telephone || null,
      pays,
      montant,
      devise: corps.devise ? String(corps.devise).toUpperCase().slice(0, 3) : 'XOF',
      provenance,
      note: corps.note ? String(corps.note).slice(0, 500) : null,
      jeton,
      chemin_storage: BUCKET + '/' + chemin,
      max_appareils: maxAppareils
    })
    .select(CHAMPS)
    .single();

  if (error) {
    // On ne laisse pas un fichier orphelin dans le bucket.
    await supabaseAdmin.storage.from(BUCKET).remove([chemin]);
    logger.error('ebook admin: licence non enregistree', { error: error.message });
    return res.status(500).json({ message: "L'accès n'a pas pu être enregistré." });
  }

  logger.info('ebook admin: acces cree', { reference, par: req.user && req.user.id });

  return res.status(201).json({
    message: 'Accès créé pour ' + [prenom, nom].filter(Boolean).join(' '),
    licence: versReponse(licence, 0)
  });
}

/** Retrouve une licence ou repond 404. */
async function chargerLicence(id, res) {
  const { data, error } = await supabaseAdmin
    .from('ebook_licences')
    .select(CHAMPS)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    res.status(500).json({ message: 'Lecture impossible' });
    return null;
  }
  if (!data) {
    res.status(404).json({ message: 'Accès introuvable' });
    return null;
  }
  return data;
}

/** POST /api/ebook/licences/:id/revoquer */
async function revoquerLicence(req, res) {
  const licence = await chargerLicence(req.params.id, res);
  if (!licence) return undefined;

  const { error } = await supabaseAdmin
    .from('ebook_licences')
    .update({
      revoquee: !licence.revoquee,
      revoquee_le: licence.revoquee ? null : new Date().toISOString(),
      motif_revocation: licence.revoquee ? null : (req.body && req.body.motif) || null
    })
    .eq('id', licence.id);

  if (error) return res.status(500).json({ message: 'Opération impossible' });

  return res.json({
    message: licence.revoquee
      ? 'Accès rétabli pour ' + licence.reference
      : 'Accès coupé pour ' + licence.reference
  });
}

/** POST /api/ebook/licences/:id/liberer */
async function libererAppareils(req, res) {
  const licence = await chargerLicence(req.params.id, res);
  if (!licence) return undefined;

  const { data, error } = await supabaseAdmin
    .from('ebook_appareils')
    .update({ libere: true, libere_le: new Date().toISOString() })
    .eq('licence_id', licence.id)
    .eq('libere', false)
    .select('id');

  if (error) return res.status(500).json({ message: 'Opération impossible' });

  const nombre = data ? data.length : 0;
  return res.json({
    message: nombre
      ? nombre + ' place(s) libérée(s). Il pourra réenregistrer ses appareils avec son mot de passe.'
      : 'Aucun appareil à libérer.'
  });
}

/** POST /api/ebook/licences/:id/oublier-mot-de-passe */
async function oublierMotDePasse(req, res) {
  const licence = await chargerLicence(req.params.id, res);
  if (!licence) return undefined;

  const { error } = await supabaseAdmin
    .from('ebook_licences')
    .update({ mot_de_passe_hash: null, mot_de_passe_defini_le: null })
    .eq('id', licence.id);

  if (error) return res.status(500).json({ message: 'Opération impossible' });

  return res.json({
    message: 'Mot de passe effacé. Il en choisira un nouveau à sa prochaine ouverture. ' +
      'Ses appareils déjà enregistrés gardent l\'accès : libère-les aussi pour tout remettre à zéro.'
  });
}

/** POST /api/ebook/licences/:id/regenerer */
async function regenererLicence(req, res) {
  const licence = await chargerLicence(req.params.id, res);
  if (!licence) return undefined;

  let html;
  try {
    html = appliquerFiligrane(
      await lireGuideMaitre(),
      {
        prenom: licence.prenom || '',
        nom: licence.nom || '',
        telephone: licence.telephone || '',
        reference: licence.reference || '',
        date: new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())
      },
      { intensite: 'visible', marque: marque() }
    );
  } catch (erreur) {
    return res.status(500).json({ message: erreur.message });
  }

  const morceaux = String(licence.chemin_storage).split('/');
  const bucket = morceaux.shift();
  const chemin = morceaux.join('/');

  const envoi = await supabaseAdmin.storage.from(bucket).upload(chemin, Buffer.from(html, 'utf8'), {
    contentType: 'text/html; charset=utf-8',
    upsert: true
  });

  if (envoi.error) {
    logger.error('ebook admin: regeneration impossible', { error: envoi.error.message });
    return res.status(500).json({ message: 'Le fichier n\'a pas pu être remplacé.' });
  }

  return res.json({
    message: licence.reference + ' remis à jour. Lien, mot de passe et appareils inchangés.'
  });
}

/** GET /api/ebook/licences/:id/appareils */
async function listerAppareils(req, res) {
  const licence = await chargerLicence(req.params.id, res);
  if (!licence) return undefined;

  const { data, error } = await supabaseAdmin
    .from('ebook_appareils')
    .select('id, etiquette, premiere_vue, derniere_vue, derniere_ip, libere')
    .eq('licence_id', licence.id)
    .order('premiere_vue', { ascending: true });

  if (error) return res.status(500).json({ message: 'Lecture impossible' });

  return res.json({ appareils: data || [], max: licence.max_appareils });
}

module.exports = {
  listerLicences,
  creerLicence,
  revoquerLicence,
  libererAppareils,
  oublierMotDePasse,
  regenererLicence,
  listerAppareils
};
