import { AUTH_COOKIE_NAME, getAccountById, parseAuthCookie } from './auth-store';

export interface AuthenticatedAccount {
	id: string;
	username: string;
}

export async function requireAuthenticatedAccount(cookies: {
	get(name: string): string | undefined;
}): Promise<AuthenticatedAccount> {
	const cookieValue = cookies.get(AUTH_COOKIE_NAME);
	const userId = parseAuthCookie(cookieValue);
	if (!userId) {
		throw new Error('errors.notAuthenticated');
	}
	const account = await getAccountById(userId);
	if (!account) {
		throw new Error('errors.notAuthenticated');
	}
	return { id: account.id, username: account.username };
}
