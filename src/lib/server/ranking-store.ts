import { db } from './db';
import {
	DEFAULT_RANKING_CONFIG,
	computeHeadToHeadRatingUpdate,
	createInitialPlayerRating,
	type PlayerRatingState
} from './rating-engine';

export { DEFAULT_RANKING_CONFIG } from './rating-engine';

export interface LadderEntry {
	userId: string;
	username: string;
	rating: number;
	rankedWins: number;
	rankedLosses: number;
	gamesPlayed: number;
}

export interface RankedResultOutcome {
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

export async function getOrCreatePlayerRating(userId: string): Promise<PlayerRatingState> {
	const existing = await db.playerRating.findUnique({ where: { userId } });
	if (existing) {
		return toRatingState(existing);
	}

	const initial = createInitialPlayerRating(DEFAULT_RANKING_CONFIG);
	const created = await db.playerRating.create({
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

export async function listLadder(limit = 200): Promise<LadderEntry[]> {
	const rows = await db.playerRating.findMany({
		take: limit,
		orderBy: [{ rating: 'desc' }, { gamesPlayed: 'desc' }],
		include: {
			user: {
				select: {
					id: true,
					username: true,
					rankedWins: true,
					rankedLosses: true
				}
			}
		}
	});

	return rows.map((row) => ({
		userId: row.user.id,
		username: row.user.username,
		rating: row.rating,
		rankedWins: row.user.rankedWins,
		rankedLosses: row.user.rankedLosses,
		gamesPlayed: row.gamesPlayed
	}));
}

export async function applyRankedResult(input: {
	gameId: string;
	winnerUserId: string;
	loserUserId: string;
}): Promise<RankedResultOutcome> {
	const existing = await db.rankedResult.findUnique({ where: { gameId: input.gameId } });
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

	const winnerCurrent = await getOrCreatePlayerRating(input.winnerUserId);
	const loserCurrent = await getOrCreatePlayerRating(input.loserUserId);
	const update = computeHeadToHeadRatingUpdate({
		winner: winnerCurrent,
		loser: loserCurrent,
		config: DEFAULT_RANKING_CONFIG
	});

	await db.playerRating.update({
		where: { userId: input.winnerUserId },
		data: {
			rating: update.winner.next.rating,
			ratingDeviation: update.winner.next.ratingDeviation,
			volatility: update.winner.next.volatility,
			gamesPlayed: update.winner.next.gamesPlayed
		}
	});

	await db.playerRating.update({
		where: { userId: input.loserUserId },
		data: {
			rating: update.loser.next.rating,
			ratingDeviation: update.loser.next.ratingDeviation,
			volatility: update.loser.next.volatility,
			gamesPlayed: update.loser.next.gamesPlayed
		}
	});

	await db.userAccount.update({
		where: { id: input.winnerUserId },
		data: { rankedWins: { increment: 1 } }
	});
	await db.userAccount.update({
		where: { id: input.loserUserId },
		data: { rankedLosses: { increment: 1 } }
	});

	await db.rankedResult.create({
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

	return {
		winnerBefore: winnerCurrent.rating,
		winnerAfter: update.winner.next.rating,
		winnerDelta: update.winner.delta,
		loserBefore: loserCurrent.rating,
		loserAfter: update.loser.next.rating,
		loserDelta: update.loser.delta
	};
}

export async function applyRankedResultByUsernames(input: {
	gameRoundKey: string;
	winnerUsername: string;
	loserUsername: string;
}): Promise<RankedResultOutcome | null> {
	if (input.winnerUsername === input.loserUsername) {
		return null;
	}

	const winner = await db.userAccount.findUnique({ where: { username: input.winnerUsername } });
	const loser = await db.userAccount.findUnique({ where: { username: input.loserUsername } });
	if (!winner || !loser) {
		return null;
	}

	return applyRankedResult({
		gameId: input.gameRoundKey,
		winnerUserId: winner.id,
		loserUserId: loser.id
	});
}
