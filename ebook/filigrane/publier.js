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
 * Options :
 *   --jours N                validite en jours, defaut illimitee
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

async function lister(supabase) {
  const { data, error } = await supabase
    .from('ebook_licences')
    .select('reference, prenom, nom, telephone, revoquee, expire_le, ouvertures, derniere_ouverture, cree_le')
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

  console.log(String('REFERENCE').padEnd(12) + String('TITULAIRE').padEnd(26) + String('OUVERT.').padEnd(9) + 'ETAT');
  for (const l of data) {
    const expiree = l.expire_le && new Date(l.expire_le) < new Date();
    const etat = l.revoquee ? 'revoquee' : (expiree ? 'expiree' : 'active');
    const titulaire = [l.prenom, l.nom].filter(Boolean).join(' ');
    console.log(
      String(l.reference || '-').padEnd(12) +
      titulaire.slice(0, 25).padEnd(26) +
      String(l.ouvertures).padEnd(9) +
      etat
    );
  }
  console.log('\n' + data.length + ' licence(s).');
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
      expire_le: expireLe
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
  if (args.revoquer) return revoquer(supabase, String(args.revoquer), args.motif);

  return publier(args, supabase);
}

main().catch((erreur) => {
  console.error(erreur && erreur.message ? erreur.message : erreur);
  process.exit(1);
});
