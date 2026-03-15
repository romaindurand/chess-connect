import { createInitialBoard } from '$lib/server/game-engine';
import { makeEmptyReserve, type Color, type GameState } from '$lib/types/game';

export function makeActiveState(turn: Color = 'white'): GameState {
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
		matchScore: { host: 0, guest: 0 },
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
