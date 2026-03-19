const GLICKO2_SCALE = 173.7178;

export interface RankingConfig {
	initialRating: number;
	initialRatingDeviation: number;
	initialVolatility: number;
	volatilityConstraint: number;
	minimumRatingDeviation: number;
	maximumRatingDeviation: number;
}

export const DEFAULT_RANKING_CONFIG: RankingConfig = {
	initialRating: 1200,
	initialRatingDeviation: 350,
	initialVolatility: 0.06,
	volatilityConstraint: 0.5,
	minimumRatingDeviation: 30,
	maximumRatingDeviation: 350
};

export interface PlayerRatingState {
	rating: number;
	ratingDeviation: number;
	volatility: number;
	gamesPlayed: number;
}

interface HeadToHeadUpdateInput {
	winner: PlayerRatingState;
	loser: PlayerRatingState;
	config?: RankingConfig;
}

interface UpdatedPlayer {
	next: PlayerRatingState;
	delta: number;
}

export interface HeadToHeadUpdate {
	winner: UpdatedPlayer;
	loser: UpdatedPlayer;
}

interface GlickoScaleState {
	mu: number;
	phi: number;
	sigma: number;
}

function toGlickoScale(state: PlayerRatingState): GlickoScaleState {
	return {
		mu: (state.rating - 1500) / GLICKO2_SCALE,
		phi: state.ratingDeviation / GLICKO2_SCALE,
		sigma: state.volatility
	};
}

function fromGlickoScale(
	scale: GlickoScaleState,
	gamesPlayed: number,
	config: RankingConfig
): PlayerRatingState {
	const ratingDeviation = Math.min(
		config.maximumRatingDeviation,
		Math.max(config.minimumRatingDeviation, scale.phi * GLICKO2_SCALE)
	);

	return {
		rating: Math.round(scale.mu * GLICKO2_SCALE + 1500),
		ratingDeviation,
		volatility: scale.sigma,
		gamesPlayed
	};
}

function g(phi: number): number {
	return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function expectedScore(mu: number, opponentMu: number, opponentPhi: number): number {
	return 1 / (1 + Math.exp(-g(opponentPhi) * (mu - opponentMu)));
}

function solveNewSigma(phi: number, delta: number, v: number, sigma: number, tau: number): number {
	const a = Math.log(sigma * sigma);
	const epsilon = 0.000001;

	const f = (x: number): number => {
		const ex = Math.exp(x);
		const numerator = ex * (delta * delta - phi * phi - v - ex);
		const denominator = 2 * (phi * phi + v + ex) * (phi * phi + v + ex);
		return numerator / denominator - (x - a) / (tau * tau);
	};

	let A = a;
	let B: number;

	if (delta * delta > phi * phi + v) {
		B = Math.log(delta * delta - phi * phi - v);
	} else {
		let k = 1;
		while (f(a - k * tau) < 0) {
			k += 1;
		}
		B = a - k * tau;
	}

	let fA = f(A);
	let fB = f(B);

	while (Math.abs(B - A) > epsilon) {
		const C = A + ((A - B) * fA) / (fB - fA);
		const fC = f(C);

		if (fC * fB < 0) {
			A = B;
			fA = fB;
		} else {
			fA = fA / 2;
		}

		B = C;
		fB = fC;
	}

	return Math.exp(A / 2);
}

function applySingleResult(
	player: PlayerRatingState,
	opponent: PlayerRatingState,
	score: 0 | 1,
	config: RankingConfig
): PlayerRatingState {
	const current = toGlickoScale(player);
	const other = toGlickoScale(opponent);

	const gPhi = g(other.phi);
	const expected = expectedScore(current.mu, other.mu, other.phi);
	const v = 1 / (gPhi * gPhi * expected * (1 - expected));
	const delta = v * gPhi * (score - expected);
	const sigmaPrime = solveNewSigma(
		current.phi,
		delta,
		v,
		current.sigma,
		config.volatilityConstraint
	);

	const phiStar = Math.sqrt(current.phi * current.phi + sigmaPrime * sigmaPrime);
	const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
	const muPrime = current.mu + phiPrime * phiPrime * gPhi * (score - expected);

	return fromGlickoScale(
		{ mu: muPrime, phi: phiPrime, sigma: sigmaPrime },
		player.gamesPlayed + 1,
		config
	);
}

export function createInitialPlayerRating(
	config: RankingConfig = DEFAULT_RANKING_CONFIG
): PlayerRatingState {
	return {
		rating: config.initialRating,
		ratingDeviation: config.initialRatingDeviation,
		volatility: config.initialVolatility,
		gamesPlayed: 0
	};
}

export function computeHeadToHeadRatingUpdate(input: HeadToHeadUpdateInput): HeadToHeadUpdate {
	const config = input.config ?? DEFAULT_RANKING_CONFIG;
	const winnerNext = applySingleResult(input.winner, input.loser, 1, config);
	const loserNext = applySingleResult(input.loser, input.winner, 0, config);

	return {
		winner: {
			next: winnerNext,
			delta: winnerNext.rating - input.winner.rating
		},
		loser: {
			next: loserNext,
			delta: loserNext.rating - input.loser.rating
		}
	};
}
