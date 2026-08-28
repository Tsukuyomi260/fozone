/**
 * Service administration plateforme (super-admin uniquement)
 */

import api from '../config/api';

/**
 * Liste des promoteurs avec activité et solde
 */
export async function getTenants() {
  return api.get('/admin/tenants');
}

/**
 * Active ou désactive un promoteur. Un compte inactif ne peut ni se
 * connecter ni vendre.
 */
export async function setTenantActive(id, isActive) {
  return api.put(`/admin/tenants/${id}/active`, { is_active: isActive });
}

/**
 * Demandes de retrait, optionnellement filtrées par statut
 */
export async function getWithdrawals(status) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return api.get(`/admin/withdrawals${query}`);
}

/**
 * Valide une demande : les fonds sont engagés, le virement reste à faire
 */
export async function approveWithdrawal(id, note) {
  return api.put(`/admin/withdrawals/${id}/approve`, { note });
}

/**
 * Confirme que le virement Mobile Money a été envoyé
 */
export async function markWithdrawalPaid(id, note) {
  return api.put(`/admin/withdrawals/${id}/paid`, { note });
}

/**
 * Refuse une demande, avec motif
 */
export async function rejectWithdrawal(id, note) {
  return api.put(`/admin/withdrawals/${id}/reject`, { note });
}
