import { BOARD_SIZE, PIECES, type Color, type GameState, type PieceType } from '$lib/types/game';

// Encoding layout (flat Float32Array):
//   board planes: BOARD_SIZE * BOARD_SIZE * (piece_types * 2 + 1 pawn_direction)
//     For each cell: [pawn_w, rook_w, knight_w, bishop_w, pawn_b, rook_b, knight_b, bishop_b, pawn_dir_w, pawn_dir_b]
//   reserves: 4 booleans per color = 8 values
//   side_to_move: 1 value (1 = viewer's turn, -1 = opponent's)
//   ply_phase: 1 value (0 = placement phase plies < 6, 1 = free phase)
//
// Total: 4*4*10 + 8 + 1 + 1 = 160 + 10 = 170 features

const PIECE_ORDER: PieceType[] = PIECES;
const PLANES_PER_CELL = PIECE_ORDER.length * 2 + 2; // 4 white + 4 black + 2 pawn directions

export const SPATIAL_SIZE = BOARD_SIZE * BOARD_SIZE * PLANES_PER_CELL; // 160
export const ENCODING_SIZE = SPATIAL_SIZE + PIECE_ORDER.length * 2 + 2;

export function encodeState(state: GameState, viewerColor: Color): Float32Array {
	const buf = new Float32Array(ENCODING_SIZE);
	let offset = 0;

	// Board planes
	for (let y = 0; y < BOARD_SIZE; y++) {
		for (let x = 0; x < BOARD_SIZE; x++) {
			const cell = state.board[y][x];
			for (let p = 0; p < PIECE_ORDER.length; p++) {
				const piece = PIECE_ORDER[p];
				buf[offset + p] = cell?.owner === 'white' && cell.type === piece ? 1 : 0;
				buf[offset + PIECE_ORDER.length + p] =
					cell?.owner === 'black' && cell.type === piece ? 1 : 0;
			}
			// Pawn direction for white and black
			const wIdx = offset + PIECE_ORDER.length * 2;
			const bIdx = wIdx + 1;
			if (cell?.type === 'pawn' && cell.owner === 'white') {
				buf[wIdx] = cell.pawnDirection;
			}
			if (cell?.type === 'pawn' && cell.owner === 'black') {
				buf[bIdx] = cell.pawnDirection;
			}
			offset += PLANES_PER_CELL;
		}
	}

	// Reserves (white then black)
	for (const color of ['white', 'black'] as Color[]) {
		for (const piece of PIECE_ORDER) {
			buf[offset++] = state.reserves[color][piece] ? 1 : 0;
		}
	}

	// Side to move relative to viewer
	buf[offset++] = state.turn === viewerColor ? 1 : -1;

	// Placement phase flag
	buf[offset++] = state.pliesPlayed < 6 ? 0 : 1;

	return buf;
}
