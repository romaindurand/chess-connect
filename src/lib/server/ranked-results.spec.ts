import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '$lib/types/game';

const mocks = vi.hoisted(() => ({
	getGameOrThrow: vi.fn(),
	applyRankedResultByUsernames: vi.fn()
}));

vi.mock('./game-store', () => ({
	getGameOrThrow: mocks.getGameOrThrow
}));

vi.mock('./ranking-store', () => ({
	applyRankedResultByUsernames: mocks.applyRankedResultByUsernames
}));

import { maybeApplyRankedResultForGame } from './ranked-results';

function createRankedFinishedState(): GameState {
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
			isRanked: true
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

describe('ranked-results', () => {
	beforeEach(() => {
		mocks.getGameOrThrow.mockReset();
		mocks.applyRankedResultByUsernames.mockReset();
	});

	it('applies ranked deltas to finished ranked games', async () => {
		const state = createRankedFinishedState();
		mocks.getGameOrThrow.mockReturnValue({ state });
		mocks.applyRankedResultByUsernames.mockResolvedValue({
			winnerBefore: 1200,
			winnerAfter: 1216,
			winnerDelta: 16,
			loserBefore: 1200,
			loserAfter: 1184,
			loserDelta: -16
		});

		await maybeApplyRankedResultForGame('game-1');

		expect(mocks.applyRankedResultByUsernames).toHaveBeenCalledWith({
			gameRoundKey: 'game-1#1',
			winnerUsername: 'Alice',
			loserUsername: 'Bob'
		});
		expect(state.options.rankedRoundKeyApplied).toBe('game-1#1');
		expect(state.options.rankedWhiteDelta).toBe(16);
		expect(state.options.rankedBlackDelta).toBe(-16);
	});

	it('does nothing when the round was already applied', async () => {
		const state = createRankedFinishedState();
		state.options.rankedRoundKeyApplied = 'game-1#1';
		mocks.getGameOrThrow.mockReturnValue({ state });

		await maybeApplyRankedResultForGame('game-1');

		expect(mocks.applyRankedResultByUsernames).not.toHaveBeenCalled();
	});
});
