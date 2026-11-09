/**
 * Generation et suivi des acces au guide, depuis l'espace super-admin.
 *
 * La fabrication elle-meme vit dans services/licenceGuide.js, partagee avec
 * le webhook Chariow : marquer, deposer et enregistrer un exemplaire est la
 * partie delicate, elle ne doit exister qu'une fois.
 *
 * Les reponses d'echec portent leur motif dans `error`, comme partout
 * ailleurs sur la plateforme : c'est ce champ que le frontend affiche.
 */

const { supabaseAdmin } = require('../config/database');
const logger = require('../config/logger');
const {
  BUCKET, CHAMPS, PROVENANCES,
  versReponse, creerAcces, regenererExemplaire
} = require('../services/licenceGuide');
const { envoyerLien } = require('../services/envoiGuide');
const { listePays, verifierTelephone, DEFAUT } = require('../config/paysTelephone');

/** GET /api/ebook/licences */
async function listerLicences(req, res) {
  const { data, error } = await supabaseAdmin
    .from('ebook_licences')
    .select(CHAMPS)
    .order('cree_le', { ascending: false });

  if (error) {
    logger.error('ebook admin: lecture impossible', { error: error.message });
    return res.status(500).json({ error: 'Impossible de charger les accès' });
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
    return res.status(400).json({ error: 'Il faut au moins un prénom ou un nom.' });
  }

  const pays = String(corps.pays || DEFAUT).trim().toUpperCase();
  let telephone = '';

  if (corps.telephone) {
    const verifie = verifierTelephone(corps.telephone, pays);
    if (!verifie.ok) return res.status(400).json({ error: verifie.message });
    telephone = verifie.affichage;
  }

  const montant = corps.montant === '' || corps.montant == null ? null : Number(corps.montant);
  if (montant !== null && (!Number.isFinite(montant) || montant < 0)) {
    return res.status(400).json({ error: 'Le montant doit être un nombre positif.' });
  }

  const provenance = corps.provenance ? String(corps.provenance) : null;
  if (provenance && !PROVENANCES.includes(provenance)) {
    return res.status(400).json({ error: 'Provenance inconnue.' });
  }

  const maxAppareils = corps.max_appareils ? Number(corps.max_appareils) : 2;
  if (!Number.isInteger(maxAppareils) || maxAppareils < 1 || maxAppareils > 10) {
    return res.status(400).json({ error: "Le nombre d'appareils doit être entre 1 et 10." });
  }

  let licence;
  try {
    licence = await creerAcces(
      { prenom, nom, telephone, pays, email: String(corps.email || '').trim() || null },
      {
        montant,
        devise: corps.devise ? String(corps.devise).toUpperCase().slice(0, 3) : 'XOF',
        provenance,
        note: corps.note ? String(corps.note).slice(0, 500) : null,
        max_appareils: maxAppareils
      }
    );
  } catch (erreur) {
    logger.error('ebook admin: creation impossible', { error: erreur.message });
    return res.status(500).json({ error: erreur.message });
  }

  // Envoi seulement si demande : une vente saisie a la main part souvent
  // par WhatsApp, et un second email ferait doublon.
  let envoye = false;
  if (corps.envoyer_email && licence.email) {
    const envoi = await envoyerLien(licence);
    envoye = envoi.envoye;
    if (!envoi.envoye) {
      return res.status(201).json({
        message: 'Accès créé, mais l\'email n\'est pas parti : ' + envoi.raison,
        licence
      });
    }
  }

  return res.status(201).json({
    message: 'Accès créé pour ' + [prenom, nom].filter(Boolean).join(' ') +
      (envoye ? ', email envoyé' : ''),
    licence
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
    res.status(500).json({ error: 'Lecture impossible' });
    return null;
  }
  if (!data) {
    res.status(404).json({ error: 'Accès introuvable' });
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

  if (error) return res.status(500).json({ error: 'Opération impossible' });

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

  if (error) return res.status(500).json({ error: 'Opération impossible' });

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

  if (error) return res.status(500).json({ error: 'Opération impossible' });

  return res.json({
    message: 'Mot de passe effacé. Il en choisira un nouveau à sa prochaine ouverture. ' +
      'Ses appareils déjà enregistrés gardent l\'accès : libère-les aussi pour tout remettre à zéro.'
  });
}

/** POST /api/ebook/licences/:id/regenerer */
async function regenererLicence(req, res) {
  const licence = await chargerLicence(req.params.id, res);
  if (!licence) return undefined;

  try {
    await regenererExemplaire(licence);
  } catch (erreur) {
    logger.error('ebook admin: regeneration impossible', { error: erreur.message });
    return res.status(500).json({ error: erreur.message });
  }

  return res.json({
    message: licence.reference + ' remis à jour. Lien, mot de passe et appareils inchangés.'
  });
}

/** POST /api/ebook/licences/:id/renvoyer : renvoie le lien par email. */
async function renvoyerLien(req, res) {
  const licence = await chargerLicence(req.params.id, res);
  if (!licence) return undefined;

  if (!licence.email) {
    return res.status(400).json({ error: 'Cet accès n\'a pas d\'adresse email.' });
  }

  const envoi = await envoyerLien(versReponse(licence, 0));
  if (!envoi.envoye) {
    return res.status(500).json({ error: "L'email n'est pas parti : " + envoi.raison });
  }

  return res.json({ message: 'Lien renvoyé à ' + licence.email });
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

  if (error) return res.status(500).json({ error: 'Lecture impossible' });

  return res.json({ appareils: data || [], max: licence.max_appareils });
}

module.exports = {
  listerLicences,
  creerLicence,
  revoquerLicence,
  libererAppareils,
  oublierMotDePasse,
  regenererLicence,
  renvoyerLien,
  listerAppareils,
  BUCKET
};
