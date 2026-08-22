/**
 * Taux de commission de l'agregateur (FedaPay, mobile money Benin).
 *
 * Le taux facture est de 1,8 %; on provisionne 2 % en attendant de confirmer
 * la regle d'arrondi sur un ticket a 950 F (1,8 % donne 17,1: arrondi au plus
 * proche ou au superieur, les releves ne permettent pas encore de trancher).
 *
 * Le XOF n'a pas de subdivision: la commission est toujours ramenee au franc.
 */
const COMMISSION_RATE = 0.02;

/**
 * Commission prelevee sur un montant brut, en francs entiers.
 */
function commissionOn(amount) {
  return Math.round(parseFloat(amount || 0) * COMMISSION_RATE);
}

/**
 * Montant reellement encaisse une fois la commission deduite.
 */
function netAmount(amount) {
  const gross = parseFloat(amount || 0);
  return gross - commissionOn(gross);
}

module.exports = {
  COMMISSION_RATE,
  commissionOn,
  netAmount
};
