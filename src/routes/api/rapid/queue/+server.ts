import { json } from '@sveltejs/kit';

import { requireAuthenticatedAccount } from '$lib/server/ranked-auth';
import { getRapidQueueView, joinRapidQueue, leaveRapidQueue } from '$lib/server/rapid-matchmaking';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	try {
		const account = await requireAuthenticatedAccount(cookies);
		const queue = await getRapidQueueView(account.id);
		return json(queue);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'errors.notAuthenticated';
		return json({ error: message }, { status: 401 });
	}
};

export const POST: RequestHandler = async ({ cookies }) => {
	try {
		const account = await requireAuthenticatedAccount(cookies);
		const queue = await joinRapidQueue(account.id);
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
		await leaveRapidQueue(account.id);
		return json({ ok: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'errors.notAuthenticated';
		const status = message === 'errors.notAuthenticated' ? 401 : 400;
		return json({ error: message }, { status });
	}
};
