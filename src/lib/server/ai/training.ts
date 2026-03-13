import { applyPlayerMove, createInitialBoard } from '$lib/server/game-engine';
import {
	coordKey,
	makeEmptyReserve,
	type Color,
	type GameState,
	type PlayerMove
} from '$lib/types/game';

import { DEFAULT_AI_DIFFICULTY } from './config';
import { chooseAiMove } from './agent';

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
	summary: SelfPlayBatchSummary;
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
			timeLimitMinutes: null,
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

function playSelfPlayGame(maxPlies: number): SelfPlayGameResult {
	let state = createSelfPlayState();
	const moves: string[] = [];

	while (state.status === 'active' && state.pliesPlayed < maxPlies) {
		const actor = state.turn;
		const move = chooseAiMove(state, actor);
		if (!move) {
			return {
				winner: actor === 'white' ? 'black' : 'white',
				pliesPlayed: state.pliesPlayed,
				moves
			};
		}

		moves.push(serializeMove(move));
		state = applyPlayerMove(state, actor, move);
	}

	return {
		winner: state.winner,
		pliesPlayed: state.pliesPlayed,
		moves
	};
}

export function runSelfPlayBatch(options?: {
	games?: number;
	maxPlies?: number;
}): SelfPlayBatchReport {
	const totalGames = options?.games ?? 8;
	const maxPlies = options?.maxPlies ?? 64;
	const games = Array.from({ length: totalGames }, () => playSelfPlayGame(maxPlies));
	const whiteWins = games.filter((game) => game.winner === 'white').length;
	const blackWins = games.filter((game) => game.winner === 'black').length;
	const draws = games.filter((game) => game.winner === null).length;
	const totalPlies = games.reduce((sum, game) => sum + game.pliesPlayed, 0);

	return {
		games,
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
