import { createHmac, randomUUID } from 'node:crypto';

import { applyPlayerMove, createInitialBoard, getLegalOptionsForColor } from './game-engine';
import {
	makeEmptyReserve,
	type Coord,
	type Color,
	type HistorySnapshot,
	type GameState,
	type GameView,
	type MoveHistoryEntry,
	type PlayerMove,
	type ServerEvent,
	type ViewerRole
} from '$lib/types/game';

const DAY_MS = 24 * 60 * 60 * 1000;
const HEARTBEAT_MS = 15_000;
const SECRET = process.env.CHESS_CONNECT_SECRET ?? randomUUID();
const SECOND_MS = 1000;

interface SessionTokenPayload {
	gameId: string;
	kind: 'host' | 'player';
	color: Color | null;
	rnd: string;
}

type Subscriber = (event: ServerEvent) => void;

interface GameRecord {
	state: GameState;
	subscribers: Set<Subscriber>;
}

interface Store {
	games: Map<string, GameRecord>;
	queues: Map<string, Promise<void>>;
	cleanupTimer: NodeJS.Timeout;
	heartbeatTimer: NodeJS.Timeout;
}

declare global {
	var __chessConnectStore: Store | undefined;
}

function signPayload(payload: SessionTokenPayload): string {
	const color = payload.color ?? 'none';
	const raw = `${payload.gameId}:${payload.kind}:${color}:${payload.rnd}`;
	const signature = createHmac('sha256', SECRET).update(raw).digest('base64url');
	return `${raw}:${signature}`;
}

function readToken(token: string): SessionTokenPayload | null {
	const chunks = token.split(':');
	if (chunks.length !== 5) {
		return null;
	}
	const [gameId, kind, rawColor, rnd, signature] = chunks;
	if (kind !== 'host' && kind !== 'player') {
		return null;
	}
	if (rawColor !== 'white' && rawColor !== 'black' && rawColor !== 'none') {
		return null;
	}
	if (kind === 'player' && rawColor === 'none') {
		return null;
	}
	const expected = createHmac('sha256', SECRET)
		.update(`${gameId}:${kind}:${rawColor}:${rnd}`)
		.digest('base64url');
	if (expected !== signature) {
		return null;
	}
	return {
		gameId,
		kind,
		color: rawColor === 'none' ? null : rawColor,
		rnd
	};
}

function getStore(): Store {
	if (globalThis.__chessConnectStore) {
		return globalThis.__chessConnectStore;
	}

	const store: Store = {
		games: new Map(),
		queues: new Map(),
		cleanupTimer: setInterval(() => {
			const now = Date.now();
			for (const [id, game] of store.games) {
				if (now - game.state.lastActivityAt > DAY_MS) {
					store.games.delete(id);
					store.queues.delete(id);
				}
			}
		}, 60_000),
		heartbeatTimer: setInterval(() => {
			const now = Date.now();
			const event: ServerEvent = { type: 'keepalive', at: now };
			for (const game of store.games.values()) {
				if (applyTimeoutIfExpired(game, now)) {
					emitSnapshot(game);
					continue;
				}
				for (const subscriber of game.subscribers) {
					subscriber(event);
				}
			}
		}, HEARTBEAT_MS)
	};

	globalThis.__chessConnectStore = store;
	return store;
}

function createNewState(
	gameId: string,
	creatorName: string,
	options?: { timeLimitMinutes?: number }
): { state: GameState } {
	const now = Date.now();
	const timeControlPerPlayerSeconds =
		options?.timeLimitMinutes !== undefined ? options.timeLimitMinutes * 60 : null;
	const timeControlEnabled = timeControlPerPlayerSeconds !== null;
	const timeRemainingMs =
		timeControlPerPlayerSeconds !== null
			? {
					white: timeControlPerPlayerSeconds * SECOND_MS,
					black: timeControlPerPlayerSeconds * SECOND_MS
				}
			: null;
	return {
		state: {
			id: gameId,
			status: 'waiting',
			inviter: { name: creatorName, joinedAt: now },
			hostColor: null,
			players: {
				white: null,
				black: null
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
			score: {
				white: 0,
				black: 0
			},
			gameNumber: 1,
			bestOf: 3,
			timeControlEnabled,
			timeControlPerPlayerSeconds,
			timeRemainingMs,
			turnStartedAt: null,
			moveHistory: [],
			rematchRequestedBy: null,
			createdAt: now,
			lastActivityAt: now,
			version: 0
		}
	};
}

function cloneBoard(board: GameState['board']): GameState['board'] {
	return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function cloneReserves(reserves: GameState['reserves']): GameState['reserves'] {
	return {
		white: { ...reserves.white },
		black: { ...reserves.black }
	};
}

function snapshotOf(state: GameState): HistorySnapshot {
	return {
		board: cloneBoard(state.board),
		reserves: cloneReserves(state.reserves),
		turn: state.turn,
		pliesPlayed: state.pliesPlayed,
		status: state.status,
		winner: state.winner
	};
}

function square(coord: Coord): string {
	return `${String.fromCharCode(65 + coord.x)}${4 - coord.y}`;
}

function pieceLetter(type: 'pawn' | 'rook' | 'knight' | 'bishop'): string {
	if (type === 'rook') {
		return 'R';
	}
	if (type === 'knight') {
		return 'N';
	}
	if (type === 'bishop') {
		return 'B';
	}
	return 'P';
}

function buildHistoryEntry(
	before: GameState,
	after: GameState,
	actorColor: Color,
	move: PlayerMove
): MoveHistoryEntry {
	const ply = after.pliesPlayed;
	const shortPly = Math.floor((ply + 1) / 2);
	const prefix = `${shortPly}.${actorColor === 'white' ? '' : '...'} `;

	if (move.kind === 'place') {
		return {
			ply,
			notation: `${prefix}${pieceLetter(move.piece)}@${square(move.to)}`,
			before: snapshotOf(before),
			after: snapshotOf(after),
			transition: {
				moverColor: actorColor,
				toBoard: move.to,
				fromReserve: { owner: actorColor, piece: move.piece },
				sound: 'move'
			}
		};
	}

	const movingPiece = before.board[move.from.y][move.from.x];
	const capturedPiece = before.board[move.to.y][move.to.x];
	const movingType = movingPiece?.type ?? 'pawn';
	const sep = capturedPiece ? 'x' : '-';

	return {
		ply,
		notation: `${prefix}${pieceLetter(movingType)}${square(move.from)}${sep}${square(move.to)}`,
		before: snapshotOf(before),
		after: snapshotOf(after),
		transition: {
			moverColor: actorColor,
			fromBoard: move.from,
			toBoard: move.to,
			sound: capturedPiece ? 'capture' : 'move'
		}
	};
}

function getRemainingTurnMs(state: GameState, color: Color, now: number): number | null {
	if (!state.timeControlEnabled || !state.timeRemainingMs) {
		return null;
	}
	let remaining = state.timeRemainingMs[color];
	if (state.status === 'active' && state.turn === color && state.turnStartedAt !== null) {
		remaining -= now - state.turnStartedAt;
	}
	return Math.max(0, remaining);
}

function finalizeWinner(record: GameRecord, winner: Color, now: number): void {
	record.state.winner = winner;
	record.state.status = 'finished';
	record.state.turnStartedAt = null;
	record.state.rematchRequestedBy = null;
	record.state.lastActivityAt = now;
	record.state.version += 1;

	record.state.score[winner] += 1;
	if (record.state.score[winner] >= 2) {
		record.state.bestOfWinner = winner;
	}
}

function applyTimeoutIfExpired(record: GameRecord, now: number): boolean {
	const state = record.state;
	if (!state.timeControlEnabled || !state.timeRemainingMs || state.status !== 'active' || state.winner) {
		return false;
	}

	const activeColor = state.turn;
	const remaining = getRemainingTurnMs(state, activeColor, now);
	if (remaining === null || remaining > 0) {
		return false;
	}

	state.timeRemainingMs[activeColor] = 0;
	finalizeWinner(record, oppositeColor(activeColor), now);
	return true;
}

function isBestOfFinished(state: GameState): boolean {
	return Boolean(state.bestOfWinner || state.score.white >= 2 || state.score.black >= 2);
}

function oppositeColor(color: Color): Color {
	return color === 'white' ? 'black' : 'white';
}

function pieceToken(cell: GameState['board'][number][number]): string {
	if (!cell) {
		return '.';
	}
	const owner = cell.owner === 'white' ? 'w' : 'b';
	const type = cell.type[0];
	const direction = cell.pawnDirection === 1 ? 'd' : 'u';
	return `${owner}${type}${direction}`;
}

function positionKeyFromSnapshot(snapshot: HistorySnapshot): string {
	const boardKey = snapshot.board.map((row) => row.map(pieceToken).join(',')).join('/');
	const reservesKey = (['white', 'black'] as const)
		.map((color) => {
			const reserve = snapshot.reserves[color];
			return `${color}:${reserve.pawn ? 1 : 0}${reserve.rook ? 1 : 0}${reserve.knight ? 1 : 0}${reserve.bishop ? 1 : 0}`;
		})
		.join('|');
	return `${boardKey}|${reservesKey}|turn:${snapshot.turn}`;
}

function hasThreefoldRepetition(moveHistory: MoveHistoryEntry[]): boolean {
	if (moveHistory.length < 3) {
		return false;
	}

	const latest = moveHistory[moveHistory.length - 1]?.after;
	if (!latest) {
		return false;
	}
	const targetKey = positionKeyFromSnapshot(latest);
	let occurrences = 0;

	for (const entry of moveHistory) {
		if (positionKeyFromSnapshot(entry.after) === targetKey) {
			occurrences += 1;
			if (occurrences >= 3) {
				return true;
			}
		}
	}

	return false;
}

function createNextRoundState(state: GameState, swapColors: boolean): GameState {
	const previousHostColor = state.hostColor;
	if (!previousHostColor) {
		throw new Error('Couleur hote indisponible');
	}
	const nextHostColor = swapColors ? oppositeColor(previousHostColor) : previousHostColor;
	const hostPlayer = state.players[previousHostColor];
	const guestPlayer = state.players[oppositeColor(previousHostColor)];
	if (!hostPlayer || !guestPlayer) {
		throw new Error('Deux joueurs sont requis pour lancer la manche suivante');
	}

	const nextPlayers: GameState['players'] = {
		white: null,
		black: null
	};
	nextPlayers[nextHostColor] = hostPlayer;
	nextPlayers[oppositeColor(nextHostColor)] = guestPlayer;

	return {
		...state,
		status: 'active',
		hostColor: nextHostColor,
		players: nextPlayers,
		board: createInitialBoard(),
		reserves: {
			white: makeEmptyReserve(),
			black: makeEmptyReserve()
		},
		turn: 'white',
		pliesPlayed: 0,
		winner: null,
		moveHistory: [],
		gameNumber: state.gameNumber + 1,
		timeRemainingMs: state.timeControlPerPlayerSeconds
			? {
					white: state.timeControlPerPlayerSeconds * SECOND_MS,
					black: state.timeControlPerPlayerSeconds * SECOND_MS
			  }
			: null,
		turnStartedAt: state.timeControlEnabled ? Date.now() : null,
		rematchRequestedBy: null,
		lastActivityAt: Date.now(),
		version: state.version + 1
	};
}

function resolveActorColor(state: GameState, payload: SessionTokenPayload): Color | null {
	if (payload.kind === 'host') {
		return state.hostColor;
	}
	if (state.hostColor) {
		return oppositeColor(state.hostColor);
	}
	return payload.color;
}

function emitSnapshot(record: GameRecord): void {
	const event = {
		type: 'snapshot',
		game: toView(record.state, null)
	} as const;
	for (const subscriber of record.subscribers) {
		subscriber(event);
	}
}

export function cookieName(gameId: string): string {
	return `cc_player_${gameId}`;
}

export function createGame(
	creatorName: string,
	options?: { timeLimitMinutes?: number }
): {
	state: GameState;
	token: string;
	color: Color | null;
} {
	const store = getStore();
	const gameId = randomUUID().slice(0, 8);
	const { state } = createNewState(gameId, creatorName, options);

	store.games.set(gameId, {
		state,
		subscribers: new Set()
	});

	const token = signPayload({
		gameId,
		kind: 'host',
		color: null,
		rnd: randomUUID().slice(0, 12)
	});
	return { state, token, color: null };
}

export function getGameOrThrow(gameId: string): GameRecord {
	const game = getStore().games.get(gameId);
	if (!game) {
		throw new Error('Partie introuvable');
	}
	return game;
}

function queueMutation<T>(gameId: string, mutation: () => T): Promise<T> {
	const store = getStore();
	const previous = store.queues.get(gameId) ?? Promise.resolve();

	let resolveDone: () => void;
	const completion = new Promise<void>((resolve) => {
		resolveDone = resolve;
	});

	const queued = previous
		.then(() => completion)
		.catch(() => completion)
		.finally(() => {
			if (store.queues.get(gameId) === queued) {
				store.queues.delete(gameId);
			}
		});

	store.queues.set(gameId, queued);

	return previous.then(() => {
		try {
			return mutation();
		} finally {
			resolveDone!();
		}
	});
}

export async function joinGame(
	gameId: string,
	playerName: string
): Promise<{ token: string; color: Color; state: GameState }> {
	return queueMutation(gameId, () => {
		const record = getGameOrThrow(gameId);
		if (record.state.status !== 'waiting') {
			throw new Error('La partie est déjà démarrée');
		}
		const now = Date.now();
		const hostColor: Color = Math.random() < 0.5 ? 'white' : 'black';
		const guestColor: Color = hostColor === 'white' ? 'black' : 'white';

		record.state.players[hostColor] = { ...record.state.inviter };
		record.state.players[guestColor] = { name: playerName, joinedAt: now };
		record.state.hostColor = hostColor;
		record.state.status = 'active';
		record.state.turnStartedAt = record.state.timeControlEnabled ? now : null;
		record.state.lastActivityAt = now;
		record.state.version += 1;

		emitSnapshot(record);

		return {
			token: signPayload({
				gameId,
				kind: 'player',
				color: guestColor,
				rnd: randomUUID().slice(0, 12)
			}),
			color: guestColor,
			state: record.state
		};
	});
}

export async function playMove(
	gameId: string,
	token: string,
	move: PlayerMove
): Promise<GameState> {
	const payload = readToken(token);
	if (!payload || payload.gameId !== gameId) {
		throw new Error('Session joueur invalide');
	}

	return queueMutation(gameId, () => {
		const record = getGameOrThrow(gameId);
		const now = Date.now();
		if (applyTimeoutIfExpired(record, now)) {
			emitSnapshot(record);
			return record.state;
		}

		const actorColor = resolveActorColor(record.state, payload);
		if (!actorColor) {
			throw new Error('Session joueur invalide');
		}

		if (record.state.timeControlEnabled && record.state.timeRemainingMs) {
			const remaining = getRemainingTurnMs(record.state, actorColor, now);
			if (remaining === null || remaining <= 0) {
				record.state.timeRemainingMs[actorColor] = 0;
				finalizeWinner(record, oppositeColor(actorColor), now);
				emitSnapshot(record);
				return record.state;
			}
			record.state.timeRemainingMs[actorColor] = remaining;
		}

		const beforeMoveState = record.state;
		record.state = applyPlayerMove(record.state, actorColor, move);
		record.state.moveHistory = [
			...beforeMoveState.moveHistory,
			buildHistoryEntry(beforeMoveState, record.state, actorColor, move)
		];

		if (record.state.winner) {
			finalizeWinner(record, record.state.winner, now);
		} else if (hasThreefoldRepetition(record.state.moveHistory)) {
			record.state = createNextRoundState(record.state, true);
		} else if (record.state.timeControlEnabled) {
			record.state.turnStartedAt = now;
		}

		emitSnapshot(record);
		return record.state;
	});
}

export async function requestRematch(gameId: string, token: string): Promise<GameState> {
	const payload = readToken(token);
	if (!payload || payload.gameId !== gameId) {
		throw new Error('Session joueur invalide');
	}

	return queueMutation(gameId, () => {
		const record = getGameOrThrow(gameId);
		const state = record.state;
		const actorColor = resolveActorColor(state, payload);
		if (!actorColor) {
			throw new Error('Session joueur invalide');
		}

		if (!state.winner || state.status !== 'finished') {
			throw new Error("La manche en cours n'est pas terminée");
		}
		if (isBestOfFinished(state)) {
			throw new Error('Le best of 3 est déjà terminé');
		}

		const loser = oppositeColor(state.winner);
		if (actorColor !== loser) {
			throw new Error('Seul le perdant peut proposer une revanche');
		}
		if (state.rematchRequestedBy) {
			throw new Error('Une demande de revanche est déjà en attente');
		}

		state.rematchRequestedBy = actorColor;
		state.lastActivityAt = Date.now();
		state.version += 1;

		emitSnapshot(record);
		return state;
	});
}

export async function acceptRematch(gameId: string, token: string): Promise<GameState> {
	const payload = readToken(token);
	if (!payload || payload.gameId !== gameId) {
		throw new Error('Session joueur invalide');
	}

	return queueMutation(gameId, () => {
		const record = getGameOrThrow(gameId);
		const state = record.state;
		const actorColor = resolveActorColor(state, payload);
		if (!actorColor) {
			throw new Error('Session joueur invalide');
		}

		if (!state.winner || state.status !== 'finished') {
			throw new Error("La manche en cours n'est pas terminée");
		}
		if (isBestOfFinished(state)) {
			throw new Error('Le best of 3 est déjà terminé');
		}
		if (!state.rematchRequestedBy) {
			throw new Error('Aucune demande de revanche en attente');
		}

		const expectedAccepter = oppositeColor(state.rematchRequestedBy);
		if (actorColor !== expectedAccepter) {
			throw new Error("Seul l'adversaire peut accepter la revanche");
		}
		if (!state.players.white || !state.players.black) {
			throw new Error('Deux joueurs sont requis pour lancer la revanche');
		}

		record.state = createNextRoundState(state, true);

		emitSnapshot(record);
		return record.state;
	});
}

export function viewerRoleFromToken(gameId: string, token: string | undefined): ViewerRole {
	if (!token) {
		return getGameOrThrow(gameId).state.players.white && getGameOrThrow(gameId).state.players.black
			? 'spectator'
			: 'guest';
	}
	const payload = readToken(token);
	if (!payload || payload.gameId !== gameId) {
		return getGameOrThrow(gameId).state.players.white && getGameOrThrow(gameId).state.players.black
			? 'spectator'
			: 'guest';
	}
	if (payload.kind === 'player' && payload.color) {
		const hostColor = getGameOrThrow(gameId).state.hostColor;
		return hostColor ? oppositeColor(hostColor) : payload.color;
	}
	if (payload.kind === 'host') {
		const hostColor = getGameOrThrow(gameId).state.hostColor;
		return hostColor ?? 'guest';
	}
	return 'guest';
}

export function toView(
	state: GameState,
	viewerRole: ViewerRole | null,
	viewerIsInviter = false
): GameView {
	const role = viewerRole ?? 'spectator';
	const viewerColor: Color | null = role === 'white' || role === 'black' ? role : null;
	return {
		state,
		viewerRole: role,
		viewerColor,
		viewerIsInviter,
		joinAllowed: (!state.players.white || !state.players.black) && !viewerIsInviter,
		legalOptions: viewerColor
			? getLegalOptionsForColor(state, viewerColor)
			: { byBoardFrom: {}, byReservePiece: { pawn: [], rook: [], knight: [], bishop: [] } }
	};
}

export function getViewForRequest(gameId: string, token: string | undefined): GameView {
	const record = getGameOrThrow(gameId);
	const now = Date.now();
	applyTimeoutIfExpired(record, now);
	record.state.lastActivityAt = now;
	const payload = token ? readToken(token) : null;
	const viewerIsInviter = Boolean(payload && payload.gameId === gameId && payload.kind === 'host');
	const role = viewerRoleFromToken(gameId, token);
	return toView(record.state, role, viewerIsInviter);
}

export function subscribeToGame(gameId: string, subscriber: Subscriber): () => void {
	const record = getGameOrThrow(gameId);
	record.subscribers.add(subscriber);

	return () => {
		record.subscribers.delete(subscriber);
	};
}
