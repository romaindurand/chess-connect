export interface MatchmakingConfig {
	baseRatingRange: number;
	rangeStepPerWindow: number;
	rangeWindowSeconds: number;
	maxRatingRange: number;
	proposalTtlSeconds: number;
	queueKeepAliveSeconds: number;
	pollingIntervalMs: number;
	maxRematches: number;
}

export const DEFAULT_MATCHMAKING_CONFIG: MatchmakingConfig = {
	baseRatingRange: 75,
	rangeStepPerWindow: 40,
	rangeWindowSeconds: 20,
	maxRatingRange: 400,
	proposalTtlSeconds: 20,
	queueKeepAliveSeconds: 30,
	pollingIntervalMs: 1_000,
	maxRematches: 2
};

export function computeRatingSearchRange(
	waitSeconds: number,
	config: MatchmakingConfig = DEFAULT_MATCHMAKING_CONFIG
): number {
	const nonNegativeWait = Math.max(0, Math.floor(waitSeconds));
	const windows = Math.floor(nonNegativeWait / config.rangeWindowSeconds);
	return Math.min(
		config.maxRatingRange,
		config.baseRatingRange + windows * config.rangeStepPerWindow
	);
}
