import { applyPlayerMove, getLegalOptionsForColor } from '$lib/server/game-engine';
import {
	coordKey,
	type Color,
	type Coord,
	type GameState,
	type PieceType,
	type PlayerMove
} from '$lib/types/game';

export interface MctsOptions {
	/** Number of MCTS simulations per call. Default: 100. */
	simulations?: number;
	/** Exploration constant (UCB1). Default: 1.41. */
	explorationConstant?: number;
}

interface MctsNode {
	move: PlayerMove | null;
	state: GameState;
	parent: MctsNode | null;
	children: MctsNode[];
	wins: number;
	visits: number;
	untriedMoves: PlayerMove[];
	actorColor: Color;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function decodeCoordKey(key: string): Coord {
	const [rawX, rawY] = key.split(',').map((v) => Number.parseInt(v, 10));
	return { x: rawX, y: rawY };
}

function legalMoves(state: GameState, color: Color): PlayerMove[] {
	const legal = getLegalOptionsForColor(state, color);
	const moves: PlayerMove[] = [];

	for (const piece of ['pawn', 'rook', 'knight', 'bishop'] as PieceType[]) {
		for (const target of legal.byReservePiece[piece]) {
			moves.push({ kind: 'place', piece, to: target });
		}
	}

	if (state.pliesPlayed >= 6) {
		for (const [fromKey, targets] of Object.entries(legal.byBoardFrom)) {
			const from = decodeCoordKey(fromKey);
			for (const to of targets) {
				moves.push({ kind: 'move', from, to });
			}
		}
	}

	return moves;
}

function makeNode(
	state: GameState,
	actorColor: Color,
	move: PlayerMove | null,
	parent: MctsNode | null
): MctsNode {
	return {
		move,
		state,
		parent,
		children: [],
		wins: 0,
		visits: 0,
		untriedMoves: legalMoves(state, actorColor),
		actorColor
	};
}

function ucb1(node: MctsNode, explorationConstant: number): number {
	if (node.visits === 0) {
		return Infinity;
	}
	const parentVisits = node.parent?.visits ?? node.visits;
	return (
		node.wins / node.visits + explorationConstant * Math.sqrt(Math.log(parentVisits) / node.visits)
	);
}

function selectChild(node: MctsNode, c: number): MctsNode {
	return node.children.reduce((best, child) => (ucb1(child, c) > ucb1(best, c) ? child : best));
}

function oppositeColor(color: Color): Color {
	return color === 'white' ? 'black' : 'white';
}

// ─── rollout ──────────────────────────────────────────────────────────────────

function heuristicScore(state: GameState, move: PlayerMove, color: Color): number {
	const after = applyPlayerMove(state, color, move);
	const target = move.to;
	const center = 1.5;
	const dist = Math.abs(target.x - center) + Math.abs(target.y - center);
	let score = 6 - dist;
	if (after.winner === color) {
		score += 10_000;
	}
	if (move.kind === 'move' && state.board[move.to.y][move.to.x]) {
		score += 25;
	}
	if (move.kind === 'move') {
		score += 3;
	}
	return score;
}

function rollout(state: GameState, startColor: Color, maxDepth = 20): 1 | 0 | -1 {
	let current = state;
	let depth = 0;
	while (current.status === 'active' && depth < maxDepth) {
		const actor = current.turn;
		const moves = legalMoves(current, actor);
		if (moves.length === 0) {
			break;
		}
		// Pick best heuristic move with a bit of noise via argmax over scored moves
		const best = moves.reduce(
			(acc, m) => {
				const s = heuristicScore(current, m, actor);
				return s > acc.score ? { move: m, score: s } : acc;
			},
			{ move: moves[0], score: -Infinity }
		);
		current = applyPlayerMove(current, actor, best.move);
		depth++;
	}
	if (current.winner === startColor) {
		return 1;
	}
	if (current.winner === oppositeColor(startColor)) {
		return -1;
	}
	return 0;
}

// ─── MCTS main loop ───────────────────────────────────────────────────────────

function sortMoveKey(move: PlayerMove): string {
	if (move.kind === 'place') {
		return `place:${move.piece}:${coordKey(move.to)}`;
	}
	return `move:${coordKey((move as { kind: 'move'; from: Coord; to: Coord }).from)}:${coordKey(move.to)}`;
}

/**
 * Run MCTS from `state` for `color` and return the best move found.
 * Returns null only when no legal moves exist.
 */
export function runMcts(
	state: GameState,
	color: Color,
	options: MctsOptions = {}
): PlayerMove | null {
	const simulations = options.simulations ?? 100;
	const c = options.explorationConstant ?? Math.SQRT2;

	const root = makeNode(state, color, null, null);
	if (root.untriedMoves.length === 0) {
		return null;
	}

	// Fast path: return an immediate winning move without running simulations.
	for (const move of root.untriedMoves) {
		try {
			const after = applyPlayerMove(state, color, move);
			if (after.winner === color) {
				return move;
			}
		} catch {
			// illegal move candidate – skip
		}
	}

	for (let i = 0; i < simulations; i++) {
		// 1. Selection – walk tree with UCB1
		let node = root;
		while (node.untriedMoves.length === 0 && node.children.length > 0) {
			node = selectChild(node, c);
		}

		// 2. Expansion – expand one untried move
		if (node.untriedMoves.length > 0) {
			// Sort for determinism so tests are reproducible
			const sorted = [...node.untriedMoves].sort((a, b) =>
				sortMoveKey(a).localeCompare(sortMoveKey(b))
			);
			const move = sorted[0];
			node.untriedMoves = node.untriedMoves.filter((m) => sortMoveKey(m) !== sortMoveKey(move));

			let nextState: GameState;
			try {
				nextState = applyPlayerMove(node.state, node.actorColor, move);
			} catch {
				continue;
			}
			const nextActor = nextState.turn;
			const child = makeNode(nextState, nextActor, move, node);
			node.children.push(child);
			node = child;
		}

		// 3. Rollout
		const result = rollout(node.state, color);

		// 4. Backpropagation
		let current: MctsNode | null = node;
		while (current) {
			current.visits += 1;
			current.wins += result;
			current = current.parent;
		}
	}

	// Pick child of root with most visits
	if (root.children.length === 0) {
		// Fallback: no simulations ran, return first untried move sorted
		const sorted = [...root.untriedMoves].sort((a, b) =>
			sortMoveKey(a).localeCompare(sortMoveKey(b))
		);
		return sorted[0] ?? null;
	}

	const best = root.children.reduce((acc, child) => (child.visits > acc.visits ? child : acc));
	return best.move;
}
