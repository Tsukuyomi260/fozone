/**
 * Commission de la plateforme Fo-Zone sur chaque ticket vendu.
 *
 * Modele: 5 % du montant brut, commission agregateur INCLUSE dedans.
 *
 *   ticket 200 F
 *     -> platform_fee   = 10 F  (5 %)  preleve par Fo-Zone
 *     -> net_to_tenant  = 190 F         verse au promoteur
 *     -> sur les 10 F, l'agregateur prend 4 F (2 %, voir commission.js)
 *     -> marge nette Fo-Zone = 6 F
 *
 * Le promoteur ne supporte donc qu'un seul prelevement, celui de 5 %. La
 * commission agregateur est un cout de Fo-Zone, jamais deduite en plus.
 *
 * Comme pour commission.js, le XOF n'a pas de subdivision: tout est ramene
 * au franc entier, et l'arrondi se fait PAR PAIEMENT, jamais sur une somme.
 * Arrondir une somme donnerait un total different de l'addition des lignes
 * affichees au promoteur.
 */
const PLATFORM_FEE_RATE = 0.05;

/**
 * Commission plateforme sur un montant brut, en francs entiers.
 */
function platformFeeOn(amount) {
  return Math.round(parseFloat(amount || 0) * PLATFORM_FEE_RATE);
}

/**
 * Ce que le promoteur touche reellement une fois la commission plateforme
 * deduite. C'est ce montant qui alimente son solde.
 */
function netToTenant(amount) {
  const gross = parseFloat(amount || 0);
  return gross - platformFeeOn(gross);
}

module.exports = {
  PLATFORM_FEE_RATE,
  platformFeeOn,
  netToTenant
};
