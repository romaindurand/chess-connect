import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import type { Color, GameState, PlayerMove } from '$lib/types/game';

export interface RecordedMove {
	color: Color;
	move: PlayerMove;
}

export interface RecordedGame {
	id: string;
	playedAt: number;
	winner: Color | null;
	source: 'human-vs-human' | 'human-vs-ai';
	moves: RecordedMove[];
}

export function extractMovesFromHistory(state: GameState): RecordedMove[] {
	return state.moveHistory.map((entry) => {
		const { moverColor, toBoard, fromBoard, fromReserve } = entry.transition;
		const move: PlayerMove = fromReserve
			? { kind: 'place', piece: fromReserve.piece, to: toBoard }
			: { kind: 'move', from: fromBoard!, to: toBoard };
		return { color: moverColor, move };
	});
}

export function recordCompletedGame(state: GameState, outputPath: string): void {
	if (state.options.allowAiTrainingData === false) {
		return;
	}

	if (!state.winner || state.moveHistory.length === 0) {
		return;
	}

	const source: RecordedGame['source'] =
		state.options.opponentType === 'ai' ? 'human-vs-ai' : 'human-vs-human';

	const record: RecordedGame = {
		id: `${state.id}-g${state.gameNumber}`,
		playedAt: state.lastActivityAt,
		winner: state.winner,
		source,
		moves: extractMovesFromHistory(state)
	};

	try {
		mkdirSync(dirname(outputPath), { recursive: true });
		appendFileSync(outputPath, JSON.stringify(record) + '\n');
	} catch {
		// Keep gameplay resilient if recording fails.
	}
}
