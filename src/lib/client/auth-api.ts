import { localizeServerError } from '$lib/i18n';
import {
	registerRemote as _registerRemote,
	loginWithTokenRemote as _loginWithTokenRemote,
	logoutRemote as _logoutRemote,
	getAuthStateRemote as _getAuthStateRemote,
	rotateTokenRemote as _rotateTokenRemote
} from '../../routes/api/auth.remote';

export interface AuthState {
	authenticated: boolean;
	username?: string;
	userId?: string;
}

async function wrapCall<T>(call: () => Promise<T>): Promise<T> {
	try {
		return await call();
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : 'errors.unexpected';
		throw new Error(localizeServerError(message));
	}
}

export async function registerRemote(
	username: string
): Promise<{ rawToken: string; username: string }> {
	return wrapCall(() => _registerRemote({ username }));
}

export async function loginWithTokenRemote(token: string): Promise<{ username: string }> {
	return wrapCall(() => _loginWithTokenRemote({ token }));
}

export async function logoutRemote(): Promise<void> {
	await wrapCall(() => _logoutRemote());
}

export async function getAuthStateRemote(): Promise<AuthState> {
	return wrapCall(() => _getAuthStateRemote());
}

export async function rotateTokenRemote(): Promise<{ rawToken: string }> {
	return wrapCall(() => _rotateTokenRemote());
}
