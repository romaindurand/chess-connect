import { json } from '@sveltejs/kit';
import {
	parseAuthCookie,
	rotateToken,
	signAuthCookie,
	AUTH_COOKIE_NAME
} from '$lib/server/auth-store';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	const cookieValue = cookies.get(AUTH_COOKIE_NAME);
	const userId = parseAuthCookie(cookieValue);
	if (!userId) {
		return json({ error: 'Non authentifié' }, { status: 401 });
	}
	try {
		const newRawToken = await rotateToken(userId);
		// Renew session cookie too
		cookies.set(AUTH_COOKIE_NAME, signAuthCookie(userId), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 30
		});
		return json({ rawToken: newRawToken });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Erreur de rotation';
		return json({ error: message }, { status: 500 });
	}
};
