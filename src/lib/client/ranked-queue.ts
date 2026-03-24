import type { RankedQueueStatus } from '$lib/types/game';

export function createMatchFoundSoundGate(): {
	shouldPlay: (proposalId: string) => boolean;
} {
	const playedProposalIds = new Set<string>();

	return {
		shouldPlay(proposalId: string): boolean {
			if (playedProposalIds.has(proposalId)) {
				return false;
			}
			playedProposalIds.add(proposalId);
			return true;
		}
	};
}

export function getMatchFoundProposalId(status: RankedQueueStatus | null): string | null {
	const proposal = status?.proposal;
	if (!proposal || proposal.gameId) {
		return null;
	}

	return proposal.id;
}

export function hasAcceptedCurrentProposal(input: {
	status: RankedQueueStatus | null;
	username?: string;
	locallyAcceptedProposalId?: string | null;
}): boolean {
	const proposal = input.status?.proposal;
	if (!proposal) {
		return false;
	}

	if (input.locallyAcceptedProposalId === proposal.id) {
		return true;
	}

	if (!input.username) {
		return false;
	}

	return proposal.participants.some(
		(participant) => participant.username === input.username && participant.acceptedAt !== null
	);
}
