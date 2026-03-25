/**
 * Gestion du stockage de la préférence son dans localStorage
 * Approche SSR-safe pour éviter les erreurs "window is not defined"
 */

const SOUND_KEY = 'sound-enabled';

/**
 * Récupère la préférence son depuis localStorage
 * @returns true si le son est activé (défaut), false si désactivé
 */
export function getSoundPreference(): boolean {
	if (typeof window === 'undefined') {
		return true; // Défaut SSR
	}
	const stored = localStorage.getItem(SOUND_KEY);
	if (stored === null) return true; // activé par défaut
	return stored !== 'false';
}

/**
 * Définit la préférence son et la sauvegarde dans localStorage
 * @param enabled true pour activer le son, false pour le désactiver
 */
export function setSoundPreference(enabled: boolean): void {
	if (typeof window === 'undefined') {
		return; // Pas d'accès à localStorage côté serveur
	}
	localStorage.setItem(SOUND_KEY, enabled ? 'true' : 'false');
}
