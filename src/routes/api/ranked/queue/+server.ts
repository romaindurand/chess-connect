import { json } from '@sveltejs/kit';

import { requireAuthenticatedAccount } from '$lib/server/ranked-auth';
import {
	getRankedQueueView,
	joinRankedQueue,
	leaveRankedQueue
} from '$lib/server/ranked-matchmaking';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	try {
		const account = await requireAuthenticatedAccount(cookies);
		const queue = await getRankedQueueView(account.id);
		return json(queue);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'errors.notAuthenticated';
		return json({ error: message }, { status: 401 });
	}
};

export const POST: RequestHandler = async ({ cookies }) => {
	try {
		const account = await requireAuthenticatedAccount(cookies);
		const queue = await joinRankedQueue(account.id);
		return json(queue);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'errors.notAuthenticated';
		const status = message === 'errors.notAuthenticated' ? 401 : 400;
		return json({ error: message }, { status });
	}
};

export const DELETE: RequestHandler = async ({ cookies }) => {
	try {
		const account = await requireAuthenticatedAccount(cookies);
		await leaveRankedQueue(account.id);
		return json({ ok: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'errors.notAuthenticated';
		const status = message === 'errors.notAuthenticated' ? 401 : 400;
		return json({ error: message }, { status });
	}
};
