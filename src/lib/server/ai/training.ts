import { applyPlayerMove, createInitialBoard } from '$lib/server/game-engine';
import {
	coordKey,
	makeEmptyReserve,
	type Color,
	type GameState,
	type PlayerMove
} from '$lib/types/game';

import { DEFAULT_AI_DIFFICULTY } from './config';
import { encodeState } from './encoder';
import { runMcts } from './mcts';

export interface SelfPlayGameResult {
	winner: Color | null;
	pliesPlayed: number;
	moves: string[];
}

export interface SelfPlayBatchSummary {
	totalGames: number;
	whiteWins: number;
	blackWins: number;
	draws: number;
	averagePlies: number;
}

export interface SelfPlayBatchReport {
	games: SelfPlayGameResult[];
	samples: TrainingSample[];
	summary: SelfPlayBatchSummary;
}

export interface TrainingSample {
	/** ENCODING_SIZE floats — encoded board state */
	encoded: number[];
	/** MOVE_SPACE_SIZE floats — normalised visit distribution from MCTS root */
	mctsDistribution: number[];
	/** +1 if white wins, -1 if black wins, 0 draw */
	outcome: number;
}

export interface TrainingArtifact {
	model: 'baseline-frequency';
	difficulty: typeof DEFAULT_AI_DIFFICULTY;
	generatedFromGames: number;
	openingMoves: Array<{ move: string; count: number }>;
}

function serializeMove(move: PlayerMove): string {
	if (move.kind === 'place') {
		return `place:${move.piece}:${coordKey(move.to)}`;
	}
	return `move:${coordKey(move.from)}:${coordKey(move.to)}`;
}

function createSelfPlayState(): GameState {
	const now = Date.now();
	return {
		id: `self-play-${now}`,
		status: 'active',
		inviter: { name: 'IA Blanc', joinedAt: now },
		hostColor: 'white',
		options: {
			timeLimitSeconds: null,
			opponentType: 'ai',
			hostColor: 'white',
			aiDifficulty: DEFAULT_AI_DIFFICULTY
		},
		players: {
			white: { name: 'IA Blanc', joinedAt: now },
			black: { name: 'IA Noir', joinedAt: now }
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

/** Reduced simulation budget used during self-play to keep generation fast. */
const SELF_PLAY_SIMULATIONS = 20;

interface PendingSample {
	encoded: number[];
	mctsDistribution: number[];
	actorColor: Color;
}

async function playSelfPlayGame(
	maxPlies: number
): Promise<{ result: SelfPlayGameResult; samples: TrainingSample[] }> {
	let state = createSelfPlayState();
	const moves: string[] = [];
	const pending: PendingSample[] = [];

	while (state.status === 'active' && state.pliesPlayed < maxPlies) {
		const actor = state.turn;
		const encoded = Array.from(encodeState(state, actor));
		const mctsResult = await runMcts(state, actor, { simulations: SELF_PLAY_SIMULATIONS });
		const move = mctsResult.move;
		if (!move) {
			const result = {
				winner: actor === 'white' ? ('black' as Color) : ('white' as Color),
				pliesPlayed: state.pliesPlayed,
				moves
			};
			return { result, samples: finalizeSamples(pending, result.winner) };
		}

		pending.push({
			encoded,
			mctsDistribution: Array.from(mctsResult.distribution),
			actorColor: actor
		});
		moves.push(serializeMove(move));
		state = applyPlayerMove(state, actor, move);
	}

	const result = {
		winner: state.winner,
		pliesPlayed: state.pliesPlayed,
		moves
	};
	return { result, samples: finalizeSamples(pending, state.winner) };
}

function finalizeSamples(pending: PendingSample[], winner: Color | null): TrainingSample[] {
	return pending.map((p) => ({
		encoded: p.encoded,
		mctsDistribution: p.mctsDistribution,
		outcome: winner === null ? 0 : winner === p.actorColor ? 1 : -1
	}));
}

export async function runSelfPlayBatch(options?: {
	games?: number;
	maxPlies?: number;
	onGameComplete?: (completed: number, total: number) => void;
}): Promise<SelfPlayBatchReport> {
	const totalGames = options?.games ?? 8;
	const maxPlies = options?.maxPlies ?? 64;
	const results: Awaited<ReturnType<typeof playSelfPlayGame>>[] = [];
	for (let i = 0; i < totalGames; i++) {
		results.push(await playSelfPlayGame(maxPlies));
		options?.onGameComplete?.(i + 1, totalGames);
	}
	const games = results.map((r) => r.result);
	const samples = results.flatMap((r) => r.samples);
	const whiteWins = games.filter((game) => game.winner === 'white').length;
	const blackWins = games.filter((game) => game.winner === 'black').length;
	const draws = games.filter((game) => game.winner === null).length;
	const totalPlies = games.reduce((sum, game) => sum + game.pliesPlayed, 0);

	return {
		games,
		samples,
		summary: {
			totalGames,
			whiteWins,
			blackWins,
			draws,
			averagePlies: totalGames === 0 ? 0 : totalPlies / totalGames
		}
	};
}

export function buildTrainingArtifact(games: SelfPlayGameResult[]): TrainingArtifact {
	const openingCounts = new Map<string, number>();
	for (const game of games) {
		const opening = game.moves[0];
		if (!opening) {
			continue;
		}
		openingCounts.set(opening, (openingCounts.get(opening) ?? 0) + 1);
	}

	return {
		model: 'baseline-frequency',
		difficulty: DEFAULT_AI_DIFFICULTY,
		generatedFromGames: games.length,
		openingMoves: [...openingCounts.entries()]
			.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
			.map(([move, count]) => ({ move, count }))
	};
}
