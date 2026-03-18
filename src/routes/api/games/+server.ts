import { json } from '@sveltejs/kit';

import { cookieName, createGame } from '$lib/server/game-store';
import { AUTH_COOKIE_NAME, resolvePlayerNameFromAuth } from '$lib/server/auth-store';
import type { CreateGamePayload } from '$lib/types/game';
import type { RequestHandler } from './$types';

function parseCreatePayload(body: unknown): CreateGamePayload {
	if (!body || typeof body !== 'object' || !('name' in body)) {
		throw new Error('errors.invalidPayload');
	}
	const input = body as {
		name: unknown;
		timeLimitSeconds?: unknown;
		incrementPerMoveSeconds?: unknown;
		roundLimit?: unknown;
		allowAiTrainingData?: unknown;
		opponentType?: unknown;
		hostColor?: unknown;
		aiDifficulty?: unknown;
	};
	const nameValue = input.name;
	if (typeof nameValue !== 'string') {
		throw new Error('errors.nameRequired');
	}
	const name = nameValue.trim();
	if (name.length < 2 || name.length > 24) {
		throw new Error('errors.nameLength');
	}

	const opponentType = input.opponentType ?? 'human';
	if (opponentType !== 'human' && opponentType !== 'ai') {
		throw new Error('errors.invalidOpponentType');
	}

	const hostColor = input.hostColor ?? 'random';
	if (hostColor !== 'white' && hostColor !== 'black' && hostColor !== 'random') {
		throw new Error('errors.invalidHostColor');
	}

	const aiDifficulty = input.aiDifficulty ?? 'baseline';
	if (aiDifficulty !== 'baseline') {
		throw new Error('errors.invalidAiDifficulty');
	}

	if (input.allowAiTrainingData !== undefined && typeof input.allowAiTrainingData !== 'boolean') {
		throw new Error('errors.invalidAllowAiTrainingData');
	}

	if (input.timeLimitSeconds !== undefined) {
		if (typeof input.timeLimitSeconds !== 'number' || !Number.isInteger(input.timeLimitSeconds)) {
			throw new Error('errors.timeLimitInteger');
		}
		if (input.timeLimitSeconds < 1 || input.timeLimitSeconds > 1800) {
			throw new Error('errors.timeLimitRange');
		}
	}

	if (input.incrementPerMoveSeconds !== undefined) {
		if (
			typeof input.incrementPerMoveSeconds !== 'number' ||
			!Number.isInteger(input.incrementPerMoveSeconds)
		) {
			throw new Error('errors.incrementPerMoveInteger');
		}
		if (input.incrementPerMoveSeconds < 0 || input.incrementPerMoveSeconds > 60) {
			throw new Error('errors.incrementPerMoveRange');
		}
	}

	if (input.roundLimit !== undefined) {
		if (typeof input.roundLimit !== 'number' || !Number.isInteger(input.roundLimit)) {
			throw new Error('errors.roundLimitInteger');
		}
		if (input.roundLimit <= 0 || input.roundLimit % 2 === 0) {
			throw new Error('errors.roundLimitOddPositive');
		}
	}

	return {
		name,
		timeLimitSeconds: input.timeLimitSeconds,
		incrementPerMoveSeconds: input.incrementPerMoveSeconds,
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

		// Try to use authenticated account username if available
		const authCookieValue = cookies.get(AUTH_COOKIE_NAME);
		const authenticatedUsername = await resolvePlayerNameFromAuth(authCookieValue);
		const playerName = authenticatedUsername ?? payload.name;

		const { state, token, color } = await createGame(playerName, {
			timeLimitSeconds: payload.timeLimitSeconds,
			incrementPerMoveSeconds: payload.incrementPerMoveSeconds,
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
		const message = error instanceof Error ? error.message : 'errors.createGameError';
		return json({ error: message }, { status: 400 });
	}
};
