import { describe, expect, it } from 'vitest';

import en from '$lib/i18n/en.json';
import fr from '$lib/i18n/fr.json';

function flattenKeys(input: unknown, prefix = ''): string[] {
	if (!input || typeof input !== 'object' || Array.isArray(input)) {
		return prefix ? [prefix] : [];
	}

	return Object.entries(input as Record<string, unknown>).flatMap(([key, value]) => {
		const next = prefix ? `${prefix}.${key}` : key;
		return flattenKeys(value, next);
	});
}

describe('translation dictionaries', () => {
	it('have the same keys in french and english', () => {
		const enKeys = flattenKeys(en).sort();
		const frKeys = flattenKeys(fr).sort();
		expect(frKeys).toEqual(enKeys);
	});

	it('contain critical game header labels', () => {
		expect(en.game.header.history).toBeTypeOf('string');
		expect(en.game.header.rules).toBeTypeOf('string');
		expect(en.game.header.language).toBeTypeOf('string');
		expect(fr.game.header.history).toBeTypeOf('string');
		expect(fr.game.header.rules).toBeTypeOf('string');
		expect(fr.game.header.language).toBeTypeOf('string');
	});
});
