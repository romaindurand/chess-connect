import { db } from './db';
import { createGame, joinGame } from './game-store';
import { DEFAULT_MATCHMAKING_CONFIG, computeRatingSearchRange } from './ranked-matchmaking-config';
import { getOrCreatePlayerRating } from './ranking-store';

interface ProposalParticipantView {
	userId: string;
	username: string;
	rating: number;
	acceptedAt: string | null;
	rejectedAt: string | null;
}

export interface QueueView {
	queued: boolean;
	enteredAt: string | null;
	waitSeconds: number;
	searchRange: number;
	proposal: {
		id: string;
		expiresAt: string;
		gameId: string | null;
		participants: ProposalParticipantView[];
	} | null;
}

export interface MatchAcceptanceResult {
	proposalId: string;
	accepted: boolean;
	gameId: string | null;
	token: string | null;
}

const RANKED_DEFAULTS = {
	incrementPerMoveSeconds: 10,
	roundLimit: DEFAULT_MATCHMAKING_CONFIG.maxRematches + 1,
	allowAiTrainingData: false,
	opponentType: 'human' as const,
	hostColor: 'random' as const,
	aiDifficulty: 'baseline' as const,
	isRanked: true
};

function nowDate(): Date {
	return new Date();
}

function toIso(date: Date | null): string | null {
	return date ? date.toISOString() : null;
}

async function removeExpiredData(reference: Date): Promise<void> {
	await db.rankedQueueEntry.deleteMany({
		where: {
			lastSeenAt: {
				lt: new Date(reference.getTime() - DEFAULT_MATCHMAKING_CONFIG.queueKeepAliveSeconds * 1000)
			}
		}
	});
	await db.rankedMatchProposal.deleteMany({
		where: {
			expiresAt: { lt: reference },
			gameId: null
		}
	});
}

async function hasOpenProposal(userId: string): Promise<boolean> {
	const proposal = await db.rankedMatchParticipant.findFirst({
		where: {
			userId,
			proposal: {
				expiresAt: { gt: nowDate() },
				gameId: null
			}
		}
	});
	return Boolean(proposal);
}

function isCompatible(aRating: number, aRange: number, bRating: number, bRange: number): boolean {
	const diff = Math.abs(aRating - bRating);
	return diff <= aRange && diff <= bRange;
}

async function tryCreateProposalFor(userId: string): Promise<void> {
	if (await hasOpenProposal(userId)) {
		return;
	}

	const selfQueue = await db.rankedQueueEntry.findUnique({
		where: { userId },
		include: {
			user: {
				include: { rating: true }
			}
		}
	});
	if (!selfQueue || !selfQueue.user.rating) {
		return;
	}

	const now = nowDate();
	const openCandidates = await db.rankedQueueEntry.findMany({
		where: {
			userId: { not: userId },
			user: {
				rating: {
					isNot: null
				}
			}
		},
		orderBy: { enteredAt: 'asc' },
		include: {
			user: {
				include: { rating: true }
			}
		}
	});

	const selfWaitSeconds = Math.floor((now.getTime() - selfQueue.enteredAt.getTime()) / 1000);
	const selfRange = computeRatingSearchRange(selfWaitSeconds);

	for (const candidate of openCandidates) {
		if (!candidate.user.rating) {
			continue;
		}
		if (await hasOpenProposal(candidate.userId)) {
			continue;
		}

		const candidateWaitSeconds = Math.floor((now.getTime() - candidate.enteredAt.getTime()) / 1000);
		const candidateRange = computeRatingSearchRange(candidateWaitSeconds);
		if (
			!isCompatible(
				selfQueue.user.rating.rating,
				selfRange,
				candidate.user.rating.rating,
				candidateRange
			)
		) {
			continue;
		}

		await db.rankedMatchProposal.create({
			data: {
				expiresAt: new Date(now.getTime() + DEFAULT_MATCHMAKING_CONFIG.proposalTtlSeconds * 1000),
				participants: {
					create: [
						{
							userId: selfQueue.userId,
							ratingSnapshot: selfQueue.user.rating.rating,
							ratingDeviation: selfQueue.user.rating.ratingDeviation,
							joinedQueueAt: selfQueue.enteredAt
						},
						{
							userId: candidate.userId,
							ratingSnapshot: candidate.user.rating.rating,
							ratingDeviation: candidate.user.rating.ratingDeviation,
							joinedQueueAt: candidate.enteredAt
						}
					]
				}
			}
		});
		return;
	}
}

async function maybeStartRankedGame(proposalId: string): Promise<void> {
	const proposal = await db.rankedMatchProposal.findUnique({
		where: { id: proposalId },
		include: {
			participants: true
		}
	});
	if (!proposal || proposal.gameId) {
		return;
	}

	if (proposal.participants.length !== 2) {
		return;
	}

	if (proposal.participants.some((p) => p.rejectedAt !== null)) {
		return;
	}
	if (proposal.participants.some((p) => p.acceptedAt === null)) {
		return;
	}

	const [first, second] = proposal.participants;
	const host = await db.userAccount.findUnique({ where: { id: first.userId } });
	const guest = await db.userAccount.findUnique({ where: { id: second.userId } });
	if (!host || !guest) {
		return;
	}

	const hostCreated = await createGame(host.username, RANKED_DEFAULTS);
	const joined = await joinGame(hostCreated.state.id, guest.username);

	await db.rankedMatchProposal.update({
		where: { id: proposal.id },
		data: {
			gameId: hostCreated.state.id,
			participants: {
				updateMany: [
					{
						where: { userId: first.userId },
						data: { gameToken: hostCreated.token }
					},
					{
						where: { userId: second.userId },
						data: { gameToken: joined.token }
					}
				]
			}
		}
	});

	await db.rankedQueueEntry.deleteMany({
		where: {
			userId: { in: [first.userId, second.userId] }
		}
	});
}

function mapQueueView(input: {
	queue: {
		enteredAt: Date;
		searchRange: number;
	} | null;
	proposal: {
		id: string;
		expiresAt: Date;
		gameId: string | null;
		participants: Array<{
			userId: string;
			acceptedAt: Date | null;
			rejectedAt: Date | null;
			ratingSnapshot: number;
			user: { username: string };
		}>;
	} | null;
}): QueueView {
	const now = nowDate();
	const waitSeconds = input.queue
		? Math.max(0, Math.floor((now.getTime() - input.queue.enteredAt.getTime()) / 1000))
		: 0;

	return {
		queued: Boolean(input.queue),
		enteredAt: toIso(input.queue?.enteredAt ?? null),
		waitSeconds,
		searchRange: input.queue?.searchRange ?? DEFAULT_MATCHMAKING_CONFIG.baseRatingRange,
		proposal: input.proposal
			? {
					id: input.proposal.id,
					expiresAt: input.proposal.expiresAt.toISOString(),
					gameId: input.proposal.gameId,
					participants: input.proposal.participants.map((participant) => ({
						userId: participant.userId,
						username: participant.user.username,
						rating: participant.ratingSnapshot,
						acceptedAt: toIso(participant.acceptedAt),
						rejectedAt: toIso(participant.rejectedAt)
					}))
				}
			: null
	};
}

export async function joinRankedQueue(userId: string): Promise<QueueView> {
	const now = nowDate();
	await removeExpiredData(now);
	await getOrCreatePlayerRating(userId);

	const existing = await db.rankedQueueEntry.findUnique({ where: { userId } });
	if (!existing) {
		await db.rankedQueueEntry.create({ data: { userId, enteredAt: now, lastSeenAt: now } });
	} else {
		await db.rankedQueueEntry.update({ where: { userId }, data: { lastSeenAt: now } });
	}

	await tryCreateProposalFor(userId);
	return getRankedQueueView(userId);
}

export async function leaveRankedQueue(userId: string): Promise<void> {
	await db.rankedQueueEntry.deleteMany({ where: { userId } });
	await db.rankedMatchParticipant.updateMany({
		where: {
			userId,
			proposal: { gameId: null, expiresAt: { gt: nowDate() } },
			rejectedAt: null
		},
		data: { rejectedAt: nowDate() }
	});
}

export async function heartbeatRankedQueue(userId: string): Promise<QueueView> {
	const now = nowDate();
	await removeExpiredData(now);

	const queue = await db.rankedQueueEntry.findUnique({ where: { userId } });
	if (queue) {
		const waitSeconds = Math.max(0, Math.floor((now.getTime() - queue.enteredAt.getTime()) / 1000));
		await db.rankedQueueEntry.update({
			where: { userId },
			data: {
				lastSeenAt: now,
				searchRange: computeRatingSearchRange(waitSeconds)
			}
		});
		await tryCreateProposalFor(userId);
	}

	return getRankedQueueView(userId);
}

export async function getRankedQueueView(userId: string): Promise<QueueView> {
	const queue = await db.rankedQueueEntry.findUnique({
		where: { userId },
		select: { enteredAt: true, searchRange: true }
	});

	const proposalParticipant = await db.rankedMatchParticipant.findFirst({
		where: {
			userId,
			proposal: { expiresAt: { gt: nowDate() } }
		},
		include: {
			proposal: {
				include: {
					participants: {
						include: {
							user: { select: { username: true } }
						}
					}
				}
			}
		}
	});

	const proposal = proposalParticipant?.proposal
		? {
				id: proposalParticipant.proposal.id,
				expiresAt: proposalParticipant.proposal.expiresAt,
				gameId: proposalParticipant.proposal.gameId,
				participants: proposalParticipant.proposal.participants
			}
		: null;

	return mapQueueView({ queue, proposal });
}

export async function acceptOrRejectProposal(input: {
	userId: string;
	proposalId: string;
	accept: boolean;
}): Promise<MatchAcceptanceResult> {
	const participant = await db.rankedMatchParticipant.findFirst({
		where: {
			proposalId: input.proposalId,
			userId: input.userId
		},
		include: { proposal: true }
	});
	if (!participant || participant.proposal.expiresAt <= nowDate()) {
		throw new Error('errors.matchProposalExpired');
	}
	if (participant.proposal.gameId) {
		return {
			proposalId: input.proposalId,
			accepted: true,
			gameId: participant.proposal.gameId,
			token: participant.gameToken
		};
	}

	if (!input.accept) {
		await db.rankedMatchParticipant.update({
			where: { id: participant.id },
			data: { rejectedAt: nowDate() }
		});
		await db.rankedQueueEntry.deleteMany({ where: { userId: input.userId } });
		const others = await db.rankedMatchParticipant.findMany({
			where: { proposalId: input.proposalId, userId: { not: input.userId }, rejectedAt: null }
		});
		for (const other of others) {
			const queue = await db.rankedQueueEntry.findUnique({ where: { userId: other.userId } });
			if (queue) {
				await db.rankedQueueEntry.update({
					where: { userId: other.userId },
					data: { lastSeenAt: nowDate() }
				});
			}
		}
		return {
			proposalId: input.proposalId,
			accepted: false,
			gameId: null,
			token: null
		};
	}

	await db.rankedMatchParticipant.update({
		where: { id: participant.id },
		data: { acceptedAt: nowDate(), rejectedAt: null }
	});
	await maybeStartRankedGame(input.proposalId);

	const updated = await db.rankedMatchParticipant.findFirst({
		where: { proposalId: input.proposalId, userId: input.userId },
		include: { proposal: true }
	});
	return {
		proposalId: input.proposalId,
		accepted: true,
		gameId: updated?.proposal.gameId ?? null,
		token: updated?.gameToken ?? null
	};
}
