import { BOARD_SIZE, PIECES, type PieceType, type PlayerMove } from '$lib/types/game';

export const MOVE_SPACE_SIZE =
	PIECES.length * BOARD_SIZE * BOARD_SIZE + (BOARD_SIZE * BOARD_SIZE) ** 2;
// 4 * 16 + 256 = 320

export function moveToIndex(move: PlayerMove): number {
	if (move.kind === 'place') {
		const pieceIdx = PIECES.indexOf(move.piece as PieceType);
		return pieceIdx * BOARD_SIZE * BOARD_SIZE + move.to.y * BOARD_SIZE + move.to.x;
	}
	const fromIdx = move.from.y * BOARD_SIZE + move.from.x;
	const toIdx = move.to.y * BOARD_SIZE + move.to.x;
	return (
		PIECES.length * BOARD_SIZE * BOARD_SIZE + fromIdx * BOARD_SIZE * BOARD_SIZE + toIdx
	);
}

export function indexToMove(idx: number): PlayerMove {
	const placeCount = PIECES.length * BOARD_SIZE * BOARD_SIZE;
	if (idx < placeCount) {
		const pieceIdx = Math.floor(idx / (BOARD_SIZE * BOARD_SIZE));
		const cell = idx % (BOARD_SIZE * BOARD_SIZE);
		return {
			kind: 'place',
			piece: PIECES[pieceIdx],
			to: { x: cell % BOARD_SIZE, y: Math.floor(cell / BOARD_SIZE) }
		};
	}
	const rem = idx - placeCount;
	const fromIdx = Math.floor(rem / (BOARD_SIZE * BOARD_SIZE));
	const toIdx = rem % (BOARD_SIZE * BOARD_SIZE);
	return {
		kind: 'move',
		from: { x: fromIdx % BOARD_SIZE, y: Math.floor(fromIdx / BOARD_SIZE) },
		to: { x: toIdx % BOARD_SIZE, y: Math.floor(toIdx / BOARD_SIZE) }
	};
}
