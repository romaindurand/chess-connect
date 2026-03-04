import {
	BOARD_SIZE,
	coordKey,
	type Color,
	type Coord,
	type GameState,
	type LegalOptions,
	type PieceOnBoard,
	type PieceType,
	type PlayerMove
} from '$lib/types/game';

function cloneBoard(board: GameState['board']): GameState['board'] {
	return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function cloneReserves(state: GameState): GameState['reserves'] {
	return {
		white: { ...state.reserves.white },
		black: { ...state.reserves.black }
	};
}

function opposite(color: Color): Color {
	return color === 'white' ? 'black' : 'white';
}

function isInside(coord: Coord): boolean {
	return coord.x >= 0 && coord.y >= 0 && coord.x < BOARD_SIZE && coord.y < BOARD_SIZE;
}

function getPiece(board: GameState['board'], coord: Coord): PieceOnBoard | null {
	if (!isInside(coord)) {
		return null;
	}
	return board[coord.y][coord.x];
}

function stepRay(
	board: GameState['board'],
	from: Coord,
	dx: number,
	dy: number,
	owner: Color
): Coord[] {
	const moves: Coord[] = [];
	let x = from.x + dx;
	let y = from.y + dy;
	while (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
		const target = board[y][x];
		if (!target) {
			moves.push({ x, y });
			x += dx;
			y += dy;
			continue;
		}
		if (target.owner !== owner) {
			moves.push({ x, y });
		}
		break;
	}
	return moves;
}

export function createInitialBoard(): GameState['board'] {
	return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => null));
}

export function getPieceMoves(state: GameState, from: Coord): Coord[] {
	const piece = getPiece(state.board, from);
	if (!piece) {
		return [];
	}

	if (piece.type === 'knight') {
		const deltas = [
			{ dx: 1, dy: 2 },
			{ dx: 2, dy: 1 },
			{ dx: 2, dy: -1 },
			{ dx: 1, dy: -2 },
			{ dx: -1, dy: -2 },
			{ dx: -2, dy: -1 },
			{ dx: -2, dy: 1 },
			{ dx: -1, dy: 2 }
		];

		return deltas
			.map(({ dx, dy }) => ({ x: from.x + dx, y: from.y + dy }))
			.filter(isInside)
			.filter((to) => {
				const target = getPiece(state.board, to);
				return !target || target.owner !== piece.owner;
			});
	}

	if (piece.type === 'rook') {
		return [
			...stepRay(state.board, from, 1, 0, piece.owner),
			...stepRay(state.board, from, -1, 0, piece.owner),
			...stepRay(state.board, from, 0, 1, piece.owner),
			...stepRay(state.board, from, 0, -1, piece.owner)
		];
	}

	if (piece.type === 'bishop') {
		return [
			...stepRay(state.board, from, 1, 1, piece.owner),
			...stepRay(state.board, from, -1, 1, piece.owner),
			...stepRay(state.board, from, 1, -1, piece.owner),
			...stepRay(state.board, from, -1, -1, piece.owner)
		];
	}

	const moves: Coord[] = [];
	const forward = { x: from.x, y: from.y + piece.pawnDirection };
	if (isInside(forward) && !getPiece(state.board, forward)) {
		moves.push(forward);
	}

	for (const dx of [-1, 1]) {
		const diag = { x: from.x + dx, y: from.y + piece.pawnDirection };
		if (!isInside(diag)) {
			continue;
		}
		const target = getPiece(state.board, diag);
		if (target && target.owner !== piece.owner) {
			moves.push(diag);
		}
	}

	return moves;
}

export function getLegalPlacements(state: GameState, color: Color, piece: PieceType): Coord[] {
	if (!state.reserves[color][piece]) {
		return [];
	}

	const result: Coord[] = [];
	for (let y = 0; y < BOARD_SIZE; y += 1) {
		for (let x = 0; x < BOARD_SIZE; x += 1) {
			if (!state.board[y][x]) {
				result.push({ x, y });
			}
		}
	}
	return result;
}

function hasAlignedFour(state: GameState, color: Color): boolean {
	const lines: Coord[][] = [];

	for (let y = 0; y < BOARD_SIZE; y += 1) {
		lines.push(Array.from({ length: BOARD_SIZE }, (_, x) => ({ x, y })));
	}

	for (let x = 0; x < BOARD_SIZE; x += 1) {
		lines.push(Array.from({ length: BOARD_SIZE }, (_, y) => ({ x, y })));
	}

	lines.push(Array.from({ length: BOARD_SIZE }, (_, i) => ({ x: i, y: i })));
	lines.push(Array.from({ length: BOARD_SIZE }, (_, i) => ({ x: i, y: BOARD_SIZE - 1 - i })));

	return lines.some((line) =>
		line.every((coord) => {
			const piece = state.board[coord.y][coord.x];
			return piece && piece.owner === color;
		})
	);
}

function validateTurn(state: GameState, color: Color): void {
	if (state.status !== 'active') {
		throw new Error("La partie n'est pas active");
	}
	if (state.turn !== color) {
		throw new Error("Ce n'est pas votre tour");
	}
	if (!state.players.white || !state.players.black) {
		throw new Error('La partie attend encore un joueur');
	}
	if (state.winner) {
		throw new Error('La partie est déjà terminée');
	}
}

export function getLegalOptionsForColor(state: GameState, color: Color): LegalOptions {
	const byBoardFrom: Record<string, Coord[]> = {};
	for (let y = 0; y < BOARD_SIZE; y += 1) {
		for (let x = 0; x < BOARD_SIZE; x += 1) {
			const piece = state.board[y][x];
			if (!piece || piece.owner !== color) {
				continue;
			}
			const from = { x, y };
			const moves = getPieceMoves(state, from);
			if (moves.length > 0) {
				byBoardFrom[coordKey(from)] = moves;
			}
		}
	}

	return {
		byBoardFrom,
		byReservePiece: {
			pawn: getLegalPlacements(state, color, 'pawn'),
			rook: getLegalPlacements(state, color, 'rook'),
			knight: getLegalPlacements(state, color, 'knight'),
			bishop: getLegalPlacements(state, color, 'bishop')
		}
	};
}

export function applyPlayerMove(state: GameState, color: Color, move: PlayerMove): GameState {
	validateTurn(state, color);

	if (state.pliesPlayed < 6 && move.kind !== 'place') {
		throw new Error('Durant les 6 premiers tours, seul le placement est autorisé');
	}

	const board = cloneBoard(state.board);
	const reserves = cloneReserves(state);

	if (move.kind === 'place') {
		if (!reserves[color][move.piece]) {
			throw new Error('Pièce indisponible dans la réserve');
		}
		if (!isInside(move.to)) {
			throw new Error('Case invalide');
		}
		if (board[move.to.y][move.to.x]) {
			throw new Error('Case déjà occupée');
		}

		board[move.to.y][move.to.x] = {
			type: move.piece,
			owner: color,
			pawnDirection: color === 'white' ? -1 : 1
		};
		reserves[color][move.piece] = false;
	} else {
		if (!isInside(move.from) || !isInside(move.to)) {
			throw new Error('Case invalide');
		}

		const movingPiece = board[move.from.y][move.from.x];
		if (!movingPiece || movingPiece.owner !== color) {
			throw new Error('Pièce de départ invalide');
		}

		const legalTargets = getPieceMoves({ ...state, board }, move.from);
		if (!legalTargets.some((coord) => coord.x === move.to.x && coord.y === move.to.y)) {
			throw new Error('Déplacement illégal');
		}

		const captured = board[move.to.y][move.to.x];
		if (captured) {
			reserves[captured.owner][captured.type] = true;
		}

		board[move.to.y][move.to.x] = movingPiece;
		board[move.from.y][move.from.x] = null;

		if (movingPiece.type === 'pawn') {
			const reachesTop = movingPiece.pawnDirection === -1 && move.to.y === 0;
			const reachesBottom = movingPiece.pawnDirection === 1 && move.to.y === BOARD_SIZE - 1;
			if (reachesTop || reachesBottom) {
				movingPiece.pawnDirection = (movingPiece.pawnDirection * -1) as 1 | -1;
			}
		}
	}

	const winner = hasAlignedFour({ ...state, board }, color) ? color : null;

	return {
		...state,
		board,
		reserves,
		pliesPlayed: state.pliesPlayed + 1,
		turn: opposite(color),
		winner,
		status: winner ? 'finished' : state.status,
		lastActivityAt: Date.now(),
		version: state.version + 1
	};
}
