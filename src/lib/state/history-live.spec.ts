import { describe, expect, it } from 'vitest';
import { getSnapshotForHistoryStep, shouldFollowLiveEdge } from '$lib/state/history-live';
import type { MoveHistoryEntry } from '$lib/types/game';

function makeEntry(ply: number): MoveHistoryEntry {
	const emptyBoard = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => null));
	const reserves = {
		white: { pawn: true, rook: true, knight: true, bishop: true },
		black: { pawn: true, rook: true, knight: true, bishop: true }
	};

	return {
		ply,
		notation: `${Math.ceil(ply / 2)}. P@A1`,
		before: {
			board: emptyBoard,
			reserves,
			turn: 'white',
			pliesPlayed: ply - 1,
			status: 'active',
			winner: null
		},
		after: {
			board: emptyBoard,
			reserves,
			turn: 'black',
			pliesPlayed: ply,
			status: 'active',
			winner: null
		},
		transition: {
			moverColor: 'white',
			toBoard: { x: 0, y: 0 },
			sound: 'move'
		}
	};
}

describe('history live helpers', () => {
	it('follows live edge only when head is on previous end', () => {
		expect(shouldFollowLiveEdge(null, 2)).toBe(false);
		expect(shouldFollowLiveEdge(1, 2)).toBe(false);
		expect(shouldFollowLiveEdge(2, 2)).toBe(true);
	});

	it('returns null snapshot at live edge to use live game state', () => {
		const entries = [makeEntry(1), makeEntry(2)];
		expect(getSnapshotForHistoryStep(entries, 0)).toEqual(entries[0].before);
		expect(getSnapshotForHistoryStep(entries, 1)).toEqual(entries[0].after);
		expect(getSnapshotForHistoryStep(entries, 2)).toBeNull();
	});
});
