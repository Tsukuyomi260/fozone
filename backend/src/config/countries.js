/**
 * Pays couverts par la plateforme, et ce que chacun implique au paiement.
 *
 * Pourquoi ce fichier existe: le parcours d'achat imposait
 * `methods: ['mtn_bj', 'moov_bj']` a chaque paiement. Moneroo n'affiche que ce
 * qu'on lui demande, donc la page de paiement etait verrouillee sur le Benin:
 * un client ivoirien ne voyait ni Wave, ni Orange Money, ni MTN CI, et ne
 * pouvait meme pas choisir son pays.
 *
 * Les codes de methodes viennent de la documentation Moneroo (Available
 * methods). Y ajouter une methode ne suffit pas: elle doit aussi etre activee
 * dans le tableau de bord Moneroo, sinon elle n'apparaitra pas.
 *
 * `dialCode` sert a completer le numero du client. Les numeros locaux du Benin
 * et de Cote d'Ivoire comportent desormais dix chiffres, zero initial compris:
 * on prefixe l'indicatif sans jamais retirer ce zero.
 */

const COUNTRIES = {
  BJ: {
    code: 'BJ',
    name: 'Bénin',
    dialCode: '229',
    placeholder: '01 53 48 98 46',
    methods: ['mtn_bj', 'moov_bj', 'celtiis_bj'],
  },
  CI: {
    code: 'CI',
    name: "Côte d'Ivoire",
    dialCode: '225',
    placeholder: '07 09 17 96 94',
    methods: ['mtn_ci', 'orange_ci', 'moov_ci', 'wave_ci'],
  },
  TG: {
    code: 'TG',
    name: 'Togo',
    dialCode: '228',
    placeholder: '90 00 00 00',
    methods: ['moov_tg', 'togocel'],
  },
  SN: {
    code: 'SN',
    name: 'Sénégal',
    dialCode: '221',
    placeholder: '77 000 00 00',
    methods: ['orange_sn', 'wave_sn', 'freemoney_sn', 'e_money_sn', 'wizall_sn'],
  },
  ML: {
    code: 'ML',
    name: 'Mali',
    dialCode: '223',
    placeholder: '70 00 00 00',
    // mobi_cash_ml figurait dans la documentation mais Moneroo le refuse:
    // « The payment method 'mobi_cash_ml' is invalid ». Un seul code inconnu
    // fait rejeter tout le paiement, donc aucun achat n'aurait abouti au Mali.
    methods: ['orange_ml', 'moov_ml'],
  },
  BF: {
    code: 'BF',
    name: 'Burkina Faso',
    dialCode: '226',
    placeholder: '70 00 00 00',
    methods: ['orange_bf', 'moov_bf'],
  },
};

const DEFAULT_COUNTRY = 'BJ';

// Moneroo refuse tout paiement en dehors de cette plage, quelle que soit la
// methode: un tarif a moins de 100 F ne peut pas etre encaisse.
const MIN_AMOUNT_XOF = 100;
const MAX_AMOUNT_XOF = 1000000;

/** Noms lisibles des methodes, pour la comptabilite. */
const METHOD_LABELS = {
  mtn_bj: 'MTN MoMo Bénin',
  moov_bj: 'Moov Money Bénin',
  celtiis_bj: 'Celtiis Cash Bénin',
  mtn_ci: "MTN MoMo Côte d'Ivoire",
  orange_ci: "Orange Money Côte d'Ivoire",
  moov_ci: "Moov Money Côte d'Ivoire",
  wave_ci: "Wave Côte d'Ivoire",
  moov_tg: 'Moov Money Togo',
  togocel: 'Togocel Money',
  orange_sn: 'Orange Money Sénégal',
  wave_sn: 'Wave Sénégal',
  freemoney_sn: 'Free Money Sénégal',
  e_money_sn: 'E-Money Sénégal',
  wizall_sn: 'Wizall Sénégal',
  orange_ml: 'Orange Money Mali',
  moov_ml: 'Moov Money Mali',
  orange_bf: 'Orange Money Burkina',
  moov_bf: 'Moov Money Burkina',
  moneroo_payment_demo: 'Passerelle de démonstration',
};

function getCountry(code) {
  return COUNTRIES[code] || COUNTRIES[DEFAULT_COUNTRY];
}

/** Codes de methodes a proposer sur la page de paiement pour ce pays. */
function methodsFor(code) {
  return getCountry(code).methods;
}

/**
 * Complete un numero saisi localement avec l'indicatif du pays.
 * Un numero deja international est laissé intact.
 */
function normalizePhone(value, countryCode = DEFAULT_COUNTRY) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';

  const { dialCode } = getCountry(countryCode);
  if (digits.startsWith(dialCode)) return digits;

  return `${dialCode}${digits}`;
}

/** Libellé affichable d'une méthode de paiement. */
function methodLabel(method, countryCode = DEFAULT_COUNTRY) {
  if (method && METHOD_LABELS[method]) return METHOD_LABELS[method];
  if (method) return method;
  // Paiement anterieur a l'enregistrement de la methode: on situe au moins le pays
  return `Mobile Money ${getCountry(countryCode).name}`;
}

/**
 * Toutes les ecritures possibles d'un numero saisi sans indication de pays.
 * Sert a retrouver un ticket: le client tape son numero comme il le connait.
 */
function phoneCandidates(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return [];

  const variants = new Set([digits]);
  for (const { dialCode } of Object.values(COUNTRIES)) {
    if (!digits.startsWith(dialCode)) variants.add(`${dialCode}${digits}`);
  }
  return [...variants];
}

module.exports = {
  COUNTRIES,
  DEFAULT_COUNTRY,
  MIN_AMOUNT_XOF,
  MAX_AMOUNT_XOF,
  METHOD_LABELS,
  getCountry,
  methodsFor,
  normalizePhone,
  phoneCandidates,
  methodLabel,
};
