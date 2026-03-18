import { json } from '@sveltejs/kit';
import { registerAccount, signAuthCookie, AUTH_COOKIE_NAME } from '$lib/server/auth-store';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const body = (await request.json()) as unknown;
		if (!body || typeof body !== 'object' || !('username' in body)) {
			return json({ error: 'errors.usernameRequired' }, { status: 400 });
		}
		const input = body as { username: unknown };
		if (typeof input.username !== 'string') {
			return json({ error: 'errors.usernameMustBeString' }, { status: 400 });
		}
		const username = input.username.trim();
		if (username.length < 2 || username.length > 24) {
			return json({ error: 'errors.nameLength' }, { status: 400 });
		}

		const { userId, rawToken } = await registerAccount(username);

		cookies.set(AUTH_COOKIE_NAME, signAuthCookie(userId), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 30 // 30 days
		});

		// rawToken is returned ONCE — client must show it to the user
		return json({ username, rawToken }, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'errors.createAccountError';
		if (message.includes('Unique constraint') || message.includes('unique')) {
			return json({ error: 'errors.usernameAlreadyTaken' }, { status: 409 });
		}
		return json({ error: message }, { status: 400 });
	}
};
