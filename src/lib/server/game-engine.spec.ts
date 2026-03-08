import { describe, expect, it } from 'vitest';

import { applyPlayerMove, createInitialBoard, getPieceMoves } from './game-engine';
import { makeEmptyReserve, type Color, type GameState } from '$lib/types/game';

function makeActiveState(turn: Color = 'white'): GameState {
	const now = Date.now();
	return {
		id: 'game-test',
		status: 'active',
		inviter: { name: 'Alice', joinedAt: now },
		hostColor: 'white',
		players: {
			white: { name: 'Alice', joinedAt: now },
			black: { name: 'Bob', joinedAt: now }
		},
		board: createInitialBoard(),
		reserves: {
			white: makeEmptyReserve(),
			black: makeEmptyReserve()
		},
		turn,
		pliesPlayed: 0,
		winner: null,
		bestOfWinner: null,
		score: {
			white: 0,
			black: 0
		},
		gameNumber: 1,
		bestOf: 3,
		timeControlEnabled: false,
		timeControlPerPlayerSeconds: null,
		timeRemainingMs: null,
		turnStartedAt: null,
		moveHistory: [],
		rematchRequestedBy: null,
		createdAt: now,
		lastActivityAt: now,
		version: 0
	};
}

describe('game-engine placement phase', () => {
	it('authorizes placement during first 6 plies', () => {
		const initial = makeActiveState('white');
		const after = applyPlayerMove(initial, 'white', {
			kind: 'place',
			piece: 'rook',
			to: { x: 1, y: 1 }
		});

		expect(after.board[1][1]?.type).toBe('rook');
		expect(after.reserves.white.rook).toBe(false);
		expect(after.turn).toBe('black');
		expect(after.pliesPlayed).toBe(1);
	});

	it('forbids board movement during first 6 plies', () => {
		const state = makeActiveState('white');
		state.board[2][1] = {
			type: 'rook',
			owner: 'white',
			pawnDirection: -1
		};
		state.reserves.white.rook = false;

		expect(() =>
			applyPlayerMove(state, 'white', {
				kind: 'move',
				from: { x: 1, y: 2 },
				to: { x: 1, y: 1 }
			})
		).toThrow(/placement/i);
	});

	it('sets pawn direction correctly when placed on farthest rank', () => {
		const whiteState = makeActiveState('white');
		const afterWhitePlace = applyPlayerMove(whiteState, 'white', {
			kind: 'place',
			piece: 'pawn',
			to: { x: 1, y: 0 }
		});

		expect(afterWhitePlace.board[0][1]?.pawnDirection).toBe(1);
		expect(getPieceMoves(afterWhitePlace, { x: 1, y: 0 })).toContainEqual({ x: 1, y: 1 });

		const blackState = makeActiveState('black');
		const afterBlackPlace = applyPlayerMove(blackState, 'black', {
			kind: 'place',
			piece: 'pawn',
			to: { x: 2, y: 3 }
		});

		expect(afterBlackPlace.board[3][2]?.pawnDirection).toBe(-1);
		expect(getPieceMoves(afterBlackPlace, { x: 2, y: 3 })).toContainEqual({ x: 2, y: 2 });
	});
});

describe('game-engine movement and capture', () => {
	it('captures enemy piece and returns it to enemy reserve', () => {
		const state = makeActiveState('white');
		state.pliesPlayed = 6;
		state.board[3][0] = { type: 'rook', owner: 'white', pawnDirection: -1 };
		state.board[1][0] = { type: 'knight', owner: 'black', pawnDirection: 1 };
		state.reserves.white.rook = false;
		state.reserves.black.knight = false;

		const after = applyPlayerMove(state, 'white', {
			kind: 'move',
			from: { x: 0, y: 3 },
			to: { x: 0, y: 1 }
		});

		expect(after.board[1][0]?.owner).toBe('white');
		expect(after.reserves.black.knight).toBe(true);
	});

	it('reverses pawn direction when reaching board edge', () => {
		const state = makeActiveState('white');
		state.pliesPlayed = 6;
		state.board[1][1] = { type: 'pawn', owner: 'white', pawnDirection: -1 };
		state.reserves.white.pawn = false;

		const after = applyPlayerMove(state, 'white', {
			kind: 'move',
			from: { x: 1, y: 1 },
			to: { x: 1, y: 0 }
		});

		expect(after.board[0][1]?.pawnDirection).toBe(1);
	});
});

describe('game-engine win condition', () => {
	it('finishes game on aligned row of 4 own pieces', () => {
		const state = makeActiveState('white');
		state.pliesPlayed = 6;
		state.board[0][0] = { type: 'rook', owner: 'white', pawnDirection: -1 };
		state.board[0][1] = { type: 'bishop', owner: 'white', pawnDirection: -1 };
		state.board[0][2] = { type: 'knight', owner: 'white', pawnDirection: -1 };
		state.board[1][3] = { type: 'pawn', owner: 'white', pawnDirection: -1 };
		state.reserves.white.rook = false;
		state.reserves.white.bishop = false;
		state.reserves.white.knight = false;
		state.reserves.white.pawn = false;

		const after = applyPlayerMove(state, 'white', {
			kind: 'move',
			from: { x: 3, y: 1 },
			to: { x: 3, y: 0 }
		});

		expect(after.winner).toBe('white');
		expect(after.status).toBe('finished');
	});
});

describe('piece movement generation', () => {
	it('generates knight L moves without own-capture', () => {
		const state = makeActiveState('white');
		state.board[1][1] = { type: 'knight', owner: 'white', pawnDirection: -1 };
		state.board[3][2] = { type: 'pawn', owner: 'white', pawnDirection: -1 };
		state.board[2][3] = { type: 'pawn', owner: 'black', pawnDirection: 1 };

		const moves = getPieceMoves(state, { x: 1, y: 1 });
		expect(moves).toContainEqual({ x: 3, y: 2 });
		expect(moves).not.toContainEqual({ x: 2, y: 3 });
	});
});
