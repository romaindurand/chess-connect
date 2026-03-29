import { command, query, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import {
	registerAccount,
	loginWithToken,
	signAuthCookie,
	getAccountById,
	parseAuthCookie,
	rotateToken,
	AUTH_COOKIE_NAME
} from '$lib/server/auth-store';
import type { AuthState } from '$lib/client/auth-api';

const usernameSchema = z.string()
	.min(2, 'errors.nameLength')
	.max(24, 'errors.nameLength');

export const registerRemote = command(
	z.object({ username: usernameSchema }),
	async ({ username }: { username: string }) => {
		const { cookies } = getRequestEvent();
		try {
			const { userId, rawToken } = await registerAccount(username);

			cookies.set(AUTH_COOKIE_NAME, signAuthCookie(userId), {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				maxAge: 60 * 60 * 24 * 30 // 30 days
			});

			return { username, rawToken };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'errors.createAccountError';
			if (message.includes('Unique constraint') || message.includes('unique')) {
				error(409, 'errors.usernameAlreadyTaken');
			}
			error(400, message);
		}
	}
);

export const loginWithTokenRemote = command(
	z.object({ token: z.string().startsWith('ccrec_', 'errors.invalidKeyFormat') }),
	async ({ token }: { token: string }) => {
		const { cookies } = getRequestEvent();

		const account = await loginWithToken(token);
		if (!account) {
			error(401, 'errors.invalidRecoveryKey');
		}

		cookies.set(AUTH_COOKIE_NAME, signAuthCookie(account.id), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 30
		});

		return { username: account.username };
	}
);

export const logoutRemote = command(async () => {
	const { cookies } = getRequestEvent();
	cookies.delete(AUTH_COOKIE_NAME, { path: '/' });
});

export const getAuthStateRemote = query<AuthState>(async () => {
	const { cookies } = getRequestEvent();
	const cookieValue = cookies.get(AUTH_COOKIE_NAME);
	const userId = parseAuthCookie(cookieValue);
	if (!userId) {
		return { authenticated: false };
	}
	const account = await getAccountById(userId);
	if (!account) {
		cookies.delete(AUTH_COOKIE_NAME, { path: '/' });
		return { authenticated: false };
	}
	return { authenticated: true, username: account.username, userId: account.id };
});

export const rotateTokenRemote = command(async () => {
	const { cookies } = getRequestEvent();
	const cookieValue = cookies.get(AUTH_COOKIE_NAME);
	const userId = parseAuthCookie(cookieValue);
	if (!userId) {
		error(401, 'errors.notAuthenticated');
	}
	try {
		const rawToken = await rotateToken(userId);
		cookies.set(AUTH_COOKIE_NAME, signAuthCookie(userId), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 30
		});
		return { rawToken };
	} catch (err) {
		const message = err instanceof Error ? err.message : 'errors.rotateError';
		error(500, message);
	}
});
