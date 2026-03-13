import { applyPlayerMove, getLegalOptionsForColor } from '$lib/server/game-engine';
import {
	coordKey,
	type Color,
	type Coord,
	type GameState,
	type PlayerMove,
	type PieceType
} from '$lib/types/game';

function decodeCoordKey(key: string): Coord {
	const [rawX, rawY] = key.split(',').map((value) => Number.parseInt(value, 10));
	return { x: rawX, y: rawY };
}

function collectLegalMoves(state: GameState, color: Color): PlayerMove[] {
	const legal = getLegalOptionsForColor(state, color);
	const moves: PlayerMove[] = [];

	for (const piece of ['pawn', 'rook', 'knight', 'bishop'] as PieceType[]) {
		for (const target of legal.byReservePiece[piece]) {
			moves.push({ kind: 'place', piece, to: target });
		}
	}

	if (state.pliesPlayed < 6) {
		return moves;
	}

	for (const [fromKey, targets] of Object.entries(legal.byBoardFrom)) {
		const from = decodeCoordKey(fromKey);
		for (const to of targets) {
			moves.push({ kind: 'move', from, to });
		}
	}

	return moves;
}

function captureBonus(state: GameState, move: PlayerMove): number {
	if (move.kind !== 'move') {
		return 0;
	}
	return state.board[move.to.y][move.to.x] ? 25 : 0;
}

function centerBonus(target: Coord): number {
	const center = 1.5;
	const distance = Math.abs(target.x - center) + Math.abs(target.y - center);
	return 6 - distance;
}

function reserveUsageBonus(move: PlayerMove): number {
	if (move.kind !== 'place') {
		return 0;
	}
	if (move.piece === 'rook' || move.piece === 'bishop') {
		return 2;
	}
	return 1;
}

function moveKey(move: PlayerMove): string {
	if (move.kind === 'place') {
		return `place:${move.piece}:${coordKey(move.to)}`;
	}
	return `move:${coordKey(move.from)}:${coordKey(move.to)}`;
}

function scoreMove(state: GameState, color: Color, move: PlayerMove): number {
	const after = applyPlayerMove(state, color, move);
	const target = move.kind === 'place' ? move.to : move.to;
	let score = centerBonus(target) + reserveUsageBonus(move) + captureBonus(state, move);
	if (after.winner === color) {
		score += 10_000;
	}
	if (move.kind === 'move') {
		score += 3;
	}
	return score;
}

export function chooseAiMove(state: GameState, color: Color): PlayerMove | null {
	const moves = collectLegalMoves(state, color);
	if (moves.length === 0) {
		return null;
	}

	return moves
		.map((move) => ({ move, score: scoreMove(state, color, move) }))
		.sort((left, right) => {
			if (right.score !== left.score) {
				return right.score - left.score;
			}
			return moveKey(left.move).localeCompare(moveKey(right.move));
		})[0].move;
}
