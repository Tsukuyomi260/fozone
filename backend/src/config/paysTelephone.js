/**
 * Pays et format des numeros, pour les acheteurs du guide.
 *
 * Volontairement separe de config/countries.js : celui-la decrit les pays ou
 * la plateforme encaisse du Mobile Money. Un acheteur du guide peut venir
 * d'ailleurs - la Guinee, par exemple - sans que cela signifie qu'on y vend
 * des tickets Wi-Fi. Melanger les deux listes ferait croire au parcours
 * d'achat qu'il peut encaisser dans un pays ou il ne le peut pas.
 *
 * `chiffres` est le nombre de chiffres attendus apres l'indicatif. Deux
 * saisies recues avec un chiffre de trop sont precisement ce que cette
 * verification arrete.
 */

const PAYS = {
  BJ: { nom: 'Bénin', indicatif: '229', chiffres: 10, exemple: '01 53 48 98 46' },
  CI: { nom: "Côte d'Ivoire", indicatif: '225', chiffres: 10, exemple: '07 49 41 54 09' },
  TG: { nom: 'Togo', indicatif: '228', chiffres: 8, exemple: '90 00 00 00' },
  SN: { nom: 'Sénégal', indicatif: '221', chiffres: 9, exemple: '77 000 00 00' },
  ML: { nom: 'Mali', indicatif: '223', chiffres: 8, exemple: '70 00 00 00' },
  BF: { nom: 'Burkina Faso', indicatif: '226', chiffres: 8, exemple: '73 03 52 17' },
  GN: { nom: 'Guinée', indicatif: '224', chiffres: 9, exemple: '627 82 26 11' },
  NE: { nom: 'Niger', indicatif: '227', chiffres: 8, exemple: '90 00 00 00' },
  CM: { nom: 'Cameroun', indicatif: '237', chiffres: 9, exemple: '6 70 00 00 00' },
  GA: { nom: 'Gabon', indicatif: '241', chiffres: 8, exemple: '06 00 00 00' },
  CD: { nom: 'RD Congo', indicatif: '243', chiffres: 9, exemple: '81 000 0000' },
  FR: { nom: 'France', indicatif: '33', chiffres: 9, exemple: '6 12 34 56 78' }
};

const DEFAUT = 'BJ';

function listePays() {
  return Object.entries(PAYS).map(([code, p]) => ({
    code,
    nom: p.nom,
    indicatif: p.indicatif,
    chiffres: p.chiffres,
    exemple: p.exemple
  }));
}

/** Decoupe un nombre en groupes lisibles : 0153489846 -> 01 53 48 98 46. */
function grouper(chiffres) {
  if (chiffres.length % 2 === 0) return chiffres.replace(/(\d{2})(?=\d)/g, '$1 ');
  return chiffres.slice(0, 3) + ' ' + chiffres.slice(3).replace(/(\d{2})(?=\d)/g, '$1 ');
}

/**
 * Verifie et met en forme un numero.
 *
 * Accepte ce que la personne tape : avec ou sans indicatif, avec espaces,
 * points ou tirets. Refuse clairement si le compte n'y est pas.
 *
 * @returns {{ok: true, affichage: string, international: string}}
 *        | {ok: false, message: string}
 */
function verifierTelephone(valeur, codePays) {
  const pays = PAYS[codePays];
  if (!pays) return { ok: false, message: 'Pays inconnu.' };

  let chiffres = String(valeur == null ? '' : valeur).replace(/\D/g, '');
  if (!chiffres) return { ok: false, message: 'Numéro manquant.' };

  // L'indicatif est souvent recopie avec le numero : on le retire s'il est la
  // et que ce qui reste a la bonne longueur.
  if (chiffres.startsWith(pays.indicatif) &&
      chiffres.length === pays.indicatif.length + pays.chiffres) {
    chiffres = chiffres.slice(pays.indicatif.length);
  }

  if (chiffres.length !== pays.chiffres) {
    return {
      ok: false,
      message: `Un numéro ${pays.nom} compte ${pays.chiffres} chiffres après +${pays.indicatif}. ` +
        `Tu en as saisi ${chiffres.length}. Exemple : ${pays.exemple}`
    };
  }

  return {
    ok: true,
    affichage: '+' + pays.indicatif + ' ' + grouper(chiffres),
    international: pays.indicatif + chiffres
  };
}

module.exports = { PAYS, DEFAUT, listePays, verifierTelephone };
