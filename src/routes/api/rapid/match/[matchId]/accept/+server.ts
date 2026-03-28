import { json } from '@sveltejs/kit';

import { cookieName } from '$lib/server/game-store';
import { requireAuthenticatedAccount } from '$lib/server/ranked-auth';
import { acceptOrRejectProposal } from '$lib/server/rapid-matchmaking';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, params, request }) => {
	try {
		const account = await requireAuthenticatedAccount(cookies);
		const body = (await request.json()) as { accept?: unknown };
		if (typeof body.accept !== 'boolean') {
			return json({ error: 'errors.invalidPayload' }, { status: 400 });
		}

		const result = await acceptOrRejectProposal({
			userId: account.id,
			proposalId: params.matchId,
			accept: body.accept
		});

		if (result.accepted && result.gameId && result.token) {
			cookies.set(cookieName(result.gameId), result.token, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				maxAge: 60 * 60 * 24
			});
		}

		return json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'errors.actionImpossible';
		const status = message === 'errors.notAuthenticated' ? 401 : 400;
		return json({ error: message }, { status });
	}
};
