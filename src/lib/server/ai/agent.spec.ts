import { describe, expect, it } from 'vitest';

import { applyPlayerMove, createInitialBoard } from '$lib/server/game-engine';
import { makeEmptyReserve, type Color, type GameState } from '$lib/types/game';

import { chooseAiMove } from './agent';
import { encodeState } from './encoder';
import { runMcts, type ModelAdapter } from './mcts';

function makeActiveState(turn: Color = 'white'): GameState {
	const now = Date.now();
	return {
		id: 'ai-test',
		status: 'active',
		inviter: { name: 'Alice', joinedAt: now },
		hostColor: 'white',
		options: { timeLimitMinutes: null, opponentType: 'ai', hostColor: 'white' },
		players: {
			white: { name: 'Alice', joinedAt: now },
			black: { name: 'IA', joinedAt: now }
		},
		board: createInitialBoard(),
		reserves: { white: makeEmptyReserve(), black: makeEmptyReserve() },
		turn,
		pliesPlayed: 0,
		winner: null,
		bestOfWinner: null,
		score: { white: 0, black: 0 },
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

describe('encoder', () => {
	it('produces a flat Float32Array from game state', () => {
		const state = makeActiveState('white');
		const encoded = encodeState(state, 'white');

		expect(encoded).toBeInstanceOf(Float32Array);
		expect(encoded.length).toBeGreaterThan(0);
	});

	it('produces distinct encodings for different states', () => {
		const before = makeActiveState('white');
		const after = applyPlayerMove(before, 'white', {
			kind: 'place',
			piece: 'rook',
			to: { x: 1, y: 1 }
		});

		const encBefore = encodeState(before, 'white');
		const encAfter = encodeState(after, 'white');

		const differs = encBefore.some((value, i) => value !== encAfter[i]);
		expect(differs).toBe(true);
	});
});

describe('mcts', () => {
	it('returns a valid move from the initial position', async () => {
		const state = makeActiveState('white');
		const move = await runMcts(state, 'white', { simulations: 20 });

		expect(move).not.toBeNull();
		expect(move?.kind).toBe('place');
	});

	it('detects a winning move when available', async () => {
		const state = makeActiveState('white');
		state.pliesPlayed = 7;
		state.board[0][0] = { type: 'rook', owner: 'white', pawnDirection: -1 };
		state.board[0][1] = { type: 'rook', owner: 'white', pawnDirection: -1 };
		state.board[0][2] = { type: 'rook', owner: 'white', pawnDirection: -1 };
		state.board[1][3] = { type: 'rook', owner: 'white', pawnDirection: -1 };
		state.reserves.white.rook = false;
		state.reserves.white.pawn = false;
		state.reserves.white.knight = false;
		state.reserves.white.bishop = false;

		const move = await runMcts(state, 'white', { simulations: 50 });

		expect(move).not.toBeNull();
		const after = applyPlayerMove(state, 'white', move!);
		expect(after.winner).toBe('white');
	});

	it('uses model adapter value head instead of rollout', async () => {
		const state = makeActiveState('white');
		const mockAdapter: ModelAdapter = {
			priors: async (_s, moves) => moves.map(() => 1 / moves.length),
			value: async (_s, _color) => 0.9
		};
		const move = await runMcts(state, 'white', { simulations: 10, modelAdapter: mockAdapter });
		expect(move).not.toBeNull();
	});
});

describe('chooseAiMove', () => {
	it('returns a legal move in opening position', async () => {
		const state = makeActiveState('white');
		const move = await chooseAiMove(state, 'white');

		expect(move).not.toBeNull();
		expect(move?.kind).toBe('place');
	});

	it('does not return null when there are legal moves', async () => {
		const state = makeActiveState('black');
		state.pliesPlayed = 1;
		state.board[0][0] = { type: 'rook', owner: 'white', pawnDirection: -1 };
		state.reserves.white.rook = false;

		const move = await chooseAiMove(state, 'black');
		expect(move).not.toBeNull();
	});
});
