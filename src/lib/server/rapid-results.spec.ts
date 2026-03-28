import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '$lib/types/game';

const mocks = vi.hoisted(() => ({
	getGameOrThrow: vi.fn(),
	applyRapidResultByUsernames: vi.fn()
}));

vi.mock('./game-store', () => ({
	getGameOrThrow: mocks.getGameOrThrow
}));

vi.mock('./rapid-ranking-store', () => ({
	applyRapidResultByUsernames: mocks.applyRapidResultByUsernames
}));

import { maybeApplyRapidResultForGame } from './rapid-results';

function createRapidFinishedState(): GameState {
	return {
		id: 'game-1',
		status: 'finished',
		inviter: { name: 'Alice', joinedAt: 0 },
		hostColor: 'white',
		options: {
			timeLimitSeconds: null,
			incrementPerMoveSeconds: 10,
			roundLimit: 3,
			allowAiTrainingData: false,
			opponentType: 'human',
			hostColor: 'random',
			aiDifficulty: 'baseline',
			isRanked: false,
			isRapid: true
		},
		players: {
			white: { name: 'Alice', joinedAt: 0 },
			black: { name: 'Bob', joinedAt: 0 }
		},
		board: Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => null)),
		reserves: {
			white: { pawn: true, rook: true, knight: true, bishop: true },
			black: { pawn: true, rook: true, knight: true, bishop: true }
		},
		turn: 'white',
		pliesPlayed: 12,
		winner: 'white',
		bestOfWinner: null,
		score: { white: 1, black: 0 },
		matchScore: { host: 1, guest: 0 },
		gameNumber: 1,
		bestOf: 3,
		timeControlEnabled: false,
		timeControlPerPlayerSeconds: null,
		timeRemainingMs: null,
		turnStartedAt: null,
		moveHistory: [],
		rematchRequestedBy: null,
		createdAt: 0,
		lastActivityAt: 0,
		version: 1
	};
}

describe('rapid-results', () => {
	beforeEach(() => {
		mocks.getGameOrThrow.mockReset();
		mocks.applyRapidResultByUsernames.mockReset();
	});

	it('applies rapid rating updates to finished rapid games', async () => {
		const state = createRapidFinishedState();
		mocks.getGameOrThrow.mockReturnValue({ state });
		mocks.applyRapidResultByUsernames.mockResolvedValue({
			winnerBefore: 1200,
			winnerAfter: 1216,
			winnerDelta: 16,
			loserBefore: 1200,
			loserAfter: 1184,
			loserDelta: -16
		});

		await maybeApplyRapidResultForGame('game-1');

		expect(mocks.applyRapidResultByUsernames).toHaveBeenCalledWith({
			gameRoundKey: 'game-1#1',
			winnerUsername: 'Alice',
			loserUsername: 'Bob'
		});
		expect(state.options.rapidRoundKeyApplied).toBe('game-1#1');
	});

	it('does nothing when the round was already applied', async () => {
		const state = createRapidFinishedState();
		state.options.rapidRoundKeyApplied = 'game-1#1';
		mocks.getGameOrThrow.mockReturnValue({ state });

		await maybeApplyRapidResultForGame('game-1');

		expect(mocks.applyRapidResultByUsernames).not.toHaveBeenCalled();
	});

	it('does nothing when game is not marked rapid', async () => {
		const state = createRapidFinishedState();
		state.options.isRapid = false;
		mocks.getGameOrThrow.mockReturnValue({ state });

		await maybeApplyRapidResultForGame('game-1');

		expect(mocks.applyRapidResultByUsernames).not.toHaveBeenCalled();
	});
});
