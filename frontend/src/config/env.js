/**
 * Configuration des variables d'environnement
 * Centralise l'accès aux variables d'environnement du frontend
 */

// URL de base de l'API backend
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// URL de base du frontend (pour générer les liens publics)
export const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5174');

// Fonction helper pour construire une URL complète vers une route frontend
export const getFrontendUrl = (path = '') => {
  // Enlever le slash initial si présent pour éviter les doubles slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${FRONTEND_URL}/${cleanPath}`;
};

// Fonction helper pour construire une URL complète vers l'API
export const getApiUrl = (endpoint = '') => {
  // Enlever le slash initial si présent pour éviter les doubles slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_URL}/${cleanEndpoint}`;
};
