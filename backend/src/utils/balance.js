/**
 * Calcul du solde d'un promoteur.
 *
 * Le solde n'est jamais stocke. Il est derive a chaque lecture:
 *
 *   solde = somme(net_to_tenant des paiements 'completed')
 *         - somme(amount des retraits 'approved' ou 'paid')
 *
 * Un solde stocke finit par deriver: double credit sur rejeu de webhook,
 * crash entre deux ecritures, correction manuelle en base. Un solde derive
 * ne peut pas desynchroniser de la verite.
 *
 * Les retraits 'approved' (valides mais virement pas encore confirme) sont
 * deja deduits: sans cela, le promoteur pourrait demander deux fois les
 * memes fonds pendant que le premier virement est en cours.
 */

const { supabaseAdmin } = require('../config/database');

/**
 * Retourne le detail du solde d'un promoteur.
 *
 * @param {string} ownerId
 * @returns {Promise<{earned:number, withdrawn:number, pending:number, available:number}>}
 */
async function getBalance(ownerId) {
  // Ce qui a ete gagne: net promoteur sur les ventes abouties
  const { data: payments, error: paymentsError } = await supabaseAdmin
    .from('payments')
    .select('net_to_tenant')
    .eq('owner_id', ownerId)
    .eq('status', 'completed');

  if (paymentsError) {
    throw new Error('Failed to load earnings: ' + paymentsError.message);
  }

  // Ce qui est sorti ou engage
  const { data: withdrawals, error: withdrawalsError } = await supabaseAdmin
    .from('withdrawals')
    .select('amount, status')
    .eq('owner_id', ownerId)
    .in('status', ['approved', 'paid']);

  if (withdrawalsError) {
    throw new Error('Failed to load withdrawals: ' + withdrawalsError.message);
  }

  const earned = (payments || []).reduce(
    (sum, p) => sum + parseFloat(p.net_to_tenant || 0),
    0
  );

  // 'paid' = virement effectue, 'approved' = valide, virement en cours.
  // Les deux immobilisent les fonds.
  const withdrawn = (withdrawals || [])
    .filter((w) => w.status === 'paid')
    .reduce((sum, w) => sum + parseFloat(w.amount || 0), 0);

  const pending = (withdrawals || [])
    .filter((w) => w.status === 'approved')
    .reduce((sum, w) => sum + parseFloat(w.amount || 0), 0);

  return {
    earned,
    withdrawn,
    pending,
    available: earned - withdrawn - pending
  };
}

module.exports = { getBalance };
