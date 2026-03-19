import { describe, expect, it } from 'vitest';

import { DEFAULT_MATCHMAKING_CONFIG, computeRatingSearchRange } from './ranked-matchmaking-config';

describe('ranked-matchmaking-config', () => {
	it('starts with base range at queue entry', () => {
		expect(computeRatingSearchRange(0)).toBe(DEFAULT_MATCHMAKING_CONFIG.baseRatingRange);
	});

	it('widens range over time windows', () => {
		const at20s = computeRatingSearchRange(20);
		const at40s = computeRatingSearchRange(40);

		expect(at20s).toBe(
			DEFAULT_MATCHMAKING_CONFIG.baseRatingRange + DEFAULT_MATCHMAKING_CONFIG.rangeStepPerWindow
		);
		expect(at40s).toBe(
			DEFAULT_MATCHMAKING_CONFIG.baseRatingRange + 2 * DEFAULT_MATCHMAKING_CONFIG.rangeStepPerWindow
		);
	});

	it('caps range at configured maximum', () => {
		expect(computeRatingSearchRange(5_000)).toBe(DEFAULT_MATCHMAKING_CONFIG.maxRatingRange);
	});
});
