import { command, query, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { cookieName } from '$lib/server/game-store';
import { requireAuthenticatedAccount } from '$lib/server/ranked-auth';
import {
	getRapidQueueView,
	joinRapidQueue,
	leaveRapidQueue,
	acceptOrRejectProposal
} from '$lib/server/rapid-matchmaking';

export const getRapidQueueStatusRemote = query(async () => {
	const { cookies } = getRequestEvent();
	try {
		const account = await requireAuthenticatedAccount(cookies);
		return await getRapidQueueView(account.id);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'errors.notAuthenticated';
		error(401, message);
	}
});

export const joinRapidQueueRemote = command(async () => {
	const { cookies } = getRequestEvent();
	try {
		const account = await requireAuthenticatedAccount(cookies);
		return await joinRapidQueue(account.id);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'errors.notAuthenticated';
		const status = message === 'errors.notAuthenticated' ? 401 : 400;
		error(status, message);
	}
});

export const leaveRapidQueueRemote = command(async () => {
	const { cookies } = getRequestEvent();
	try {
		const account = await requireAuthenticatedAccount(cookies);
		await leaveRapidQueue(account.id);
		return { ok: true };
	} catch (err) {
		const message = err instanceof Error ? err.message : 'errors.notAuthenticated';
		const status = message === 'errors.notAuthenticated' ? 401 : 400;
		error(status, message);
	}
});

export const decideRapidProposalRemote = command(
	z.object({
		proposalId: z.string(),
		accept: z.boolean()
	}),
	async ({ proposalId, accept }: { proposalId: string; accept: boolean }) => {
		const { cookies } = getRequestEvent();
		try {
			const account = await requireAuthenticatedAccount(cookies);

			const result = await acceptOrRejectProposal({
				userId: account.id,
				proposalId,
				accept
			});

			if (result.accepted && result.gameId && result.token) {
				cookies.set(cookieName(result.gameId), result.token, {
					path: '/',
					httpOnly: true,
					sameSite: 'lax',
					maxAge: 60 * 60 * 24
				});
			}

			return result;
		} catch (err) {
			const message = err instanceof Error ? err.message : 'errors.actionImpossible';
			const status = message === 'errors.notAuthenticated' ? 401 : 400;
			error(status, message);
		}
	}
);
