import type {
	CreateGamePayload,
	CreateGameResponse,
	GameActionPayload,
	GameView,
	LadderResponse,
	PlayMovePayload,
	RankedMatchDecisionResponse,
	RankedQueueServerEvent,
	RankedQueueStatus,
	ServerEvent
} from '$lib/types/game';
import { localizeServerError } from '$lib/i18n';
import {
	createGameRemote as _createGameRemote,
	getGameViewRemote as _getGameViewRemote,
	postGameActionRemote as _postGameActionRemote
} from '../../routes/api/games.remote';
import {
	getLadderRemote as _getLadderRemote,
	getRankedQueueStatusRemote as _getRankedQueueStatusRemote,
	joinRankedQueueRemote as _joinRankedQueueRemote,
	leaveRankedQueueRemote as _leaveRankedQueueRemote,
	decideRankedProposalRemote as _decideRankedProposalRemote
} from '../../routes/api/ranked.remote';
import {
	getRapidQueueStatusRemote as _getRapidQueueStatusRemote,
	joinRapidQueueRemote as _joinRapidQueueRemote,
	leaveRapidQueueRemote as _leaveRapidQueueRemote,
	decideRapidProposalRemote as _decideRapidProposalRemote
} from '../../routes/api/rapid.remote';

async function wrapCall<T>(call: () => Promise<T>): Promise<T> {
	try {
		return await call();
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : 'errors.unexpected';
		throw new Error(localizeServerError(message));
	}
}

export async function createGameRemote(payload: CreateGamePayload): Promise<CreateGameResponse> {
	return wrapCall(() => _createGameRemote(payload));
}

export async function getGameViewRemote(gameId: string): Promise<GameView> {
	return wrapCall(() => _getGameViewRemote(gameId));
}

export async function postGameActionRemote(
	gameId: string,
	payload: GameActionPayload
): Promise<GameView> {
	return wrapCall(() => _postGameActionRemote({ gameId, payload }));
}

export async function playMoveRemote(gameId: string, payload: PlayMovePayload): Promise<GameView> {
	return postGameActionRemote(gameId, payload);
}

export async function requestRematchRemote(gameId: string): Promise<GameView> {
	return postGameActionRemote(gameId, { type: 'rematch-request' });
}

export async function acceptRematchRemote(gameId: string): Promise<GameView> {
	return postGameActionRemote(gameId, { type: 'rematch-accept' });
}

// SSE routes are not converted to SvelteKit remote functions
export function openGameEventStream(
	gameId: string,
	onEvent: (event: ServerEvent) => void
): EventSource {
	const source = new EventSource(`/api/games/${gameId}/events`);
	source.onmessage = (message) => {
		const parsed = JSON.parse(message.data) as ServerEvent;
		onEvent(parsed);
	};
	return source;
}

export async function getLadderRemote(limit = 200): Promise<LadderResponse> {
	return wrapCall(() => _getLadderRemote(limit));
}

export async function getRankedQueueStatusRemote(): Promise<RankedQueueStatus> {
	return wrapCall(() => _getRankedQueueStatusRemote());
}

export async function joinRankedQueueRemote(): Promise<RankedQueueStatus> {
	return wrapCall(() => _joinRankedQueueRemote());
}

export async function leaveRankedQueueRemote(): Promise<void> {
	await wrapCall(() => _leaveRankedQueueRemote());
}

export async function decideRankedProposalRemote(
	proposalId: string,
	accept: boolean
): Promise<RankedMatchDecisionResponse> {
	return wrapCall(() => _decideRankedProposalRemote({ proposalId, accept }));
}

export async function claimRankedGameSessionRemote(
	proposalId: string
): Promise<RankedMatchDecisionResponse> {
	return decideRankedProposalRemote(proposalId, true);
}

export async function getRapidQueueStatusRemote(): Promise<RankedQueueStatus> {
	return wrapCall(() => _getRapidQueueStatusRemote());
}

export async function joinRapidQueueRemote(): Promise<RankedQueueStatus> {
	return wrapCall(() => _joinRapidQueueRemote());
}

export async function leaveRapidQueueRemote(): Promise<void> {
	await wrapCall(() => _leaveRapidQueueRemote());
}

export async function decideRapidProposalRemote(
	proposalId: string,
	accept: boolean
): Promise<RankedMatchDecisionResponse> {
	return wrapCall(() => _decideRapidProposalRemote({ proposalId, accept }));
}

export async function claimRapidGameSessionRemote(
	proposalId: string
): Promise<RankedMatchDecisionResponse> {
	return decideRapidProposalRemote(proposalId, true);
}

// SSE routes for matchmakings
export function openRankedQueueEventStream(
	onEvent: (event: RankedQueueServerEvent) => void
): EventSource {
	const source = new EventSource('/api/ranked/queue/events');
	source.onmessage = (message) => {
		const parsed = JSON.parse(message.data) as RankedQueueServerEvent;
		onEvent(parsed);
	};
	return source;
}

export function openRapidQueueEventStream(
	onEvent: (event: RankedQueueServerEvent) => void
): EventSource {
	const source = new EventSource('/api/rapid/queue/events');
	source.onmessage = (message) => {
		const parsed = JSON.parse(message.data) as RankedQueueServerEvent;
		onEvent(parsed);
	};
	return source;
}
