'use strict';

/**
 * Briques partagées par personnaliser.js (fabrique un exemplaire) et
 * publier.js (le met en ligne et rend un lien).
 */

const fs = require('fs');
const path = require('path');
const { appliquerFiligrane, INTENSITES } = require('./filigrane');

const RACINE = path.join(__dirname, '..');
const FICHIER_MARQUE = path.join(__dirname, 'marque.json');

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
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function aujourdhui() {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    .format(new Date());
}

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

/** Lit l'acheteur depuis les options, et refuse d'aller plus loin s'il est vide. */
function lireAcheteur(args) {
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

  return acheteur;
}

/** Fabrique le HTML de l'exemplaire. Sort du programme avec un message si ça coince. */
function fabriquerExemplaire(args, acheteur) {
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

  try {
    return {
      html: appliquerFiligrane(fs.readFileSync(source, 'utf8'), acheteur, {
        intensite,
        marque: lireMarque(args)
      }),
      intensite
    };
  } catch (erreur) {
    console.error(erreur.message);
    process.exit(1);
  }
}

function etiquetteAcheteur(acheteur) {
  const nom = [acheteur.prenom, acheteur.nom].filter(Boolean).join(' ');
  return nom + (acheteur.telephone ? ' (' + acheteur.telephone + ')' : '');
}

/** Affiche l'en-tête du fichier appelant, qui sert d'aide en ligne. */
function afficherAide(fichier) {
  process.stdout.write(fs.readFileSync(fichier, 'utf8').split('*/')[0] + '*/\n');
}

module.exports = {
  RACINE,
  lireArguments,
  nomDeFichier,
  aujourdhui,
  lireMarque,
  lireAcheteur,
  fabriquerExemplaire,
  etiquetteAcheteur,
  afficherAide
};
