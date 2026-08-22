/**
 * Service pour la gestion des paiements
 */

import api from '../config/api';
import { getApiUrl } from '../config/env';

/**
 * Crée une intention de paiement (route publique)
 */
export async function createPaymentIntent(paymentData) {
  // Route publique, pas besoin du token
  const response = await fetch(getApiUrl('payments/intent'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(paymentData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erreur lors de la création du paiement');
  }

  return response.json();
}

/**
 * Récupère le statut d'un paiement (route publique)
 */
export async function getPaymentStatus(paymentId) {
  const response = await fetch(getApiUrl(`payments/${paymentId}`), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erreur lors de la récupération du paiement');
  }

  return response.json();
}

/**
 * Retrouve le dernier ticket acheté depuis un numéro de téléphone (route publique)
 */
export async function getPaymentByPhone(phone) {
  const response = await fetch(getApiUrl(`payments/lookup/${encodeURIComponent(phone)}`), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Aucun ticket trouvé pour ce numéro');
  }

  return response.json();
}

/**
 * Récupère les paiements d'une zone Wi-Fi (admin)
 */
export async function getPaymentsByZone(zoneId, params = {}) {
  const queryParams = new URLSearchParams(params).toString();
  return api.get(`/payments/zone/${zoneId}${queryParams ? `?${queryParams}` : ''}`);
}


