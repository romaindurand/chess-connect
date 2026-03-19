import { describe, expect, it } from 'vitest';

import {
	DEFAULT_RANKING_CONFIG,
	createInitialPlayerRating,
	computeHeadToHeadRatingUpdate,
	type PlayerRatingState
} from './rating-engine';

function makeRating(overrides: Partial<PlayerRatingState> = {}): PlayerRatingState {
	return {
		rating: 1200,
		ratingDeviation: DEFAULT_RANKING_CONFIG.initialRatingDeviation,
		volatility: DEFAULT_RANKING_CONFIG.initialVolatility,
		gamesPlayed: 0,
		...overrides
	};
}

describe('rating-engine', () => {
	it('provides default initial values', () => {
		const initial = createInitialPlayerRating();
		expect(initial.rating).toBe(1200);
		expect(initial.ratingDeviation).toBe(DEFAULT_RANKING_CONFIG.initialRatingDeviation);
		expect(initial.volatility).toBe(DEFAULT_RANKING_CONFIG.initialVolatility);
		expect(initial.gamesPlayed).toBe(0);
	});

	it('awards more points to lower-rated winner (upset)', () => {
		const winner = makeRating({ rating: 1200, ratingDeviation: 80, gamesPlayed: 40 });
		const loser = makeRating({ rating: 1400, ratingDeviation: 80, gamesPlayed: 40 });

		const result = computeHeadToHeadRatingUpdate({
			winner,
			loser
		});

		expect(result.winner.delta).toBeGreaterThan(0);
		expect(result.loser.delta).toBeLessThan(0);
		expect(result.winner.delta).toBeGreaterThan(Math.abs(result.loser.delta) - 1);
		expect(result.winner.next.rating).toBeGreaterThan(winner.rating);
		expect(result.loser.next.rating).toBeLessThan(loser.rating);
	});

	it('awards fewer points when higher-rated player wins', () => {
		const higher = makeRating({ rating: 1450, ratingDeviation: 75, gamesPlayed: 60 });
		const lower = makeRating({ rating: 1200, ratingDeviation: 75, gamesPlayed: 60 });

		const result = computeHeadToHeadRatingUpdate({
			winner: higher,
			loser: lower
		});

		expect(result.winner.delta).toBeGreaterThan(0);
		expect(result.winner.delta).toBeLessThan(15);
		expect(result.loser.delta).toBeLessThan(0);
		expect(Math.abs(result.loser.delta)).toBeLessThan(15);
	});

	it('keeps total delta bounded for a single game', () => {
		const white = makeRating({ rating: 1280, ratingDeviation: 110, gamesPlayed: 15 });
		const black = makeRating({ rating: 1310, ratingDeviation: 95, gamesPlayed: 22 });

		const result = computeHeadToHeadRatingUpdate({
			winner: white,
			loser: black
		});

		const totalDelta = result.winner.delta + result.loser.delta;
		expect(Math.abs(totalDelta)).toBeLessThanOrEqual(12);
	});
});
