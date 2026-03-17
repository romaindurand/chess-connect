import { addMessages, init, locale, _ } from 'svelte-i18n';
import { get } from 'svelte/store';

import en from '$lib/i18n/en.json';
import fr from '$lib/i18n/fr.json';

export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const LANGUAGE_STORAGE_KEY = 'chess-connect-language';

let initialized = false;

const SERVER_ERROR_KEYS: Record<string, string> = {
	'Payload invalide': 'errors.invalidPayload',
	'Le nom est obligatoire': 'errors.nameRequired',
	'Le nom doit contenir entre 2 et 24 caractères': 'errors.nameLength',
	"Le type d'adversaire est invalide": 'errors.invalidOpponentType',
	'La couleur choisie est invalide': 'errors.invalidHostColor',
	"Le niveau d'ordinateur est invalide": 'errors.invalidAiDifficulty',
	"L'option d'entraînement ordinateur est invalide": 'errors.invalidAllowAiTrainingData',
	'La limite de temps doit être un entier': 'errors.timeLimitInteger',
	'La limite de temps doit être entre 1 et 30 minutes': 'errors.timeLimitRange',
	'Le nombre de manches doit être un entier': 'errors.roundLimitInteger',
	'Le nombre de manches doit être impair et strictement positif': 'errors.roundLimitOddPositive',
	'Erreur de création de partie': 'errors.createGameError',
	'Erreur de lecture de partie': 'errors.readGameError',
	"Type d'action inconnu": 'errors.invalidActionType',
	'Action impossible': 'errors.actionImpossible',
	'Session joueur manquante': 'errors.missingPlayerSession',
	"La partie n'est pas active": 'errors.gameNotActive',
	"Ce n'est pas votre tour": 'errors.notYourTurn',
	'La partie attend encore un joueur': 'errors.waitingForPlayer',
	'La partie est déjà terminée': 'errors.gameAlreadyFinished',
	'Durant les 6 premiers tours, seul le placement est autorisé': 'errors.openingPlacementOnly',
	'Pièce indisponible dans la réserve': 'errors.pieceUnavailable',
	'Case invalide': 'errors.invalidCell',
	'Case déjà occupée': 'errors.cellOccupied',
	'Pièce de départ invalide': 'errors.invalidStartPiece',
	'Déplacement illégal': 'errors.illegalMove',
	'Couleur hote indisponible': 'errors.hostColorUnavailable',
	'Deux joueurs sont requis pour lancer la manche suivante': 'errors.twoPlayersRequired',
	'Partie introuvable': 'common.gameNotFound',
	'La partie est déjà démarrée': 'errors.gameAlreadyStarted',
	'Session joueur invalide': 'errors.invalidPlayerSession',
	"La manche en cours n'est pas terminée": 'errors.roundNotFinished',
	'Le match est déjà terminé': 'errors.matchFinished',
	'Impossible de créer la partie': 'errors.createGameFailed',
	'Impossible de rejoindre la partie': 'errors.joinGameFailed',
	'Impossible de proposer une revanche': 'errors.requestRematchFailed',
	'Impossible de démarrer la revanche': 'errors.startRematchFailed',
	'Impossible de charger la partie': 'errors.loadGameFailed',
	'Coup invalide': 'errors.invalidMove',
	'Erreur inattendue': 'errors.unexpected'
};

export function initI18n(): void {
	if (initialized) {
		return;
	}

	addMessages('fr', fr);
	addMessages('en', en);

	init({
		fallbackLocale: 'fr',
		initialLocale: 'fr'
	});

	initialized = true;
}

export function isSupportedLanguage(value: string): value is SupportedLanguage {
	return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function getStoredLanguage(): SupportedLanguage | null {
	if (typeof localStorage === 'undefined') {
		return null;
	}
	const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
	if (!stored || !isSupportedLanguage(stored)) {
		return null;
	}
	return stored;
}

export function getNavigatorLanguage(): SupportedLanguage {
	if (typeof navigator === 'undefined') {
		return 'fr';
	}
	const raw = navigator.language.toLowerCase();
	return raw.startsWith('fr') ? 'fr' : 'en';
}

export function resolveInitialLanguage(): SupportedLanguage {
	return getStoredLanguage() ?? getNavigatorLanguage();
}

export function setLanguage(nextLanguage: SupportedLanguage): void {
	locale.set(nextLanguage);
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
	}
}

export function translate(key: string, values?: Record<string, unknown>): string {
	const formatter = get(_);
	if (!formatter) {
		return key;
	}
	const interpolationValues = values as
		| Record<string, string | number | boolean | Date | null | undefined>
		| undefined;
	return formatter(
		key,
		interpolationValues ? { values: interpolationValues } : undefined
	) as string;
}

export function localizeServerError(message: string): string {
	const translationKey = SERVER_ERROR_KEYS[message];
	if (!translationKey) {
		return message;
	}
	return translate(translationKey);
}
