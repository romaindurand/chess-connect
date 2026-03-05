import { createHmac, randomUUID } from 'node:crypto';

import { applyPlayerMove, createInitialBoard, getLegalOptionsForColor } from './game-engine';
import {
	makeEmptyReserve,
	type Color,
	type GameState,
	type GameView,
	type PlayerMove,
	type ServerEvent,
	type ViewerRole
} from '$lib/types/game';

const DAY_MS = 24 * 60 * 60 * 1000;
const HEARTBEAT_MS = 15_000;
const SECRET = process.env.CHESS_CONNECT_SECRET ?? randomUUID();

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
			const event: ServerEvent = { type: 'keepalive', at: Date.now() };
			for (const game of store.games.values()) {
				for (const subscriber of game.subscribers) {
					subscriber(event);
				}
			}
		}, HEARTBEAT_MS)
	};

	globalThis.__chessConnectStore = store;
	return store;
}

function createNewState(gameId: string, creatorName: string): { state: GameState } {
	const now = Date.now();
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
			rematchRequestedBy: null,
			createdAt: now,
			lastActivityAt: now,
			version: 0
		}
	};
}

function isBestOfFinished(state: GameState): boolean {
	return Boolean(state.bestOfWinner || state.score.white >= 2 || state.score.black >= 2);
}

function oppositeColor(color: Color): Color {
	return color === 'white' ? 'black' : 'white';
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

export function createGame(creatorName: string): {
	state: GameState;
	token: string;
	color: Color | null;
} {
	const store = getStore();
	const gameId = randomUUID().slice(0, 8);
	const { state } = createNewState(gameId, creatorName);

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
		const actorColor: Color | null =
			payload.kind === 'player' ? payload.color : record.state.hostColor;
		if (!actorColor) {
			throw new Error('Session joueur invalide');
		}
		const beforeWinner = record.state.winner;
		record.state = applyPlayerMove(record.state, actorColor, move);

		if (!beforeWinner && record.state.winner) {
			const winner = record.state.winner;
			record.state.score[winner] += 1;
			record.state.rematchRequestedBy = null;
			if (record.state.score[winner] >= 2) {
				record.state.bestOfWinner = winner;
			}
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
		const actorColor: Color | null = payload.kind === 'player' ? payload.color : state.hostColor;
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
		const actorColor: Color | null = payload.kind === 'player' ? payload.color : state.hostColor;
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

		record.state = {
			...state,
			status: 'active',
			board: createInitialBoard(),
			reserves: {
				white: makeEmptyReserve(),
				black: makeEmptyReserve()
			},
			turn: 'white',
			pliesPlayed: 0,
			winner: null,
			gameNumber: state.gameNumber + 1,
			rematchRequestedBy: null,
			lastActivityAt: Date.now(),
			version: state.version + 1
		};

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
		return payload.color;
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
	record.state.lastActivityAt = Date.now();
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
