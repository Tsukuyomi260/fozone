#!/usr/bin/env node
'use strict';

/**
 * Fabrique un exemplaire nominatif du guide.
 *
 *   node filigrane/personnaliser.js \
 *     --prenom "Jean-Marie" --nom "AKPOVI" \
 *     --tel "+229 01 00 00 00 00" --ref FZ-0007
 *
 * Options :
 *   --intensite visible|discret   défaut visible
 *   --marque "NET ZONE"           nom de l'éditeur
 *   --contact "Prénom NOM"        personne à joindre
 *   --wa "+229 ..."               numéro WhatsApp du support
 *   --sortie chemin.html          défaut exemplaires/<ref ou nom>.html
 *   --source chemin.html          défaut index.html
 *
 * Les coordonnées de l'éditeur viennent, par ordre de priorité, des options
 * ci-dessus, puis des variables FZ_MARQUE_NOM / FZ_MARQUE_CONTACT / FZ_MARQUE_WA,
 * puis de filigrane/marque.json. Ce fichier n'est pas suivi par git : le numéro
 * réel ne part donc jamais dans le dépôt. Modèle : marque.exemple.json.
 *
 * Le guide d'origine n'est jamais modifié.
 */

const fs = require('fs');
const path = require('path');
const { appliquerFiligrane, INTENSITES } = require('./filigrane');

const RACINE = path.join(__dirname, '..');
const FICHIER_MARQUE = path.join(__dirname, 'marque.json');

/** Coordonnées de l'éditeur : options > variables d'environnement > marque.json. */
function lireMarque(args) {
  let fichier = {};
  if (fs.existsSync(FICHIER_MARQUE)) {
    try {
      fichier = JSON.parse(fs.readFileSync(FICHIER_MARQUE, 'utf8'));
    } catch (erreur) {
      console.error('marque.json est illisible : ' + erreur.message);
      process.exit(1);
    }
  }

  const marque = {};
  const nom = args.marque || process.env.FZ_MARQUE_NOM || fichier.nom;
  const contact = args.contact || process.env.FZ_MARQUE_CONTACT || fichier.contact;
  const whatsapp = args.wa || process.env.FZ_MARQUE_WA || fichier.whatsapp;

  if (nom) marque.nom = nom;
  if (contact) marque.contact = contact;
  if (whatsapp) marque.whatsapp = whatsapp;

  if (!marque.whatsapp) {
    console.warn('Attention : aucune coordonnée trouvée, le bloc de clôture affichera un numéro factice.');
    console.warn('Copie marque.exemple.json en marque.json et remplis-le.');
  }

  return marque;
}

function lireArguments(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const jeton = argv[i];
    if (jeton.slice(0, 2) !== '--') continue;
    const cle = jeton.slice(2);
    const suivant = argv[i + 1];
    if (suivant === undefined || suivant.slice(0, 2) === '--') {
      args[cle] = true;
    } else {
      args[cle] = suivant;
      i += 1;
    }
  }
  return args;
}

/** Un nom de fichier sans surprise : pas d'espace, pas d'accent, pas de séparateur. */
function nomDeFichier(valeur) {
  return String(valeur)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function aujourdhui() {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    .format(new Date());
}

function main() {
  const args = lireArguments(process.argv.slice(2));

  if (args.aide || args.help) {
    process.stdout.write(fs.readFileSync(__filename, 'utf8').split('*/')[0] + '*/\n');
    return;
  }

  const acheteur = {
    prenom: args.prenom || '',
    nom: args.nom || '',
    telephone: args.tel || args.telephone || '',
    reference: args.ref || args.reference || '',
    date: args.date || aujourdhui()
  };

  if (!acheteur.prenom && !acheteur.nom) {
    console.error('Il faut au moins --prenom ou --nom. Voir --aide.');
    process.exit(1);
  }

  const intensite = args.intensite || 'visible';
  if (!INTENSITES[intensite]) {
    console.error('Intensité inconnue : ' + intensite + '. Valeurs possibles : ' + Object.keys(INTENSITES).join(', ') + '.');
    process.exit(1);
  }

  const source = path.resolve(RACINE, args.source || 'index.html');
  if (!fs.existsSync(source)) {
    console.error('Guide introuvable : ' + source);
    process.exit(1);
  }

  const marque = lireMarque(args);

  let sortieHtml;
  try {
    sortieHtml = appliquerFiligrane(fs.readFileSync(source, 'utf8'), acheteur, { intensite, marque });
  } catch (erreur) {
    console.error(erreur.message);
    process.exit(1);
  }

  const base = nomDeFichier(acheteur.reference || [acheteur.prenom, acheteur.nom].join('-')) || 'exemplaire';
  const destination = args.sortie
    ? path.resolve(RACINE, args.sortie)
    : path.join(RACINE, 'exemplaires', base + '.html');

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, sortieHtml, 'utf8');

  const poids = (Buffer.byteLength(sortieHtml, 'utf8') / 1024).toFixed(1);
  console.log('Exemplaire créé : ' + destination);
  console.log('  titulaire  : ' + [acheteur.prenom, acheteur.nom].filter(Boolean).join(' ') + (acheteur.telephone ? ' (' + acheteur.telephone + ')' : ''));
  console.log('  licence    : ' + (acheteur.reference || '(aucune)'));
  console.log('  intensité  : ' + intensite);
  console.log('  poids      : ' + poids + ' Ko');
}

main();
