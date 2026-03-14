import { applyPlayerMove, getLegalOptionsForColor } from '$lib/server/game-engine';
import {
	BOARD_SIZE,
	coordKey,
	type Color,
	type Coord,
	type GameState,
	type PieceType,
	type PlayerMove
} from '$lib/types/game';

import { moveToIndex, MOVE_SPACE_SIZE } from './move-index';

export interface ModelAdapter {
	/** Returns prior probabilities for each legal move (must sum to ~1). */
	priors(state: GameState, moves: PlayerMove[]): Promise<number[]>;
	/** Returns a value estimate in [-1, 1] for `color` at `state`. */
	value(state: GameState, color: Color): Promise<number>;
}

export interface MctsOptions {
	/** Number of MCTS simulations per call. Default: 100. */
	simulations?: number;
	/** Exploration constant (UCB1 / PUCT). Default: sqrt(2). */
	explorationConstant?: number;
	/** When provided, uses PUCT selection and value-head leaf evaluation. */
	modelAdapter?: ModelAdapter;
}

/** Result returned by runMcts, including the visit distribution for training. */
export interface MctsResult {
	/** Best move chosen, or null if no legal moves exist. */
	move: PlayerMove | null;
	/** Normalised visit distribution over all 320 action indices. */
	distribution: Float32Array;
}

interface MctsNode {
	move: PlayerMove | null;
	state: GameState;
	parent: MctsNode | null;
	children: MctsNode[];
	wins: number;
	visits: number;
	untriedMoves: PlayerMove[];
	priors: Map<string, number>; // move key -> prior probability
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
	parent: MctsNode | null,
	priors?: Map<string, number>
): MctsNode {
	const moves = legalMoves(state, actorColor);
	const defaultPrior = moves.length > 0 ? 1 / moves.length : 0;
	const p = priors ?? new Map(moves.map((m) => [sortMoveKey(m), defaultPrior]));
	return {
		move,
		state,
		parent,
		children: [],
		wins: 0,
		visits: 0,
		untriedMoves: moves,
		priors: p,
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

function puct(node: MctsNode, c: number): number {
	const parentVisits = node.parent?.visits ?? 1;
	const prior = node.parent?.priors.get(node.move ? sortMoveKey(node.move) : '') ?? 0;
	const q = node.visits > 0 ? node.wins / node.visits : 0;
	return q + c * prior * (Math.sqrt(parentVisits) / (1 + node.visits));
}

function selectChild(node: MctsNode, c: number, usePuct: boolean): MctsNode {
	const score = usePuct ? puct : ucb1;
	return node.children.reduce((best, child) => (score(child, c) > score(best, c) ? child : best));
}

function oppositeColor(color: Color): Color {
	return color === 'white' ? 'black' : 'white';
}

// ─── rollout ──────────────────────────────────────────────────────────────────

/**
 * Returns the lines (row, column, and diagonals) that pass through `coord`.
 */
function linesThrough(coord: Coord): Coord[][] {
	const lines: Coord[][] = [
		Array.from({ length: BOARD_SIZE }, (_, x) => ({ x, y: coord.y })),
		Array.from({ length: BOARD_SIZE }, (_, y) => ({ x: coord.x, y }))
	];
	if (coord.x === coord.y) {
		lines.push(Array.from({ length: BOARD_SIZE }, (_, i) => ({ x: i, y: i })));
	}
	if (coord.x + coord.y === BOARD_SIZE - 1) {
		lines.push(Array.from({ length: BOARD_SIZE }, (_, i) => ({ x: i, y: BOARD_SIZE - 1 - i })));
	}
	return lines;
}

/**
 * Returns the maximum number of same-color pieces aligned in any unblocked
 * line passing through `target` on `board`.
 * A line is "blocked" when it contains at least one opponent piece.
 */
function bestUnblockedAlignment(board: GameState['board'], target: Coord, color: Color): number {
	const opp = oppositeColor(color);
	let best = 0;
	for (const line of linesThrough(target)) {
		if (line.some((c) => board[c.y][c.x]?.owner === opp)) continue;
		const count = line.filter((c) => board[c.y][c.x]?.owner === color).length;
		best = Math.max(best, count);
	}
	return best;
}

/**
 * Count the opponent's best unblocked alignment across all their pieces on the board.
 * Used to penalise moves that do nothing to slow the opponent's progress.
 */
function opponentBestAlignment(board: GameState['board'], color: Color): number {
	const opp = oppositeColor(color);
	let best = 0;
	for (let y = 0; y < BOARD_SIZE; y++) {
		for (let x = 0; x < BOARD_SIZE; x++) {
			if (board[y][x]?.owner === opp) {
				best = Math.max(best, bestUnblockedAlignment(board, { x, y }, opp));
			}
		}
	}
	return best;
}

/**
 * Count how many of the opponent's pieces were on unblocked lines passing through
 * `target` BEFORE the move (i.e. lines our piece will now block for the opponent).
 */
function blockedOppAlignmentAtTarget(
	board: GameState['board'],
	target: Coord,
	color: Color
): number {
	const opp = oppositeColor(color);
	let best = 0;
	for (const line of linesThrough(target)) {
		if (line.some((c) => board[c.y][c.x]?.owner === color)) continue; // already our line
		const oppCount = line.filter((c) => board[c.y][c.x]?.owner === opp).length;
		best = Math.max(best, oppCount);
	}
	return best;
}

function heuristicScore(state: GameState, move: PlayerMove, color: Color): number {
	const after = applyPlayerMove(state, color, move);
	const target = move.to;
	if (after.winner === color) return 10_000;

	// Own alignment gain (pieces in unblocked lines through target after the move)
	const myAlign = bestUnblockedAlignment(after.board, target, color);
	// Blocking bonus: opponent pieces that were on lines through target before we played there
	const blockBonus = blockedOppAlignmentAtTarget(state.board, target, color);
	// Opponent's best remaining alignment (global threat level after our move)
	const oppThreat = opponentBestAlignment(after.board, color);

	const center = 1.5;
	const dist = Math.abs(target.x - center) + Math.abs(target.y - center);
	let score = myAlign * 100 + blockBonus * 80 - oppThreat * 40 + (3 - dist);
	if (move.kind === 'move' && state.board[move.to.y][move.to.x]) score += 10;
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
export async function runMcts(
	state: GameState,
	color: Color,
	options: MctsOptions = {}
): Promise<MctsResult> {
	const simulations = options.simulations ?? 100;
	const c = options.explorationConstant ?? Math.SQRT2;
	const adapter = options.modelAdapter;
	const usePuct = adapter !== undefined;

	// Fast path: return an immediate winning move without running simulations.
	const candidates = legalMoves(state, color);
	if (candidates.length === 0)
		return { move: null, distribution: new Float32Array(MOVE_SPACE_SIZE) };

	for (const move of candidates) {
		try {
			const after = applyPlayerMove(state, color, move);
			if (after.winner === color) return { move, distribution: buildSingletonDist(move) };
		} catch {
			// illegal – skip
		}
	}

	// Block opponent's immediate winning threats before running simulations.
	const opponent = oppositeColor(color);
	const opponentCandidates = legalMoves({ ...state, turn: opponent }, opponent);
	const threatSquares = new Set<string>();
	for (const oMove of opponentCandidates) {
		try {
			const oAfter = applyPlayerMove({ ...state, turn: opponent }, opponent, oMove);
			if (oAfter.winner === opponent) threatSquares.add(coordKey(oMove.to));
		} catch {
			// skip
		}
	}
	if (threatSquares.size > 0) {
		const block = candidates.find((m) => threatSquares.has(coordKey(m.to)));
		if (block) return { move: block, distribution: buildSingletonDist(block) };
	}

	// Build root — prime priors from adapter if available
	let rootPriors: Map<string, number> | undefined;
	if (adapter) {
		const priorValues = await adapter.priors(state, candidates);
		rootPriors = new Map(candidates.map((m, i) => [sortMoveKey(m), priorValues[i]]));
	}
	const root = makeNode(state, color, null, null, rootPriors);

	for (let i = 0; i < simulations; i++) {
		// 1. Selection
		let node = root;
		while (node.untriedMoves.length === 0 && node.children.length > 0) {
			node = selectChild(node, c, usePuct);
		}

		// 2. Expansion — random pick to break determinism across games
		if (node.untriedMoves.length > 0) {
			const ridx = Math.floor(Math.random() * node.untriedMoves.length);
			const move = node.untriedMoves[ridx];
			node.untriedMoves = node.untriedMoves.filter((_, i) => i !== ridx);

			let nextState: GameState;
			try {
				nextState = applyPlayerMove(node.state, node.actorColor, move);
			} catch {
				continue;
			}
			const nextActor = nextState.turn;

			// Prime child priors from adapter if available
			let childPriors: Map<string, number> | undefined;
			if (adapter) {
				const childMoves = legalMoves(nextState, nextActor);
				if (childMoves.length > 0) {
					const pv = await adapter.priors(nextState, childMoves);
					childPriors = new Map(childMoves.map((m, idx) => [sortMoveKey(m), pv[idx]]));
				}
			}

			const child = makeNode(nextState, nextActor, move, node, childPriors);
			node.children.push(child);
			node = child;
		}

		// 3. Evaluation: value-head (adapter) or heuristic rollout
		let result: number;
		if (adapter) {
			result = await adapter.value(node.state, color);
		} else {
			result = rollout(node.state, color);
		}

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
		const ridx = Math.floor(Math.random() * root.untriedMoves.length);
		const move = root.untriedMoves[ridx] ?? null;
		return {
			move,
			distribution: move ? buildSingletonDist(move) : new Float32Array(MOVE_SPACE_SIZE)
		};
	}

	const best = root.children.reduce((acc, child) => (child.visits > acc.visits ? child : acc));
	const distribution = buildVisitDist(root.children);
	return { move: best.move, distribution };
}

function buildSingletonDist(move: PlayerMove): Float32Array {
	const dist = new Float32Array(MOVE_SPACE_SIZE);
	const idx = moveToIndex(move);
	if (idx >= 0 && idx < MOVE_SPACE_SIZE) dist[idx] = 1;
	return dist;
}

function buildVisitDist(children: MctsNode[]): Float32Array {
	const dist = new Float32Array(MOVE_SPACE_SIZE);
	let total = 0;
	for (const child of children) {
		if (child.move) {
			const idx = moveToIndex(child.move);
			if (idx >= 0 && idx < MOVE_SPACE_SIZE) {
				dist[idx] = child.visits;
				total += child.visits;
			}
		}
	}
	if (total > 0) {
		for (let i = 0; i < dist.length; i++) dist[i] /= total;
	}
	return dist;
}
