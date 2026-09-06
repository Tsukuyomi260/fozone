/**
 * Configuration de l'API backend
 */

import { API_URL } from './env';

// Export pour compatibilité avec le code existant
export { API_URL };

/**
 * Récupère le token JWT depuis le localStorage
 */
function getAuthToken() {
  return localStorage.getItem('auth_token');
}

/**
 * Effectue une requête API avec authentification
 */
async function apiRequest(endpoint, options = {}) {
  const token = getAuthToken();
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  // Debug: Log les requêtes DELETE
  if (config.method === 'DELETE') {
    console.log(`[API] DELETE request to: ${API_URL}${endpoint}`);
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);
    
    // Gérer les réponses non-JSON (comme 204 No Content)
    if (response.status === 204) {
      return { success: true };
    }

    // Vérifier le Content-Type avant de parser JSON
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      // Si ce n'est pas du JSON, essayer de parser quand même ou utiliser le texte
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch (e) {
        // Si ce n'est pas du JSON valide, créer un objet d'erreur
        throw new Error(text || `Erreur HTTP ${response.status}: ${response.statusText}`);
      }
    }

    if (!response.ok) {
      // Si erreur d'authentification, nettoyer le localStorage
      if (response.status === 401 || response.status === 403) {
        if (data.error && (data.error.includes('token') || data.error.includes('Token') || data.error.includes('Session expirée') || data.error.includes('Access denied'))) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
          // Rediriger vers login si on est dans le navigateur
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
        }
      }
      
      // Message d'erreur user-friendly (déjà sanitized par le backend)
      // Les erreurs de validation arrivent avec un 'error' générique en anglais
      // et le vrai motif dans 'message'. Afficher le premier laissait
      // l'utilisateur devant un « Validation failed » sans savoir quoi corriger.
      const errorMessage =
        (data.error === 'Validation failed' && data.message) ||
        data.error ||
        'Une erreur est survenue. Veuillez réessayer';
      
      // Logger les détails techniques uniquement en console (pas affichés à l'utilisateur)
      if (process.env.NODE_ENV === 'development' && data._debug) {
        console.error('[API Debug]', data._debug);
      }
      
      const error = new Error(errorMessage);
      error.status = response.status;
      throw error;
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

/**
 * Méthodes HTTP simplifiées
 */
export const api = {
  get: (endpoint) => apiRequest(endpoint, { method: 'GET' }),
  post: (endpoint, data) => apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  put: (endpoint, data) => apiRequest(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (endpoint) => apiRequest(endpoint, { method: 'DELETE' }),
};

export default api;


