import { json } from '@sveltejs/kit';

import { cookieName, createGame } from '$lib/server/game-store';
import type { CreateGamePayload } from '$lib/types/game';
import type { RequestHandler } from './$types';

function parseCreatePayload(body: unknown): CreateGamePayload {
	if (!body || typeof body !== 'object' || !('name' in body)) {
		throw new Error('Payload invalide');
	}
	const input = body as {
		name: unknown;
		timeLimitMinutes?: unknown;
		roundLimit?: unknown;
		allowAiTrainingData?: unknown;
		opponentType?: unknown;
		hostColor?: unknown;
		aiDifficulty?: unknown;
	};
	const nameValue = input.name;
	if (typeof nameValue !== 'string') {
		throw new Error('Le nom est obligatoire');
	}
	const name = nameValue.trim();
	if (name.length < 2 || name.length > 24) {
		throw new Error('Le nom doit contenir entre 2 et 24 caractères');
	}

	const opponentType = input.opponentType ?? 'human';
	if (opponentType !== 'human' && opponentType !== 'ai') {
		throw new Error("Le type d'adversaire est invalide");
	}

	const hostColor = input.hostColor ?? 'random';
	if (hostColor !== 'white' && hostColor !== 'black' && hostColor !== 'random') {
		throw new Error('La couleur choisie est invalide');
	}

	const aiDifficulty = input.aiDifficulty ?? 'baseline';
	if (aiDifficulty !== 'baseline') {
		throw new Error("Le niveau d'ordinateur est invalide");
	}

	if (input.allowAiTrainingData !== undefined && typeof input.allowAiTrainingData !== 'boolean') {
		throw new Error("L'option d'entraînement ordinateur est invalide");
	}

	if (input.timeLimitMinutes !== undefined) {
		if (typeof input.timeLimitMinutes !== 'number' || !Number.isInteger(input.timeLimitMinutes)) {
			throw new Error('La limite de temps doit être un entier');
		}
		if (input.timeLimitMinutes < 1 || input.timeLimitMinutes > 30) {
			throw new Error('La limite de temps doit être entre 1 et 30 minutes');
		}
	}

	if (input.roundLimit !== undefined) {
		if (typeof input.roundLimit !== 'number' || !Number.isInteger(input.roundLimit)) {
			throw new Error('Le nombre de manches doit être un entier');
		}
		if (input.roundLimit <= 0 || input.roundLimit % 2 === 0) {
			throw new Error('Le nombre de manches doit être impair et strictement positif');
		}
	}

	return {
		name,
		timeLimitMinutes: input.timeLimitMinutes,
		roundLimit: input.roundLimit,
		allowAiTrainingData: input.allowAiTrainingData,
		opponentType,
		hostColor,
		aiDifficulty
	};
}

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	try {
		const payload = parseCreatePayload(await request.json());
		const { state, token, color } = await createGame(payload.name, {
			timeLimitMinutes: payload.timeLimitMinutes,
			roundLimit: payload.roundLimit,
			allowAiTrainingData: payload.allowAiTrainingData,
			opponentType: payload.opponentType,
			hostColor: payload.hostColor,
			aiDifficulty: payload.aiDifficulty
		});
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
