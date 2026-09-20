/**
 * Thème clair/sombre, source unique.
 *
 * La classe `dark` est posée sur `<html>` par un script bloquant placé dans
 * index.html, AVANT le premier pixel. Sans lui, une page ouverte depuis un
 * lien direct s'affichait en clair puis basculait au montage de React.
 *
 * Ce module ne recalcule donc jamais le thème au démarrage : il lit la
 * décision déjà prise par le script, dans le DOM. L'état React et la classe
 * du document ne peuvent ainsi pas diverger.
 *
 * Toute modification ici doit rester alignée avec le script de index.html :
 * même clé, même repli sur la préférence système.
 */

import { useState, useEffect } from 'react';

export const THEME_KEY = 'darkMode';

const DARK_BG = '#080B0A';
const LIGHT_BG = '#F9FAFB';

/**
 * Le thème effectivement appliqué au document.
 */
export function isDarkApplied() {
  return document.documentElement.classList.contains('dark');
}

/**
 * Applique un thème et le mémorise.
 * La couleur de la barre d'adresse suit, sinon elle reste blanche
 * au-dessus d'une page sombre sur Android.
 */
export function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', dark);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? DARK_BG : LIGHT_BG);

  try {
    localStorage.setItem(THEME_KEY, String(dark));
  } catch {
    // Navigation privée ou stockage bloqué: le thème vaut pour cette visite
  }
}

/**
 * Renvoie [darkMode, toggleDarkMode].
 * Remplace la logique qui était dupliquée dans Layout et AdminLayout.
 */
export function useTheme() {
  const [darkMode, setDarkMode] = useState(isDarkApplied);

  // Resynchronise si le document a été modifié ailleurs (montage d'un autre
  // layout, bascule depuis un autre composant).
  useEffect(() => {
    const applied = isDarkApplied();
    if (applied !== darkMode) setDarkMode(applied);
  }, [darkMode]);

  const toggleDarkMode = () => {
    const next = !isDarkApplied();
    applyTheme(next);
    setDarkMode(next);
  };

  return [darkMode, toggleDarkMode];
}
