import { describe, expect, it } from 'vitest';
import { listNonDefaultGameOptions } from '$lib/game-options';

describe('game options listing', () => {
	it('returns only non-default options', () => {
		expect(listNonDefaultGameOptions({ timeLimitMinutes: null })).toEqual([]);
		expect(listNonDefaultGameOptions({ timeLimitMinutes: 5 })).toEqual(['Time limit minutes: 5 min']);
	});

	it('includes future options automatically when not at default', () => {
		const options = {
			timeLimitMinutes: null,
			allowTakeback: true,
			maxHints: 3
		};
		expect(listNonDefaultGameOptions(options)).toEqual([
			'Allow takeback: Oui',
			'Max hints: 3'
		]);
	});
});
