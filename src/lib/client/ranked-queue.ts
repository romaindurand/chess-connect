import type { RankedQueueStatus } from '$lib/types/game';

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
