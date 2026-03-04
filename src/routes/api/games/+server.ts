import { json } from '@sveltejs/kit';

import { cookieName, createGame } from '$lib/server/game-store';
import type { CreateGamePayload } from '$lib/types/game';
import type { RequestHandler } from './$types';

function parseCreatePayload(body: unknown): CreateGamePayload {
	if (!body || typeof body !== 'object' || !('name' in body)) {
		throw new Error('Payload invalide');
	}
	const nameValue = body.name;
	if (typeof nameValue !== 'string') {
		throw new Error('Le nom est obligatoire');
	}
	const name = nameValue.trim();
	if (name.length < 2 || name.length > 24) {
		throw new Error('Le nom doit contenir entre 2 et 24 caractères');
	}
	return { name };
}

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	try {
		const payload = parseCreatePayload(await request.json());
		const { state, token, color } = createGame(payload.name);
		cookies.set(cookieName(state.id), token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24
		});

		const gameUrl = `${url.origin}/game/${state.id}`;
		return json({ gameId: state.id, url: gameUrl, color });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Erreur de création de partie';
		return json({ error: message }, { status: 400 });
	}
};
