import type {
	CreateGamePayload,
	CreateGameResponse,
	GameActionPayload,
	GameView,
	PlayMovePayload,
	ServerEvent
} from '$lib/types/game';
import { localizeServerError, translate } from '$lib/i18n';

async function readJsonOrThrow<T>(response: Response): Promise<T> {
	const payload = (await response.json()) as T | { error: string };
	if (!response.ok) {
		const message =
			typeof payload === 'object' && payload !== null && 'error' in payload
				? localizeServerError(String(payload.error))
				: translate('errors.unexpected');
		throw new Error(message);
	}
	return payload as T;
}

export async function createGameRemote(payload: CreateGamePayload): Promise<CreateGameResponse> {
	const response = await fetch('/api/games', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	return readJsonOrThrow<CreateGameResponse>(response);
}

export async function getGameViewRemote(gameId: string): Promise<GameView> {
	const response = await fetch(`/api/games/${gameId}`);
	return readJsonOrThrow<GameView>(response);
}

export async function postGameActionRemote(
	gameId: string,
	payload: GameActionPayload
): Promise<GameView> {
	const response = await fetch(`/api/games/${gameId}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	return readJsonOrThrow<GameView>(response);
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
