import { describe, expect, it } from 'vitest';

import {
	acceptRematch,
	createGame,
	getGameOrThrow,
	joinGame,
	playMove,
	requestRematch,
	viewerRoleFromToken
} from './game-store';

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

	it('alternates colors between players on each accepted rematch', async () => {
		const { state, token: hostToken } = createGame('Alice');
		const joinResult = await joinGame(state.id, 'Bob');
		const playerToken = joinResult.token;
		const record = getGameOrThrow(state.id);

		const initialHostColor = record.state.hostColor;
		expect(initialHostColor === 'white' || initialHostColor === 'black').toBe(true);
		if (!initialHostColor) {
			throw new Error('host color should be assigned after join');
		}

		for (let index = 0; index < 2; index += 1) {
			const currentHostColor = record.state.hostColor;
			if (!currentHostColor) {
				throw new Error('host color should exist before rematch');
			}

			record.state.status = 'finished';
			record.state.winner = oppositeColor(currentHostColor);
			record.state.rematchRequestedBy = null;

			await requestRematch(state.id, hostToken);
			await acceptRematch(state.id, playerToken);

			const expectedHostColor = oppositeColor(currentHostColor);
			expect(record.state.hostColor).toBe(expectedHostColor);
			expect(record.state.players[record.state.hostColor!]?.name).toBe('Alice');
			expect(record.state.players[oppositeColor(record.state.hostColor!)]?.name).toBe('Bob');
			expect(viewerRoleFromToken(state.id, hostToken)).toBe(record.state.hostColor);
			expect(viewerRoleFromToken(state.id, playerToken)).toBe(oppositeColor(record.state.hostColor!));
		}

		expect(record.state.hostColor).toBe(initialHostColor);
	});
});

function oppositeColor(color: 'white' | 'black'): 'white' | 'black' {
	return color === 'white' ? 'black' : 'white';
}
