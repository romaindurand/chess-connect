import { applyPlayerMove, createInitialBoard } from '$lib/server/game-engine';
import { makeEmptyReserve, type GameState } from '$lib/types/game';

import { encodeState } from './encoder';
import { runMcts } from './mcts';
import type { TrainingSample } from './training';
import type { RecordedGame } from './game-recorder';

function createReplayState(): GameState {
	return {
		id: 'reanalysis',
		status: 'active',
		inviter: { name: 'A', joinedAt: 0 },
		hostColor: 'white',
		options: {
			timeLimitMinutes: null,
			opponentType: 'human',
			hostColor: 'white',
			aiDifficulty: 'baseline'
		},
		players: {
			white: { name: 'A', joinedAt: 0 },
			black: { name: 'B', joinedAt: 0 }
		},
		board: createInitialBoard(),
		reserves: {
			white: makeEmptyReserve(),
			black: makeEmptyReserve()
		},
		turn: 'white',
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
		createdAt: 0,
		lastActivityAt: 0,
		version: 0
	};
}

export interface ReanalysisOptions {
	simulations?: number;
	maxSamplesPerGame?: number;
}

export async function replayGameWithMctsTargets(
	game: RecordedGame,
	options?: ReanalysisOptions
): Promise<TrainingSample[]> {
	const simulations = options?.simulations ?? 32;
	const maxSamplesPerGame = options?.maxSamplesPerGame ?? Number.POSITIVE_INFINITY;

	let state = createReplayState();
	const samples: TrainingSample[] = [];

	for (const step of game.moves) {
		if (samples.length >= maxSamplesPerGame || state.status !== 'active') {
			break;
		}
		if (state.turn !== step.color) {
			break;
		}

		const actor = step.color;
		const encoded = Array.from(encodeState(state, actor));
		const mcts = await runMcts(state, actor, { simulations });

		samples.push({
			encoded,
			mctsDistribution: Array.from(mcts.distribution),
			outcome: game.winner === null ? 0 : game.winner === actor ? 1 : -1
		});

		try {
			state = applyPlayerMove(state, actor, step.move);
		} catch {
			break;
		}
	}

	return samples;
}
