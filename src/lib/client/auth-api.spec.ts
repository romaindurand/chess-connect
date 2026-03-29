import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	getAuthStateRemote,
	loginWithTokenRemote,
	logoutRemote,
	registerRemote,
	rotateTokenRemote
} from '$lib/client/auth-api';
import { initI18n, setLanguage } from '$lib/i18n';

vi.mock('../../routes/api/auth.remote', () => ({
	registerRemote: vi.fn(),
	loginWithTokenRemote: vi.fn(),
	logoutRemote: vi.fn(),
	getAuthStateRemote: vi.fn(),
	rotateTokenRemote: vi.fn()
}));

import * as authRemote from '../../routes/api/auth.remote';

describe('auth api', () => {
	initI18n();
	setLanguage('fr');

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('registers a user and returns the raw token payload', async () => {
		vi.mocked(authRemote.registerRemote).mockResolvedValue({ rawToken: 'ccrec_token', username: 'Romain' });

		await expect(registerRemote('Romain')).resolves.toEqual({
			rawToken: 'ccrec_token',
			username: 'Romain'
		});
		expect(authRemote.registerRemote).toHaveBeenCalledWith({ username: 'Romain' });
	});

	it('throws the server error message when registration fails', async () => {
		vi.mocked(authRemote.registerRemote).mockRejectedValue(
			new Error('errors.usernameAlreadyTaken')
		);

		await expect(registerRemote('Romain')).rejects.toThrow("Ce nom d'utilisateur est déjà pris");
	});

	it('loads the current auth state', async () => {
		vi.mocked(authRemote.getAuthStateRemote).mockResolvedValue({ authenticated: true, username: 'Romain', userId: 'user-1' });

		await expect(getAuthStateRemote()).resolves.toEqual({
			authenticated: true,
			username: 'Romain',
			userId: 'user-1'
		});
	});

	it('logs in with a recovery token and rotates tokens', async () => {
		vi.mocked(authRemote.loginWithTokenRemote).mockResolvedValue({ username: 'Romain' });
		vi.mocked(authRemote.rotateTokenRemote).mockResolvedValue({ rawToken: 'ccrec_next' });

		await expect(loginWithTokenRemote('ccrec_token')).resolves.toEqual({ username: 'Romain' });
		await expect(rotateTokenRemote()).resolves.toEqual({ rawToken: 'ccrec_next' });
		
		expect(authRemote.loginWithTokenRemote).toHaveBeenCalledWith({ token: 'ccrec_token' });
		expect(authRemote.rotateTokenRemote).toHaveBeenCalled();
	});

	it('posts logout without expecting a payload', async () => {
		vi.mocked(authRemote.logoutRemote).mockResolvedValue(undefined);

		await expect(logoutRemote()).resolves.toBeUndefined();
		expect(authRemote.logoutRemote).toHaveBeenCalled();
	});
});
