import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	getAuthStateRemote,
	loginWithTokenRemote,
	logoutRemote,
	registerRemote,
	rotateTokenRemote
} from '$lib/client/auth-api';

function createJsonResponse(payload: unknown, init?: ResponseInit): Response {
	return new Response(JSON.stringify(payload), {
		headers: { 'Content-Type': 'application/json' },
		...init
	});
}

describe('auth api', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('registers a user and returns the raw token payload', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(createJsonResponse({ rawToken: 'ccrec_token', username: 'Romain' }));
		vi.stubGlobal('fetch', fetchMock);

		await expect(registerRemote('Romain')).resolves.toEqual({
			rawToken: 'ccrec_token',
			username: 'Romain'
		});
		expect(fetchMock).toHaveBeenCalledWith('/api/auth/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'Romain' })
		});
	});

	it('throws the server error message when registration fails', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValue(
					createJsonResponse({ error: "Ce nom d'utilisateur est déjà pris" }, { status: 409 })
				)
		);

		await expect(registerRemote('Romain')).rejects.toThrow("Ce nom d'utilisateur est déjà pris");
	});

	it('loads the current auth state', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValue(
					createJsonResponse({ authenticated: true, username: 'Romain', userId: 'user-1' })
				)
		);

		await expect(getAuthStateRemote()).resolves.toEqual({
			authenticated: true,
			username: 'Romain',
			userId: 'user-1'
		});
	});

	it('logs in with a recovery token and rotates tokens', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(createJsonResponse({ username: 'Romain' }))
			.mockResolvedValueOnce(createJsonResponse({ rawToken: 'ccrec_next' }));
		vi.stubGlobal('fetch', fetchMock);

		await expect(loginWithTokenRemote('ccrec_token')).resolves.toEqual({ username: 'Romain' });
		await expect(rotateTokenRemote()).resolves.toEqual({ rawToken: 'ccrec_next' });
		expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/auth/login-token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ token: 'ccrec_token' })
		});
		expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/auth/token/rotate', { method: 'POST' });
	});

	it('posts logout without expecting a payload', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
		vi.stubGlobal('fetch', fetchMock);

		await expect(logoutRemote()).resolves.toBeUndefined();
		expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
	});
});
