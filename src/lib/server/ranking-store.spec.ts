import { beforeEach, describe, expect, it, vi } from 'vitest';

type UserRecord = {
	id: string;
	username: string;
	rankedWins: number;
	rankedLosses: number;
};

type RatingRecord = {
	id: string;
	userId: string;
	rating: number;
	ratingDeviation: number;
	volatility: number;
	gamesPlayed: number;
};

type ResultRecord = {
	id: string;
	gameId: string;
	winnerUserId: string;
	loserUserId: string;
	winnerBefore: number;
	winnerAfter: number;
	loserBefore: number;
	loserAfter: number;
	winnerDelta: number;
	loserDelta: number;
};

const users: UserRecord[] = [];
const ratings: RatingRecord[] = [];
const results: ResultRecord[] = [];

vi.mock('./db', () => {
	return {
		db: {
			playerRating: {
				findUnique: vi.fn(async ({ where }: { where: { userId: string } }) => {
					return ratings.find((item) => item.userId === where.userId) ?? null;
				}),
				create: vi.fn(async ({ data }: { data: Omit<RatingRecord, 'id'> }) => {
					const next = { id: `pr_${Math.random().toString(36).slice(2)}`, ...data };
					ratings.push(next);
					return next;
				}),
				update: vi.fn(
					async ({ where, data }: { where: { userId: string }; data: Partial<RatingRecord> }) => {
						const found = ratings.find((item) => item.userId === where.userId);
						if (!found) {
							throw new Error('not found');
						}
						Object.assign(found, data);
						return found;
					}
				),
				findMany: vi.fn(async ({ take }: { take: number }) => {
					return ratings
						.slice()
						.sort((a, b) => b.rating - a.rating)
						.slice(0, take)
						.map((rating) => {
							const user = users.find((u) => u.id === rating.userId);
							return {
								...rating,
								user: {
									username: user?.username ?? 'unknown',
									rankedWins: user?.rankedWins ?? 0,
									rankedLosses: user?.rankedLosses ?? 0
								}
							};
						});
				})
			},
			userAccount: {
				update: vi.fn(
					async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
						const found = users.find((item) => item.id === where.id);
						if (!found) {
							throw new Error('not found');
						}
						if (
							typeof data.rankedWins === 'object' &&
							data.rankedWins &&
							'increment' in data.rankedWins
						) {
							found.rankedWins += Number((data.rankedWins as { increment: number }).increment);
						}
						if (
							typeof data.rankedLosses === 'object' &&
							data.rankedLosses &&
							'increment' in data.rankedLosses
						) {
							found.rankedLosses += Number((data.rankedLosses as { increment: number }).increment);
						}
						return found;
					}
				)
			},
			rankedResult: {
				findUnique: vi.fn(async ({ where }: { where: { gameId: string } }) => {
					return results.find((item) => item.gameId === where.gameId) ?? null;
				}),
				create: vi.fn(async ({ data }: { data: Omit<ResultRecord, 'id'> }) => {
					const next = { id: `rr_${Math.random().toString(36).slice(2)}`, ...data };
					results.push(next);
					return next;
				})
			}
		}
	};
});

import {
	DEFAULT_RANKING_CONFIG,
	applyRankedResult,
	getOrCreatePlayerRating,
	listLadder
} from './ranking-store';

beforeEach(() => {
	users.length = 0;
	ratings.length = 0;
	results.length = 0;

	users.push(
		{ id: 'u1', username: 'Alice', rankedWins: 0, rankedLosses: 0 },
		{ id: 'u2', username: 'Bob', rankedWins: 0, rankedLosses: 0 }
	);
});

describe('ranking-store', () => {
	it('creates a default rating on first access', async () => {
		const rating = await getOrCreatePlayerRating('u1');

		expect(rating.rating).toBe(DEFAULT_RANKING_CONFIG.initialRating);
		expect(rating.ratingDeviation).toBe(DEFAULT_RANKING_CONFIG.initialRatingDeviation);
		expect(rating.volatility).toBe(DEFAULT_RANKING_CONFIG.initialVolatility);
		expect(rating.gamesPlayed).toBe(0);
	});

	it('returns ladder sorted by rating', async () => {
		ratings.push(
			{
				id: 'r1',
				userId: 'u1',
				rating: 1330,
				ratingDeviation: 70,
				volatility: 0.06,
				gamesPlayed: 24
			},
			{
				id: 'r2',
				userId: 'u2',
				rating: 1280,
				ratingDeviation: 85,
				volatility: 0.06,
				gamesPlayed: 17
			}
		);

		const ladder = await listLadder();

		expect(ladder).toHaveLength(2);
		expect(ladder[0]?.username).toBe('Alice');
		expect(ladder[0]?.rating).toBe(1330);
		expect(ladder[1]?.username).toBe('Bob');
	});

	it('updates ratings and stores ranked result', async () => {
		ratings.push(
			{
				id: 'r1',
				userId: 'u1',
				rating: 1200,
				ratingDeviation: 80,
				volatility: 0.06,
				gamesPlayed: 12
			},
			{
				id: 'r2',
				userId: 'u2',
				rating: 1380,
				ratingDeviation: 85,
				volatility: 0.06,
				gamesPlayed: 18
			}
		);

		const outcome = await applyRankedResult({
			gameId: 'game-1',
			winnerUserId: 'u1',
			loserUserId: 'u2'
		});

		expect(outcome.winnerDelta).toBeGreaterThan(0);
		expect(outcome.loserDelta).toBeLessThan(0);
		expect(results).toHaveLength(1);
		expect(results[0]?.gameId).toBe('game-1');
		expect(users.find((u) => u.id === 'u1')?.rankedWins).toBe(1);
		expect(users.find((u) => u.id === 'u2')?.rankedLosses).toBe(1);
	});
});
