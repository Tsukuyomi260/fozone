/**
 * Service pour la gestion des tickets
 */

import api from '../config/api';
import { getApiUrl } from '../config/env';

/**
 * Récupère les tickets d'une zone Wi-Fi
 */
export async function getTicketsByZone(zoneId, params = {}) {
  const queryParams = new URLSearchParams(params).toString();
  return api.get(`/tickets/zone/${zoneId}${queryParams ? `?${queryParams}` : ''}`);
}

/**
 * Importe des tickets depuis un fichier CSV
 * @param {string} zoneId - ID de la zone WiFi
 * @param {File} csvFile - Fichier CSV à importer
 * @param {string} pricingId - ID du tarif (optionnel)
 */
export async function importTickets(zoneId, csvFile, pricingId = null) {
  const formData = new FormData();
  formData.append('csv', csvFile);
  if (pricingId) {
    formData.append('pricing_id', pricingId);
  }

  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(
    getApiUrl(`tickets/zone/${zoneId}/import`),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erreur lors de l\'import');
  }

  return response.json();
}

/**
 * Récupère les statistiques de tickets d'une zone
 */
export async function getTicketStats(zoneId) {
  return api.get(`/tickets/zone/${zoneId}/stats`);
}

/**
 * Tarifs dont le stock de tickets est bas, toutes zones confondues.
 * Alimente la cloche de notification.
 */
export async function getStockAlerts() {
  return api.get('/tickets/alerts');
}

/**
 * Rattache tous les tickets libres d'un profil MikroTik à un tarif.
 * Sans tarif, un ticket n'est vendable par aucun forfait.
 */
export async function linkProfileToPricing(zoneId, profile, pricingId) {
  return api.put(`/tickets/zone/${zoneId}/link-profile`, {
    profile,
    pricing_id: pricingId,
  });
}

/**
 * Supprime un ticket spécifique
 */
export async function deleteTicket(ticketId) {
  return api.delete(`/tickets/${ticketId}`);
}

/**
 * Supprime tous les tickets d'une zone
 */
export async function deleteAllTickets(zoneId) {
  return api.delete(`/tickets/zone/${zoneId}/all`);
}


