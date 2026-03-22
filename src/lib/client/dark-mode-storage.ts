/**
 * Gestion du stockage de la préférence dark mode dans localStorage
 * Approche SSR-safe pour éviter les erreurs "window is not defined"
 */

const DARK_MODE_KEY = 'dark-mode';

/**
 * Récupère la préférence dark mode depuis localStorage
 * @returns true si le dark mode est activé, false sinon
 */
export function getDarkModePreference(): boolean {
	if (typeof window === 'undefined') {
		return false; // Défaut SSR
	}
	const stored = localStorage.getItem(DARK_MODE_KEY);
	return stored === 'true';
}

/**
 * Définit la préférence dark mode et la sauvegarde dans localStorage
 * @param isDark true pour activer le dark mode, false pour le mode clair
 */
export function setDarkModePreference(isDark: boolean): void {
	if (typeof window === 'undefined') {
		return; // Pas d'accès à localStorage côté serveur
	}
	localStorage.setItem(DARK_MODE_KEY, isDark ? 'true' : 'false');
}

/**
 * Bascule la préférence dark mode
 * @returns la nouvelle valeur (true si dark mode est maintenant activé)
 */
export function toggleDarkMode(): boolean {
	const current = getDarkModePreference();
	const newValue = !current;
	setDarkModePreference(newValue);
	return newValue;
}
