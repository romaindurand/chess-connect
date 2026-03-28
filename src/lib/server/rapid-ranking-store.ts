import { db } from './db';
import {
	DEFAULT_RANKING_CONFIG,
	computeHeadToHeadRatingUpdate,
	createInitialPlayerRating,
	type PlayerRatingState
} from './rating-engine';

export { DEFAULT_RANKING_CONFIG } from './rating-engine';

export interface RapidResultOutcome {
	winnerBefore: number;
	winnerAfter: number;
	winnerDelta: number;
	loserBefore: number;
	loserAfter: number;
	loserDelta: number;
}

function toRatingState(input: {
	rating: number;
	ratingDeviation: number;
	volatility: number;
	gamesPlayed: number;
}): PlayerRatingState {
	return {
		rating: input.rating,
		ratingDeviation: input.ratingDeviation,
		volatility: input.volatility,
		gamesPlayed: input.gamesPlayed
	};
}

export async function getOrCreateRapidPlayerRating(userId: string): Promise<PlayerRatingState> {
	const existing = await db.rapidPlayerRating.findUnique({ where: { userId } });
	if (existing) {
		return toRatingState(existing);
	}

	const initial = createInitialPlayerRating(DEFAULT_RANKING_CONFIG);
	const created = await db.rapidPlayerRating.create({
		data: {
			userId,
			rating: initial.rating,
			ratingDeviation: initial.ratingDeviation,
			volatility: initial.volatility,
			gamesPlayed: initial.gamesPlayed
		}
	});

	return toRatingState(created);
}

export async function applyRapidResult(input: {
	gameId: string;
	winnerUserId: string;
	loserUserId: string;
}): Promise<RapidResultOutcome> {
	const existing = await db.rapidResult.findUnique({ where: { gameId: input.gameId } });
	if (existing) {
		return {
			winnerBefore: existing.winnerBefore,
			winnerAfter: existing.winnerAfter,
			winnerDelta: existing.winnerDelta,
			loserBefore: existing.loserBefore,
			loserAfter: existing.loserAfter,
			loserDelta: existing.loserDelta
		};
	}

	const winnerCurrent = await getOrCreateRapidPlayerRating(input.winnerUserId);
	const loserCurrent = await getOrCreateRapidPlayerRating(input.loserUserId);
	const update = computeHeadToHeadRatingUpdate({
		winner: winnerCurrent,
		loser: loserCurrent,
		config: DEFAULT_RANKING_CONFIG
	});

	const rapidResult = await db.$transaction(async (tx) => {
		const recheck = await tx.rapidResult.findUnique({
			where: { gameId: input.gameId }
		});
		if (recheck) {
			return recheck;
		}

		await tx.rapidPlayerRating.update({
			where: { userId: input.winnerUserId },
			data: {
				rating: update.winner.next.rating,
				ratingDeviation: update.winner.next.ratingDeviation,
				volatility: update.winner.next.volatility,
				gamesPlayed: update.winner.next.gamesPlayed
			}
		});

		await tx.rapidPlayerRating.update({
			where: { userId: input.loserUserId },
			data: {
				rating: update.loser.next.rating,
				ratingDeviation: update.loser.next.ratingDeviation,
				volatility: update.loser.next.volatility,
				gamesPlayed: update.loser.next.gamesPlayed
			}
		});
		const result = await tx.rapidResult.create({
			data: {
				gameId: input.gameId,
				winnerUserId: input.winnerUserId,
				loserUserId: input.loserUserId,
				winnerBefore: winnerCurrent.rating,
				winnerAfter: update.winner.next.rating,
				loserBefore: loserCurrent.rating,
				loserAfter: update.loser.next.rating,
				winnerDelta: update.winner.delta,
				loserDelta: update.loser.delta
			}
		});
		return result;
	});

	return {
		winnerBefore: rapidResult.winnerBefore,
		winnerAfter: rapidResult.winnerAfter,
		winnerDelta: rapidResult.winnerDelta,
		loserBefore: rapidResult.loserBefore,
		loserAfter: rapidResult.loserAfter,
		loserDelta: rapidResult.loserDelta
	};
}

export async function applyRapidResultByUsernames(input: {
	gameRoundKey: string;
	winnerUsername: string;
	loserUsername: string;
}): Promise<RapidResultOutcome | null> {
	if (input.winnerUsername === input.loserUsername) {
		return null;
	}

	const winner = await db.userAccount.findUnique({ where: { username: input.winnerUsername } });
	const loser = await db.userAccount.findUnique({ where: { username: input.loserUsername } });
	if (!winner || !loser) {
		return null;
	}

	return applyRapidResult({
		gameId: input.gameRoundKey,
		winnerUserId: winner.id,
		loserUserId: loser.id
	});
}
