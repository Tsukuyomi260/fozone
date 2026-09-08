/**
 * Pays couverts par la plateforme, côté navigateur.
 *
 * Doit rester aligné avec backend/src/config/countries.js : l'indicatif sert
 * ici à compléter le numéro saisi par le client, et le backend le renormalise
 * avant de l'envoyer à Moneroo.
 */

export const COUNTRIES = {
  BJ: { code: 'BJ', name: 'Bénin', dialCode: '229', placeholder: '01 53 48 98 46' },
  CI: { code: 'CI', name: "Côte d'Ivoire", dialCode: '225', placeholder: '07 09 17 96 94' },
  TG: { code: 'TG', name: 'Togo', dialCode: '228', placeholder: '90 00 00 00' },
  SN: { code: 'SN', name: 'Sénégal', dialCode: '221', placeholder: '77 000 00 00' },
  ML: { code: 'ML', name: 'Mali', dialCode: '223', placeholder: '70 00 00 00' },
  BF: { code: 'BF', name: 'Burkina Faso', dialCode: '226', placeholder: '70 00 00 00' },
};

export const COUNTRY_LIST = Object.values(COUNTRIES);

export const DEFAULT_COUNTRY = 'BJ';

export function getCountry(code) {
  return COUNTRIES[code] || COUNTRIES[DEFAULT_COUNTRY];
}

/**
 * Complète un numéro local avec l'indicatif du pays.
 * Un numéro déjà international est laissé intact.
 */
export function normalizePhone(value, countryCode = DEFAULT_COUNTRY) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';

  const { dialCode } = getCountry(countryCode);
  if (digits.startsWith(dialCode)) return digits;

  return `${dialCode}${digits}`;
}

/** Numéro affichable : +229 01 53 48 98 46 */
export function formatPhoneDisplay(value, countryCode = DEFAULT_COUNTRY) {
  const digits = normalizePhone(value, countryCode);
  return digits ? `+${digits}` : '';
}
