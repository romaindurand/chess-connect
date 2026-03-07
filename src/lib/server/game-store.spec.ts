import { describe, expect, it } from 'vitest';

import { createGame, getGameOrThrow, joinGame, playMove } from './game-store';

describe('game-store time control', () => {
	it('creates a timed game with clocks initialized per player', () => {
		const { state } = createGame('Alice', { timeLimitMinutes: 5 });

		expect(state.timeControlEnabled).toBe(true);
		expect(state.timeControlPerPlayerSeconds).toBe(300);
		expect(state.timeRemainingMs).toEqual({ white: 300_000, black: 300_000 });
		expect(state.turnStartedAt).toBeNull();
	});

	it('starts the turn clock when the second player joins', async () => {
		const { state } = createGame('Alice', { timeLimitMinutes: 3 });
		await joinGame(state.id, 'Bob');
		const record = getGameOrThrow(state.id);

		expect(record.state.status).toBe('active');
		expect(record.state.turnStartedAt).not.toBeNull();
	});

	it('loses on time when current player has no time left before move validation', async () => {
		const { state, token: hostToken } = createGame('Alice', { timeLimitMinutes: 1 });
		const joinResult = await joinGame(state.id, 'Bob');
		const record = getGameOrThrow(state.id);

		const hostColor = record.state.hostColor;
		expect(hostColor === 'white' || hostColor === 'black').toBe(true);

		const whiteToken = hostColor === 'white' ? hostToken : joinResult.token;

		record.state.turn = 'white';
		record.state.turnStartedAt = Date.now() - 61_000;
		if (record.state.timeRemainingMs) {
			record.state.timeRemainingMs.white = 60_000;
		}

		await playMove(state.id, whiteToken, {
			kind: 'place',
			piece: 'pawn',
			to: { x: 0, y: 0 }
		});

		expect(record.state.status).toBe('finished');
		expect(record.state.winner).toBe('black');
		expect(record.state.timeRemainingMs?.white).toBe(0);
		expect(record.state.board[0][0]).toBeNull();
	});
});
