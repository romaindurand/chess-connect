import { error } from '@sveltejs/kit';
import { command, query, getRequestEvent } from '$app/server';
import { z } from 'zod';
import {
	cookieName,
	createGame,
	joinGame,
	playMove,
	requestRematch,
	acceptRematch,
	getViewForRequest
} from '$lib/server/game-store';
import { AUTH_COOKIE_NAME, resolvePlayerNameFromAuth } from '$lib/server/auth-store';
import { maybeApplyRankedResultForGame } from '$lib/server/ranked-results';
import { maybeApplyRapidResultForGame } from '$lib/server/rapid-results';

const coordSchema = z.object({
	x: z.number().int(),
	y: z.number().int()
});

const playerMoveSchema = z.discriminatedUnion('kind', [
	z.object({
		kind: z.literal('place'),
		piece: z.enum(['pawn', 'rook', 'knight', 'bishop']),
		to: coordSchema
	}),
	z.object({
		kind: z.literal('move'),
		from: coordSchema,
		to: coordSchema
	})
]);

const createGameSchema = z.object({
	name: z
		.string({ required_error: 'errors.nameRequired' })
		.min(2, 'errors.nameLength')
		.max(24, 'errors.nameLength'),
	timeLimitSeconds: z
		.number()
		.int('errors.timeLimitInteger')
		.min(1, 'errors.timeLimitRange')
		.max(1800, 'errors.timeLimitRange')
		.optional(),
	incrementPerMoveSeconds: z
		.number()
		.int('errors.incrementPerMoveInteger')
		.min(0, 'errors.incrementPerMoveRange')
		.max(60, 'errors.incrementPerMoveRange')
		.optional(),
	roundLimit: z
		.number()
		.int('errors.roundLimitInteger')
		.refine((n) => n > 0 && n % 2 !== 0, 'errors.roundLimitOddPositive')
		.optional(),
	allowAiTrainingData: z
		.boolean({ invalid_type_error: 'errors.invalidAllowAiTrainingData' })
		.optional(),
	opponentType: z
		.enum(['human', 'ai'], { errorMap: () => ({ message: 'errors.invalidOpponentType' }) })
		.optional(),
	hostColor: z
		.enum(['white', 'black', 'random'], {
			errorMap: () => ({ message: 'errors.invalidHostColor' })
		})
		.optional(),
	aiDifficulty: z
		.enum(['baseline'], { errorMap: () => ({ message: 'errors.invalidAiDifficulty' }) })
		.optional()
});

export const createGameRemote = command(
	createGameSchema,
	async (payload: z.infer<typeof createGameSchema>) => {
		const { cookies, url } = getRequestEvent();
		try {
			const authCookieValue = cookies.get(AUTH_COOKIE_NAME);
			const authenticatedUsername = await resolvePlayerNameFromAuth(authCookieValue);
			const playerName = authenticatedUsername ?? payload.name;

			const { state, token, color } = await createGame(playerName, payload);

			cookies.set(cookieName(state.id), token, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				maxAge: 60 * 60 * 24
			});

			const gameUrl = `${url.origin}/game/${state.id}`;
			return { gameId: state.id, url: gameUrl, color };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'errors.createGameError';
			error(400, message);
		}
	}
);

export const getGameViewRemote = query(z.string(), async (gameId: string) => {
	try {
		await maybeApplyRankedResultForGame(gameId);
		await maybeApplyRapidResultForGame(gameId);
		const { cookies } = getRequestEvent();
		const token = cookies.get(cookieName(gameId));
		const view = getViewForRequest(gameId, token);
		return view;
	} catch (err) {
		const message = err instanceof Error ? err.message : 'errors.readGameError';
		error(404, message);
	}
});

const actionPayloadSchema = z.discriminatedUnion(
	'type',
	[
		z.object({
			type: z.literal('join'),
			name: z
				.string({ required_error: 'errors.nameRequired' })
				.min(2, 'errors.nameLength')
				.max(24, 'errors.nameLength')
		}),
		z.object({
			type: z.literal('play'),
			move: playerMoveSchema
		}),
		z.object({ type: z.literal('rematch-request') }),
		z.object({ type: z.literal('rematch-accept') })
	],
	{ errorMap: () => ({ message: 'errors.invalidActionType' }) }
);

export const postGameActionRemote = command(
	z.object({ gameId: z.string(), payload: actionPayloadSchema }),
	async ({ gameId, payload }: { gameId: string; payload: z.infer<typeof actionPayloadSchema> }) => {
		const { cookies } = getRequestEvent();
		try {
			if (payload.type === 'join') {
				const authCookieValue = cookies.get(AUTH_COOKIE_NAME);
				const authenticatedUsername = await resolvePlayerNameFromAuth(authCookieValue);
				const playerName = authenticatedUsername ?? payload.name;

				const result = await joinGame(gameId, playerName);
				cookies.set(cookieName(gameId), result.token, {
					path: '/',
					httpOnly: true,
					sameSite: 'lax',
					maxAge: 60 * 60 * 24
				});

				return getViewForRequest(gameId, result.token);
			}

			const token = cookies.get(cookieName(gameId));
			if (!token) {
				error(401, 'errors.missingPlayerSession');
			}

			if (payload.type === 'play') {
				await playMove(gameId, token, payload.move);
				await maybeApplyRankedResultForGame(gameId);
				await maybeApplyRapidResultForGame(gameId);
			} else if (payload.type === 'rematch-request') {
				await requestRematch(gameId, token);
			} else if (payload.type === 'rematch-accept') {
				await acceptRematch(gameId, token);
			}

			return getViewForRequest(gameId, token);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'errors.actionImpossible';
			if (err instanceof Error && err.name === 'HttpError') throw err;
			error(400, message);
		}
	}
);
