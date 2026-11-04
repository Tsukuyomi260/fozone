#!/usr/bin/env node
'use strict';

/**
 * Fabrique un exemplaire nominatif, le depose et rend le lien de l'acheteur.
 *
 *   node filigrane/publier.js \
 *     --prenom "Jean-Marie" --nom "AKPOVI" \
 *     --tel "+229 01 00 00 00 00" --ref NZ-0001
 *
 * Trois choses se passent :
 *   1. le guide est marque au nom et au numero de l'acheteur ;
 *   2. le fichier part dans un bucket Supabase prive, jamais joignable
 *      directement ;
 *   3. une licence est enregistree, portant un jeton de 32 octets.
 *
 * Le lien rendu pointe sur /guide/<jeton> de ton API, qui verifie le jeton
 * puis sert le fichier. Revoquer un acces coupe ce seul lien.
 *
 * A sa premiere ouverture, l'acheteur choisit un mot de passe. Son acces se
 * fixe ensuite sur les appareils depuis lesquels il l'a saisi, deux par
 * defaut. Le lien seul ne sert donc a rien.
 *
 * Options :
 *   --jours N                validite en jours, defaut illimitee
 *   --appareils N            nombre d'appareils autorises, defaut 2
 *   --bucket nom             defaut guides
 *   --base https://...       racine du lien, defaut API_BASE_URL
 *   --intensite visible|discret
 *   --marque / --contact / --wa     coordonnees de l'editeur
 *   --source chemin.html     defaut index.html
 *   --creer-bucket           cree le bucket prive s'il manque
 *   --garder                 garde aussi une copie dans exemplaires/
 *
 * Autres commandes :
 *   --lister                 les licences, de la plus recente a la plus ancienne
 *   --appareils-de <ref>     les appareils enregistres pour un exemplaire
 *   --regenerer <ref>        remet l'exemplaire a jour depuis le guide actuel,
 *                            meme lien, meme mot de passe, memes appareils
 *   --regenerer              idem pour tous les exemplaires non revoques
 *   --liberer <ref>          rend toutes les places : l'acheteur repart a zero
 *   --oublier-mot-de-passe <ref>   efface le mot de passe, il en rechoisira un
 *   --revoquer <reference>   coupe l'acces d'un exemplaire
 *     --motif "texte"        raison, gardee avec la revocation
 *
 * Identifiants lus dans backend/.env : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * API_BASE_URL. Rien de nominatif n'est ecrit dans le depot.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  RACINE,
  lireArguments,
  nomDeFichier,
  aujourdhui,
  lireAcheteur,
  fabriquerExemplaire,
  etiquetteAcheteur,
  afficherAide
} = require('./commun');

const DOSSIER_BACKEND = path.join(RACINE, '..', 'backend');
const BUCKET_DEFAUT = 'guides';

/** Charge backend/.env sans ecraser ce qui est deja dans l'environnement. */
function chargerEnvironnement() {
  for (const nom of ['.env.local', '.env']) {
    const fichier = path.join(DOSSIER_BACKEND, nom);
    if (!fs.existsSync(fichier)) continue;

    for (const ligne of fs.readFileSync(fichier, 'utf8').split(/\r?\n/)) {
      const coupure = ligne.indexOf('=');
      if (coupure < 1 || ligne.trimStart().startsWith('#')) continue;

      const cle = ligne.slice(0, coupure).trim();
      if (process.env[cle] !== undefined) continue;

      let valeur = ligne.slice(coupure + 1).trim();
      if (/^".*"$|^'.*'$/.test(valeur)) valeur = valeur.slice(1, -1);
      process.env[cle] = valeur;
    }
  }
}

function clientSupabase() {
  let creerClient;
  try {
    ({ createClient: creerClient } = require(path.join(DOSSIER_BACKEND, 'node_modules', '@supabase', 'supabase-js')));
  } catch (erreur) {
    console.error('@supabase/supabase-js est introuvable. Lance "npm install" dans backend/.');
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !cle) {
    console.error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manque dans backend/.env.');
    process.exit(1);
  }

  return creerClient(url, cle, { auth: { persistSession: false } });
}

function racineDuLien(args) {
  const base = args.base || process.env.FZ_LIEN_BASE || process.env.API_BASE_URL;
  if (!base) {
    console.error('Impossible de construire le lien : ni --base, ni FZ_LIEN_BASE, ni API_BASE_URL.');
    process.exit(1);
  }
  return String(base).replace(/\/+$/, '');
}

/** Un chemin que personne ne devine, meme en connaissant la reference. */
function cheminDistant(acheteur) {
  const base = nomDeFichier(acheteur.reference || [acheteur.prenom, acheteur.nom].join('-')) || 'exemplaire';
  return base + '-' + crypto.randomBytes(16).toString('hex') + '.html';
}

async function verifierBucket(supabase, bucket, creer) {
  const { data, error } = await supabase.storage.getBucket(bucket);

  if (data) {
    if (data.public) {
      console.error('Le bucket "' + bucket + '" est public : les exemplaires y seraient lisibles sans jeton.');
      console.error('Passe-le en prive dans Supabase avant de publier.');
      process.exit(1);
    }
    return;
  }

  if (!creer) {
    console.error('Bucket "' + bucket + '" introuvable : ' + (error ? error.message : 'inconnu'));
    console.error('Cree-le en prive dans Supabase, ou relance avec --creer-bucket.');
    process.exit(1);
  }

  const creation = await supabase.storage.createBucket(bucket, { public: false });
  if (creation.error) {
    console.error('Creation du bucket impossible : ' + creation.error.message);
    process.exit(1);
  }
  console.log('Bucket prive "' + bucket + '" cree.');
}

/** Retrouve une licence par sa reference, ou sort avec un message. */
async function trouverLicence(supabase, reference, champs) {
  const { data, error } = await supabase
    .from('ebook_licences')
    .select(champs || 'id, reference, prenom, nom, max_appareils')
    .eq('reference', reference)
    .maybeSingle();

  if (error) {
    console.error('Lecture impossible : ' + error.message);
    process.exit(1);
  }
  if (!data) {
    console.error('Aucune licence avec la reference ' + reference + '.');
    process.exit(1);
  }
  return data;
}

async function lister(supabase) {
  const { data, error } = await supabase
    .from('ebook_licences')
    .select('id, reference, prenom, nom, revoquee, expire_le, ouvertures, max_appareils, mot_de_passe_hash, cree_le')
    .order('cree_le', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Lecture impossible : ' + error.message);
    process.exit(1);
  }

  if (!data.length) {
    console.log('Aucune licence pour le moment.');
    return;
  }

  const { data: appareils } = await supabase
    .from('ebook_appareils')
    .select('licence_id')
    .eq('libere', false);

  const parLicence = new Map();
  for (const a of appareils || []) {
    parLicence.set(a.licence_id, (parLicence.get(a.licence_id) || 0) + 1);
  }

  console.log(
    'REFERENCE   ' + String('TITULAIRE').padEnd(26) +
    String('OUVERT.').padEnd(9) + String('APPAREILS').padEnd(11) + 'ETAT'
  );

  for (const l of data) {
    const expiree = l.expire_le && new Date(l.expire_le) < new Date();
    const etat = l.revoquee ? 'revoquee'
      : expiree ? 'expiree'
        : l.mot_de_passe_hash ? 'active' : 'jamais ouverte';

    console.log(
      String(l.reference || '-').padEnd(12) +
      [l.prenom, l.nom].filter(Boolean).join(' ').slice(0, 25).padEnd(26) +
      String(l.ouvertures).padEnd(9) +
      ((parLicence.get(l.id) || 0) + ' / ' + l.max_appareils).padEnd(11) +
      etat
    );
  }
  console.log('\n' + data.length + ' licence(s).');
}

async function appareilsDe(supabase, reference) {
  const licence = await trouverLicence(supabase, reference);

  const { data, error } = await supabase
    .from('ebook_appareils')
    .select('etiquette, premiere_vue, derniere_vue, derniere_ip, libere')
    .eq('licence_id', licence.id)
    .order('premiere_vue', { ascending: true });

  if (error) {
    console.error('Lecture impossible : ' + error.message);
    process.exit(1);
  }

  const titulaire = [licence.prenom, licence.nom].filter(Boolean).join(' ');
  console.log(titulaire + ' (' + licence.reference + ') - ' + licence.max_appareils + ' appareils autorises\n');

  if (!data.length) {
    console.log('Aucun appareil enregistre : le lien n\'a jamais ete ouvert.');
    return;
  }

  for (const a of data) {
    console.log(
      (a.libere ? '[libere] ' : '[actif]  ') +
      String(a.etiquette || 'appareil').padEnd(22) +
      'depuis le ' + String(a.premiere_vue).slice(0, 10) +
      '   vu le ' + String(a.derniere_vue).slice(0, 10) +
      (a.derniere_ip ? '   ' + a.derniere_ip : '')
    );
  }
}

/**
 * Refabrique un exemplaire depuis le guide actuel et remplace le fichier a
 * l'identique de son chemin. Le lien, le mot de passe et les appareils de
 * l'acheteur ne bougent pas : il voit la nouvelle version a sa prochaine
 * ouverture, sans avoir rien a faire.
 */
async function regenerer(supabase, args, licence) {
  const acheteur = {
    prenom: licence.prenom || '',
    nom: licence.nom || '',
    telephone: licence.telephone || '',
    reference: licence.reference || '',
    date: args.date || aujourdhui()
  };

  const { html } = fabriquerExemplaire(args, acheteur);
  const [bucket, ...reste] = String(licence.chemin_storage).split('/');
  const chemin = reste.join('/');

  const envoi = await supabase.storage.from(bucket).upload(chemin, Buffer.from(html, 'utf8'), {
    contentType: 'text/html; charset=utf-8',
    upsert: true
  });

  if (envoi.error) {
    console.error('  ' + (licence.reference || licence.id) + ' : echec, ' + envoi.error.message);
    return false;
  }

  console.log('  ' + String(licence.reference || licence.id).padEnd(12) +
    [acheteur.prenom, acheteur.nom].filter(Boolean).join(' ').slice(0, 28).padEnd(30) +
    (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1) + ' Ko');
  return true;
}

const CHAMPS_REGENERATION = 'id, reference, prenom, nom, telephone, chemin_storage';

async function regenererUn(supabase, args, reference) {
  let licence = await trouverLicence(supabase, reference, CHAMPS_REGENERATION);

  // --prenom et --nom corrigent l'identite au passage. Utile quand le bandeau
  // d'accueil dit « Salut TANO ADOU JEAN YVES » : on veut juste le prenom.
  const correction = {};
  if (args.prenom !== undefined) correction.prenom = String(args.prenom);
  if (args.nom !== undefined) correction.nom = String(args.nom);
  if (args.tel !== undefined) correction.telephone = String(args.tel);

  if (Object.keys(correction).length) {
    const { data, error } = await supabase
      .from('ebook_licences')
      .update(correction)
      .eq('id', licence.id)
      .select(CHAMPS_REGENERATION)
      .single();

    if (error) {
      console.error('Correction impossible : ' + error.message);
      process.exit(1);
    }
    licence = data;
    console.log('Identite corrigee : ' + [licence.prenom, licence.nom].filter(Boolean).join(' '));
  }

  console.log('Regeneration depuis le guide actuel :');
  const ok = await regenerer(supabase, args, licence);
  console.log(ok ? '\nLien, mot de passe et appareils inchanges.' : '\nRien n\'a ete remplace.');
}

async function regenererTout(supabase, args) {
  const { data, error } = await supabase
    .from('ebook_licences')
    .select(CHAMPS_REGENERATION)
    .eq('revoquee', false)
    .order('cree_le', { ascending: true });

  if (error) {
    console.error('Lecture impossible : ' + error.message);
    process.exit(1);
  }
  if (!data.length) {
    console.log('Aucune licence a regenerer.');
    return;
  }

  console.log('Regeneration de ' + data.length + ' exemplaire(s) depuis le guide actuel :');
  let faits = 0;
  for (const licence of data) {
    if (await regenerer(supabase, args, licence)) faits += 1;
  }
  console.log('\n' + faits + ' / ' + data.length + ' remplaces. Liens, mots de passe et appareils inchanges.');
}

async function liberer(supabase, reference) {
  const licence = await trouverLicence(supabase, reference);

  const { data, error } = await supabase
    .from('ebook_appareils')
    .update({ libere: true, libere_le: new Date().toISOString() })
    .eq('licence_id', licence.id)
    .eq('libere', false)
    .select('id');

  if (error) {
    console.error('Liberation impossible : ' + error.message);
    process.exit(1);
  }

  const titulaire = [licence.prenom, licence.nom].filter(Boolean).join(' ');
  console.log((data ? data.length : 0) + ' place(s) liberee(s) pour ' + titulaire + ' (' + licence.reference + ').');
  console.log('Il pourra reenregistrer ' + licence.max_appareils + ' appareils avec son mot de passe.');
}

async function oublierMotDePasse(supabase, reference) {
  const licence = await trouverLicence(supabase, reference);

  const { error } = await supabase
    .from('ebook_licences')
    .update({ mot_de_passe_hash: null, mot_de_passe_defini_le: null })
    .eq('id', licence.id);

  if (error) {
    console.error('Remise a zero impossible : ' + error.message);
    process.exit(1);
  }

  const titulaire = [licence.prenom, licence.nom].filter(Boolean).join(' ');
  console.log('Mot de passe efface pour ' + titulaire + ' (' + licence.reference + ').');
  console.log('A sa prochaine ouverture, il en choisira un nouveau.');
  console.log('Ses appareils deja enregistres gardent l\'acces : ajoute --liberer pour les couper aussi.');
}

async function revoquer(supabase, reference, motif) {
  const { data, error } = await supabase
    .from('ebook_licences')
    .update({
      revoquee: true,
      revoquee_le: new Date().toISOString(),
      motif_revocation: motif || null
    })
    .eq('reference', reference)
    .select('reference, prenom, nom')
    .maybeSingle();

  if (error) {
    console.error('Revocation impossible : ' + error.message);
    process.exit(1);
  }
  if (!data) {
    console.error('Aucune licence avec la reference ' + reference + '.');
    process.exit(1);
  }

  console.log('Acces coupe pour ' + [data.prenom, data.nom].filter(Boolean).join(' ') + ' (' + data.reference + ').');
  console.log('Son lien repond desormais « Acces revoque ». Les autres ne bougent pas.');
}

async function publier(args, supabase) {
  const acheteur = lireAcheteur(args);
  const { html, intensite } = fabriquerExemplaire(args, acheteur);

  const bucket = args.bucket || BUCKET_DEFAUT;
  await verifierBucket(supabase, bucket, Boolean(args['creer-bucket']));

  let expireLe = null;
  if (args.jours !== undefined) {
    const jours = Number(args.jours);
    if (!Number.isFinite(jours) || jours <= 0) {
      console.error('--jours doit etre un nombre de jours positif.');
      process.exit(1);
    }
    expireLe = new Date(Date.now() + jours * 86400000).toISOString();
  }

  const chemin = cheminDistant(acheteur);
  const envoi = await supabase.storage.from(bucket).upload(chemin, Buffer.from(html, 'utf8'), {
    contentType: 'text/html; charset=utf-8',
    upsert: false
  });

  if (envoi.error) {
    console.error('Envoi impossible : ' + envoi.error.message);
    process.exit(1);
  }

  let maxAppareils = null;
  if (args.appareils !== undefined) {
    maxAppareils = Number(args.appareils);
    if (!Number.isInteger(maxAppareils) || maxAppareils < 1 || maxAppareils > 10) {
      console.error('--appareils doit etre un entier entre 1 et 10.');
      process.exit(1);
    }
  }

  const jeton = crypto.randomBytes(16).toString('hex');
  const insertion = await supabase
    .from('ebook_licences')
    .insert({
      reference: acheteur.reference || null,
      prenom: acheteur.prenom || null,
      nom: acheteur.nom || acheteur.prenom,
      telephone: acheteur.telephone || null,
      jeton,
      chemin_storage: bucket + '/' + chemin,
      expire_le: expireLe,
      ...(maxAppareils ? { max_appareils: maxAppareils } : {})
    })
    .select('id')
    .single();

  if (insertion.error) {
    // Le fichier est deja en place : on le retire pour ne pas laisser d'orphelin.
    await supabase.storage.from(bucket).remove([chemin]);
    console.error('Licence non enregistree : ' + insertion.error.message);
    if (/duplicate|unique/i.test(insertion.error.message)) {
      console.error('La reference ' + acheteur.reference + ' existe deja. Prends-en une autre.');
    }
    process.exit(1);
  }

  if (args.garder) {
    const copie = path.join(RACINE, 'exemplaires', chemin);
    fs.mkdirSync(path.dirname(copie), { recursive: true });
    fs.writeFileSync(copie, html, 'utf8');
  }

  const lien = racineDuLien(args) + '/guide/' + jeton;

  console.log('Exemplaire publie.');
  console.log('  titulaire  : ' + etiquetteAcheteur(acheteur));
  console.log('  licence    : ' + (acheteur.reference || '(aucune)'));
  console.log('  intensite  : ' + intensite);
  console.log('  validite   : ' + (expireLe ? 'jusqu\'au ' + expireLe.slice(0, 10) : 'illimitee'));
  console.log('  appareils  : ' + (maxAppareils || 2) + ' maximum');
  console.log('');
  console.log('Lien a envoyer :');
  console.log(lien);
}

async function main() {
  const args = lireArguments(process.argv.slice(2));

  if (args.aide || args.help) {
    afficherAide(__filename);
    return;
  }

  chargerEnvironnement();
  const supabase = clientSupabase();

  if (args.lister) return lister(supabase);
  if (args['appareils-de']) return appareilsDe(supabase, String(args['appareils-de']));
  if (args.regenerer === true) return regenererTout(supabase, args);
  if (args.regenerer) return regenererUn(supabase, args, String(args.regenerer));
  if (args.liberer) return liberer(supabase, String(args.liberer));
  if (args['oublier-mot-de-passe']) return oublierMotDePasse(supabase, String(args['oublier-mot-de-passe']));
  if (args.revoquer) return revoquer(supabase, String(args.revoquer), args.motif);

  return publier(args, supabase);
}

main().catch((erreur) => {
  console.error(erreur && erreur.message ? erreur.message : erreur);
  process.exit(1);
});
