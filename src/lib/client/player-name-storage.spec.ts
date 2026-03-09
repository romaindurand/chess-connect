import { describe, expect, it } from 'vitest';
import { loadPlayerName, savePlayerName } from '$lib/client/player-name-storage';

function createStorage(initial: Record<string, string> = {}): Pick<Storage, 'getItem' | 'setItem'> {
	const store = new Map<string, string>(Object.entries(initial));
	return {
		getItem(key: string) {
			return store.get(key) ?? null;
		},
		setItem(key: string, value: string) {
			store.set(key, value);
		}
	};
}

describe('player name storage', () => {
	it('loads a trimmed stored name', () => {
		const storage = createStorage({ 'chess-connect.player-name': '  Romain  ' });
		expect(loadPlayerName(storage)).toBe('Romain');
	});

	it('saves only non-empty trimmed names', () => {
		const storage = createStorage();
		savePlayerName('  Alice  ', storage);
		expect(loadPlayerName(storage)).toBe('Alice');

		savePlayerName('   ', storage);
		expect(loadPlayerName(storage)).toBe('Alice');
	});
});
