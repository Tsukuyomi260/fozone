#!/usr/bin/env node
'use strict';

/**
 * Fabrique un exemplaire nominatif du guide, sur le disque.
 *
 *   node filigrane/personnaliser.js \
 *     --prenom "Jean-Marie" --nom "AKPOVI" \
 *     --tel "+229 01 00 00 00 00" --ref NZ-0001
 *
 * Options :
 *   --intensite visible|discret   défaut visible
 *   --marque "NET ZONE"           nom de l'éditeur
 *   --contact "Prénom NOM"        personne à joindre
 *   --wa "+229 ..."               numéro WhatsApp du support
 *   --sortie chemin.html          défaut exemplaires/<ref ou nom>.html
 *   --source chemin.html          défaut index.html
 *
 * Pour fabriquer ET mettre en ligne d'un coup, voir publier.js.
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
const {
  RACINE,
  lireArguments,
  nomDeFichier,
  lireAcheteur,
  fabriquerExemplaire,
  etiquetteAcheteur,
  afficherAide
} = require('./commun');

function main() {
  const args = lireArguments(process.argv.slice(2));

  if (args.aide || args.help) {
    afficherAide(__filename);
    return;
  }

  const acheteur = lireAcheteur(args);
  const { html, intensite } = fabriquerExemplaire(args, acheteur);

  const base = nomDeFichier(acheteur.reference || [acheteur.prenom, acheteur.nom].join('-')) || 'exemplaire';
  const destination = args.sortie
    ? path.resolve(RACINE, args.sortie)
    : path.join(RACINE, 'exemplaires', base + '.html');

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, html, 'utf8');

  const poids = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
  console.log('Exemplaire créé : ' + destination);
  console.log('  titulaire  : ' + etiquetteAcheteur(acheteur));
  console.log('  licence    : ' + (acheteur.reference || '(aucune)'));
  console.log('  intensité  : ' + intensite);
  console.log('  poids      : ' + poids + ' Ko');
}

main();
