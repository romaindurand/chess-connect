import { describe, it, expect } from 'vitest';
import { moveToIndex, indexToMove, MOVE_SPACE_SIZE } from './move-index';

describe('move-index', () => {
	it('MOVE_SPACE_SIZE is 320', () => {
		expect(MOVE_SPACE_SIZE).toBe(320);
	});

	it('place move round-trips', () => {
		const m = { kind: 'place' as const, piece: 'rook' as const, to: { x: 2, y: 3 } };
		expect(indexToMove(moveToIndex(m))).toEqual(m);
	});

	it('move move round-trips', () => {
		const m = { kind: 'move' as const, from: { x: 0, y: 0 }, to: { x: 3, y: 3 } };
		expect(indexToMove(moveToIndex(m))).toEqual(m);
	});

	it('all 320 indices decode to unique moves', () => {
		const seen = new Set<string>();
		for (let i = 0; i < MOVE_SPACE_SIZE; i++) {
			const key = JSON.stringify(indexToMove(i));
			expect(seen.has(key)).toBe(false);
			seen.add(key);
		}
	});
});
