import { json } from '@sveltejs/kit';

import {
	acceptRematch,
	cookieName,
	getViewForRequest,
	joinGame,
	playMove,
	requestRematch
} from '$lib/server/game-store';
import type {
	GameActionPayload,
	JoinGamePayload,
	PlayMovePayload,
	RematchAcceptPayload,
	RematchRequestPayload
} from '$lib/types/game';
import type { RequestHandler } from './$types';

function parseActionPayload(body: unknown): GameActionPayload {
	if (!body || typeof body !== 'object' || !('type' in body)) {
		throw new Error('Payload invalide');
	}

	if (body.type === 'join') {
		const joinBody = body as Partial<JoinGamePayload>;
		if (typeof joinBody.name !== 'string') {
			throw new Error('Le nom est obligatoire');
		}
		const name = joinBody.name.trim();
		if (name.length < 2 || name.length > 24) {
			throw new Error('Le nom doit contenir entre 2 et 24 caractères');
		}
		return {
			type: 'join',
			name
		};
	}

	if (body.type === 'play') {
		const playBody = body as Partial<PlayMovePayload>;
		if (!playBody.move || typeof playBody.move !== 'object' || !('kind' in playBody.move)) {
			throw new Error('Coup invalide');
		}
		return {
			type: 'play',
			move: playBody.move
		} as PlayMovePayload;
	}

	if (body.type === 'rematch-request') {
		return {
			type: 'rematch-request'
		} as RematchRequestPayload;
	}

	if (body.type === 'rematch-accept') {
		return {
			type: 'rematch-accept'
		} as RematchAcceptPayload;
	}

	throw new Error("Type d'action inconnu");
}

export const GET: RequestHandler = async ({ params, cookies }) => {
	try {
		const gameId = params.id;
		const token = cookies.get(cookieName(gameId));
		const view = getViewForRequest(gameId, token);
		return json(view);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Erreur de lecture de partie';
		return json({ error: message }, { status: 404 });
	}
};

export const POST: RequestHandler = async ({ params, request, cookies }) => {
	try {
		const gameId = params.id;
		const payload = parseActionPayload(await request.json());

		if (payload.type === 'join') {
			const result = await joinGame(gameId, payload.name);
			cookies.set(cookieName(gameId), result.token, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				maxAge: 60 * 60 * 24
			});

			const view = getViewForRequest(gameId, result.token);
			return json(view);
		}

		const token = cookies.get(cookieName(gameId));
		if (!token) {
			return json({ error: 'Session joueur manquante' }, { status: 401 });
		}

		if (payload.type === 'play') {
			await playMove(gameId, token, payload.move);
		}
		if (payload.type === 'rematch-request') {
			await requestRematch(gameId, token);
		}
		if (payload.type === 'rematch-accept') {
			await acceptRematch(gameId, token);
		}
		const view = getViewForRequest(gameId, token);
		return json(view);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Action impossible';
		return json({ error: message }, { status: 400 });
	}
};
