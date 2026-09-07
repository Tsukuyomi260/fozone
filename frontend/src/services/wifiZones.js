/**
 * Service pour la gestion des zones Wi-Fi
 */

import api from '../config/api';
import { getApiUrl } from '../config/env';

// Liste des zones gardée en mémoire le temps de naviguer : Dashboard, Tarifs,
// Tickets et Compta la redemandaient chacune à leur ouverture.
//
// Liée au jeton : changer de compte dans le même onglet repart à vide.
// Toute création, modification ou suppression vide le cache.
const ZONES_TTL_MS = 60 * 1000;
let zonesCache = null;

function invalidateZones() {
  zonesCache = null;
}

/**
 * Récupère toutes les zones Wi-Fi
 */
export function getWifiZones() {
  const token = localStorage.getItem('auth_token');

  if (!zonesCache || zonesCache.token !== token || zonesCache.expires <= Date.now()) {
    const promise = api.get('/wifi-zones');
    zonesCache = { token, promise, expires: Date.now() + ZONES_TTL_MS };

    // Un échec ne doit pas rester en cache
    promise.catch(() => {
      if (zonesCache?.promise === promise) invalidateZones();
    });
  }

  // Copie du tableau : une page qui le modifie ne doit pas altérer celui
  // que recevra la suivante.
  return zonesCache.promise.then((response) => ({
    ...response,
    zones: [...(response.zones || [])],
  }));
}

/**
 * Récupère une zone Wi-Fi par ID
 */
export async function getWifiZoneById(id) {
  return api.get(`/wifi-zones/${id}`);
}

/**
 * Crée une nouvelle zone Wi-Fi
 */
export async function createWifiZone(zoneData) {
  try {
    return await api.post('/wifi-zones', zoneData);
  } finally {
    invalidateZones();
  }
}

/**
 * Met à jour une zone Wi-Fi
 */
export async function updateWifiZone(id, zoneData) {
  try {
    return await api.put(`/wifi-zones/${id}`, zoneData);
  } finally {
    invalidateZones();
  }
}

/**
 * Supprime une zone Wi-Fi
 */
export async function deleteWifiZone(id) {
  try {
    return await api.delete(`/wifi-zones/${id}`);
  } finally {
    invalidateZones();
  }
}

/**
 * Récupère les informations publiques d'une zone Wi-Fi (route publique, pas d'auth)
 */
export async function getPublicWifiZoneById(id) {
  const response = await fetch(getApiUrl(`wifi-zones/public/${id}`), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erreur lors de la récupération de la zone');
  }

  return response.json();
}


