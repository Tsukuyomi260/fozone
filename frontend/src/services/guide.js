/**
 * Accès au guide « Lancer sa Wi-Fi Zone » (super-admin uniquement).
 *
 * Chaque acheteur reçoit un exemplaire marqué à son nom et un lien qui lui
 * est propre. Le serveur fabrique le fichier, le dépose et enregistre la
 * licence : ici on ne fait que demander.
 */

import api from '../config/api';

/** Licences, pays proposés, provenances et totaux. */
export async function getLicences() {
  return api.get('/ebook/licences');
}

/**
 * Crée un accès. Le serveur calcule la référence, vérifie le numéro selon le
 * pays, marque l'exemplaire et renvoie le lien à envoyer.
 */
export async function creerAcces(donnees) {
  return api.post('/ebook/licences', donnees);
}

/** Coupe l'accès, ou le rétablit s'il était déjà coupé. */
export async function revoquerAcces(id, motif) {
  return api.post(`/ebook/licences/${id}/revoquer`, { motif });
}

/** Rend toutes les places : l'acheteur pourra réenregistrer ses appareils. */
export async function libererAppareils(id) {
  return api.post(`/ebook/licences/${id}/liberer`, {});
}

/** Efface le mot de passe : l'acheteur en choisira un nouveau. */
export async function oublierMotDePasse(id) {
  return api.post(`/ebook/licences/${id}/oublier-mot-de-passe`, {});
}

/** Remplace le fichier par la version actuelle du guide, même lien. */
export async function regenererExemplaire(id) {
  return api.post(`/ebook/licences/${id}/regenerer`, {});
}

/** Les appareils enregistrés pour un exemplaire. */
export async function getAppareils(id) {
  return api.get(`/ebook/licences/${id}/appareils`);
}
