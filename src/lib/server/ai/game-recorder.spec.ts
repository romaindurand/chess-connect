import { describe, expect, it } from 'vitest';

import type { GameState } from '$lib/types/game';

import { extractMovesFromHistory } from './game-recorder';
import { makeActiveState } from './test-helpers';

describe('game recorder', () => {
	it('extracts place and move actions from move history', () => {
		const state = makeActiveState() as GameState;
		state.moveHistory = [
			{
				ply: 1,
				notation: '1. R@A1',
				before: {
					board: state.board,
					reserves: state.reserves,
					turn: 'white',
					pliesPlayed: 0,
					status: 'active',
					winner: null
				},
				after: {
					board: state.board,
					reserves: state.reserves,
					turn: 'black',
					pliesPlayed: 1,
					status: 'active',
					winner: null
				},
				transition: {
					moverColor: 'white',
					toBoard: { x: 0, y: 0 },
					fromReserve: { owner: 'white', piece: 'rook' },
					sound: 'move'
				}
			},
			{
				ply: 2,
				notation: '1... NA2-B4',
				before: {
					board: state.board,
					reserves: state.reserves,
					turn: 'black',
					pliesPlayed: 1,
					status: 'active',
					winner: null
				},
				after: {
					board: state.board,
					reserves: state.reserves,
					turn: 'white',
					pliesPlayed: 2,
					status: 'active',
					winner: null
				},
				transition: {
					moverColor: 'black',
					fromBoard: { x: 0, y: 1 },
					toBoard: { x: 1, y: 3 },
					sound: 'move'
				}
			}
		];

		const moves = extractMovesFromHistory(state);
		expect(moves).toHaveLength(2);
		expect(moves[0]).toEqual({
			color: 'white',
			move: { kind: 'place', piece: 'rook', to: { x: 0, y: 0 } }
		});
		expect(moves[1]).toEqual({
			color: 'black',
			move: { kind: 'move', from: { x: 0, y: 1 }, to: { x: 1, y: 3 } }
		});
	});
});
