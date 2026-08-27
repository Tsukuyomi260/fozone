/**
 * Service solde et retraits (promoteur)
 */

import api from '../config/api';

/**
 * Solde du promoteur connecté
 */
export async function getBalance() {
  return api.get('/wallet/balance');
}

/**
 * Historique de ses demandes de retrait
 */
export async function getMyWithdrawals() {
  return api.get('/wallet/withdrawals');
}

/**
 * Nouvelle demande de retrait
 */
export async function requestWithdrawal(amount, payoutPhone) {
  return api.post('/wallet/withdrawals', {
    amount,
    payout_phone: payoutPhone,
  });
}
