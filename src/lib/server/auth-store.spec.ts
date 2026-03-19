import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';

// Mock Prisma to avoid a real DB in unit tests
vi.mock('./db', () => {
	const mockTokens: Array<{
		id: string;
		userId: string;
		tokenHash: string;
		revokedAt: Date | null;
		createdAt: Date;
		lastUsedAt: Date | null;
		user?: { id: string; username: string };
	}> = [];
	const mockUsers: Array<{ id: string; username: string; createdAt: Date; updatedAt: Date }> = [];

	return {
		db: {
			userAccount: {
				create: vi.fn(
					async ({
						data
					}: {
						data: {
							username: string;
							rating?: { create: Record<string, never> };
							tokens?: { create: { tokenHash: string } };
						};
					}) => {
						const user = {
							id: `user_${Math.random().toString(36).slice(2)}`,
							username: data.username,
							createdAt: new Date(),
							updatedAt: new Date()
						};
						mockUsers.push(user);
						if (data.tokens?.create) {
							const token = {
								id: `tok_${Math.random().toString(36).slice(2)}`,
								userId: user.id,
								tokenHash: data.tokens.create.tokenHash,
								revokedAt: null,
								createdAt: new Date(),
								lastUsedAt: null,
								user
							};
							mockTokens.push(token);
						}
						return user;
					}
				),
				findUnique: vi.fn(
					async ({
						where
					}: {
						where: { id?: string; username?: string };
						select?: Record<string, boolean>;
					}) => {
						const user = mockUsers.find((u) =>
							where.id ? u.id === where.id : u.username === where.username
						);
						if (!user) return null;
						return { id: user.id, username: user.username, createdAt: user.createdAt };
					}
				)
			},
			authToken: {
				create: vi.fn(async ({ data }: { data: { userId: string; tokenHash: string } }) => {
					const user = mockUsers.find((u) => u.id === data.userId);
					const token = {
						id: `tok_${Math.random().toString(36).slice(2)}`,
						userId: data.userId,
						tokenHash: data.tokenHash,
						revokedAt: null,
						createdAt: new Date(),
						lastUsedAt: null,
						user: user || { id: data.userId, username: 'unknown' }
					};
					mockTokens.push(token);
					return token;
				}),
				findFirst: vi.fn(
					async ({
						where,
						include
					}: {
						where: { tokenHash: string; revokedAt: null };
						include?: { user: boolean };
					}) => {
						const token = mockTokens.find(
							(t) => t.tokenHash === where.tokenHash && t.revokedAt === null
						);
						if (!token) return null;
						if (include?.user) {
							const user = mockUsers.find((u) => u.id === token.userId);
							if (user) return { ...token, user };
						}
						return token;
					}
				),
				updateMany: vi.fn(
					async ({
						where,
						data
					}: {
						where: { userId: string; revokedAt: null };
						data: { revokedAt: Date };
					}) => {
						let count = 0;
						mockTokens.forEach((t) => {
							if (t.userId === where.userId && t.revokedAt === null) {
								t.revokedAt = data.revokedAt;
								count++;
							}
						});
						return { count };
					}
				),
				update: vi.fn(
					async ({ where, data }: { where: { id: string }; data: { lastUsedAt: Date } }) => {
						const t = mockTokens.find((x) => x.id === where.id);
						if (t) t.lastUsedAt = data.lastUsedAt;
						return t;
					}
				)
			},
			$transaction: vi.fn(async (ops: Promise<unknown>[]) => {
				return Promise.all(ops);
			})
		}
	};
});

import {
	registerAccount,
	loginWithToken,
	revokeToken,
	rotateToken,
	parseAuthCookie,
	signAuthCookie
} from './auth-store';

describe('auth-store', () => {
	describe('registerAccount', () => {
		it('returns a raw token with ccrec_ prefix and a userId', async () => {
			const r = await registerAccount('Alice');
			expect(r.rawToken).toMatch(/^ccrec_/);
			expect(r.rawToken.length).toBeGreaterThan(40);
			expect(r.userId).toBeTruthy();
		});

		it('generates unique tokens on each call', async () => {
			const r1 = await registerAccount('Bob');
			const r2 = await registerAccount('Charlie');
			expect(r1.rawToken).not.toBe(r2.rawToken);
		});
	});

	describe('loginWithToken', () => {
		it('returns account for valid token', async () => {
			const { rawToken } = await registerAccount('Dave');
			const account = await loginWithToken(rawToken);
			expect(account).not.toBeNull();
			expect(account?.username).toBe('Dave');
		});

		it('returns null for unknown token', async () => {
			const result = await loginWithToken('ccrec_unknowntoken123456789012345678');
			expect(result).toBeNull();
		});

		it('returns null for revoked token', async () => {
			const { rawToken, userId } = await registerAccount('Eve');
			await revokeToken(userId);
			const result = await loginWithToken(rawToken);
			expect(result).toBeNull();
		});
	});

	describe('rotateToken', () => {
		it('invalidates old token and returns new valid token', async () => {
			const { rawToken, userId } = await registerAccount('Frank');
			const newRaw = await rotateToken(userId);
			expect(newRaw).toMatch(/^ccrec_/);
			expect(newRaw).not.toBe(rawToken);
			// Old token is invalid
			const old = await loginWithToken(rawToken);
			expect(old).toBeNull();
			// New token is valid
			const fresh = await loginWithToken(newRaw);
			expect(fresh?.username).toBe('Frank');
		});
	});

	describe('signAuthCookie / parseAuthCookie', () => {
		it('round-trip: sign then parse returns same userId', () => {
			const userId = 'user_abc123';
			const cookie = signAuthCookie(userId);
			const parsed = parseAuthCookie(cookie);
			expect(parsed).toBe(userId);
		});

		it('returns null for tampered value', () => {
			const result = parseAuthCookie('user_abc:fakenonce:INVALIDSIG==');
			expect(result).toBeNull();
		});

		it('returns null for empty/undefined value', () => {
			expect(parseAuthCookie('')).toBeNull();
			expect(parseAuthCookie(undefined)).toBeNull();
		});
	});
});

describe('resolvePlayerNameFromAuth', () => {
	it('returns account username when auth cookie is valid and account exists', async () => {
		const { userId } = await registerAccount('Alice');
		const cookie = signAuthCookie(userId);
		const { resolvePlayerNameFromAuth } = await import('./auth-store');

		const result = await resolvePlayerNameFromAuth(cookie);
		expect(result).toBe('Alice');
	});

	it('returns null when no auth cookie is provided', async () => {
		const { resolvePlayerNameFromAuth } = await import('./auth-store');
		const result = await resolvePlayerNameFromAuth(undefined);
		expect(result).toBeNull();
	});

	it('returns null when auth cookie is invalid', async () => {
		const { resolvePlayerNameFromAuth } = await import('./auth-store');
		const result = await resolvePlayerNameFromAuth('invalid:cookie:sig');
		expect(result).toBeNull();
	});

	it('returns null when account is not found', async () => {
		const { resolvePlayerNameFromAuth } = await import('./auth-store');
		const cookie = signAuthCookie('user_nonexistent');
		const result = await resolvePlayerNameFromAuth(cookie);
		expect(result).toBeNull();
	});
});
