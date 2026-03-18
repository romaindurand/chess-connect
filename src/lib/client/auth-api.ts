export interface AuthState {
	authenticated: boolean;
	username?: string;
	userId?: string;
}

async function readJsonOrThrow<T>(response: Response): Promise<T> {
	const payload = (await response.json()) as T | { error: string };
	if (!response.ok) {
		const message =
			typeof payload === 'object' && payload !== null && 'error' in payload
				? String((payload as { error: string }).error)
				: 'Erreur inattendue';
		throw new Error(message);
	}
	return payload as T;
}

export async function registerRemote(
	username: string
): Promise<{ rawToken: string; username: string }> {
	const response = await fetch('/api/auth/register', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username })
	});
	return readJsonOrThrow<{ rawToken: string; username: string }>(response);
}

export async function loginWithTokenRemote(token: string): Promise<{ username: string }> {
	const response = await fetch('/api/auth/login-token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ token })
	});
	return readJsonOrThrow<{ username: string }>(response);
}

export async function logoutRemote(): Promise<void> {
	await fetch('/api/auth/logout', { method: 'POST' });
}

export async function getAuthStateRemote(): Promise<AuthState> {
	const response = await fetch('/api/auth/me');
	return readJsonOrThrow<AuthState>(response);
}

export async function rotateTokenRemote(): Promise<{ rawToken: string }> {
	const response = await fetch('/api/auth/token/rotate', { method: 'POST' });
	return readJsonOrThrow<{ rawToken: string }>(response);
}