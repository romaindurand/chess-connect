import { addMessages, init, locale, _ } from 'svelte-i18n';
import { get } from 'svelte/store';

import en from '$lib/i18n/en.json';
import fr from '$lib/i18n/fr.json';

export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const LANGUAGE_STORAGE_KEY = 'chess-connect-language';

let initialized = false;

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
	return translate(message);
}
