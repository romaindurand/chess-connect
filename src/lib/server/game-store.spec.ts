import { describe, expect, it } from 'vitest';
import type { GameState } from '$lib/types/game';

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

	it('allows winner to request a rematch', async () => {
		const { state, token: hostToken } = createGame('Alice');
		const joinResult = await joinGame(state.id, 'Bob');
		const playerToken = joinResult.token;
		const record = getGameOrThrow(state.id);

		const hostColor = record.state.hostColor;
		expect(hostColor === 'white' || hostColor === 'black').toBe(true);
		if (!hostColor) {
			throw new Error('host color should be assigned after join');
		}

		record.state.status = 'finished';
		record.state.winner = hostColor;
		record.state.rematchRequestedBy = null;

		await requestRematch(state.id, hostToken);
		expect(record.state.rematchRequestedBy).toBe(hostColor);

		record.state.rematchRequestedBy = null;
		record.state.winner = oppositeColor(hostColor);
		await requestRematch(state.id, playerToken);
		expect(record.state.rematchRequestedBy).toBe(oppositeColor(hostColor));
	});

	it('auto-resets the round on third repeated position without changing score', async () => {
		const { state, token: hostToken } = createGame('Alice');
		const joinResult = await joinGame(state.id, 'Bob');
		const record = getGameOrThrow(state.id);

		const actorToken = viewerRoleFromToken(state.id, hostToken) === 'white' ? hostToken : joinResult.token;
		const actorColor = viewerRoleFromToken(state.id, actorToken);
		if (actorColor !== 'white' && actorColor !== 'black') {
			throw new Error('expected player role');
		}

		const opponentColor = oppositeColor(actorColor);
		const initialHostColor = record.state.hostColor;
		if (!initialHostColor) {
			throw new Error('host color should be assigned after join');
		}

		const emptyBoard = (): GameState['board'] =>
			Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => null));
		const boardBefore = emptyBoard();
		boardBefore[0][0] = { type: 'rook', owner: actorColor, pawnDirection: 1 };
		boardBefore[3][3] = { type: 'rook', owner: opponentColor, pawnDirection: -1 };

		const boardAfter = emptyBoard();
		boardAfter[1][0] = { type: 'rook', owner: actorColor, pawnDirection: 1 };
		boardAfter[3][3] = { type: 'rook', owner: opponentColor, pawnDirection: -1 };

		record.state.status = 'active';
		record.state.turn = actorColor;
		record.state.winner = null;
		record.state.pliesPlayed = 6;
		record.state.moveHistory = [
			{
				ply: 5,
				notation: '3. test',
				before: {
					board: boardBefore,
					reserves: record.state.reserves,
					turn: actorColor,
					pliesPlayed: 5,
					status: 'active',
					winner: null
				},
				after: {
					board: boardAfter,
					reserves: record.state.reserves,
					turn: opponentColor,
					pliesPlayed: 6,
					status: 'active',
					winner: null
				},
				transition: {
					moverColor: actorColor,
					fromBoard: { x: 0, y: 0 },
					toBoard: { x: 0, y: 1 },
					sound: 'move'
				}
			},
			{
				ply: 6,
				notation: '3... test',
				before: {
					board: boardBefore,
					reserves: record.state.reserves,
					turn: actorColor,
					pliesPlayed: 5,
					status: 'active',
					winner: null
				},
				after: {
					board: boardAfter,
					reserves: record.state.reserves,
					turn: opponentColor,
					pliesPlayed: 6,
					status: 'active',
					winner: null
				},
				transition: {
					moverColor: actorColor,
					fromBoard: { x: 0, y: 0 },
					toBoard: { x: 0, y: 1 },
					sound: 'move'
				}
			}
		];
		record.state.board = boardBefore;

		const initialScore = { ...record.state.score };
		const initialGameNumber = record.state.gameNumber;

		await playMove(state.id, actorToken, {
			kind: 'move',
			from: { x: 0, y: 0 },
			to: { x: 0, y: 1 }
		});

		expect(record.state.status).toBe('active');
		expect(record.state.winner).toBeNull();
		expect(record.state.score).toEqual(initialScore);
		expect(record.state.hostColor).toBe(oppositeColor(initialHostColor));
		expect(record.state.gameNumber).toBe(initialGameNumber + 1);
		expect(record.state.moveHistory).toEqual([]);
		expect(record.state.pliesPlayed).toBe(0);
		expect(record.state.turn).toBe('white');
		expect(record.state.reserves.white).toEqual({ pawn: true, rook: true, knight: true, bishop: true });
		expect(record.state.reserves.black).toEqual({ pawn: true, rook: true, knight: true, bishop: true });
		expect(record.state.board.flat().every((cell) => cell === null)).toBe(true);
	});
});

function oppositeColor(color: 'white' | 'black'): 'white' | 'black' {
	return color === 'white' ? 'black' : 'white';
}
