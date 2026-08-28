/**
 * Service gestion d'équipe
 */

import api from '../config/api';

/**
 * Membres ayant accès au compte
 */
export async function getTeam() {
  return api.get('/team');
}

/**
 * Ajoute un membre. Le mot de passe n'est requis que si le compte
 * n'existe pas encore et doit être créé.
 */
export async function addMember(email, password, fullName) {
  return api.post('/team', {
    email,
    password,
    full_name: fullName,
  });
}

/**
 * Retire l'accès d'un membre. Son compte reste, il perd l'accès aux données.
 */
export async function removeMember(membershipId) {
  return api.delete(`/team/${membershipId}`);
}
