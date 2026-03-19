import { describe, expect, it } from 'vitest';

import { hasAcceptedCurrentProposal } from './ranked-queue';
import type { RankedQueueStatus } from '$lib/types/game';

function createStatus(overrides?: Partial<RankedQueueStatus>): RankedQueueStatus {
	return {
		queued: true,
		enteredAt: '2026-03-19T10:00:00.000Z',
		waitSeconds: 15,
		searchRange: 75,
		proposal: {
			id: 'proposal-1',
			expiresAt: '2026-03-19T10:00:30.000Z',
			gameId: null,
			participants: [
				{
					userId: 'u1',
					username: 'Alice',
					rating: 1200,
					acceptedAt: null,
					rejectedAt: null
				},
				{
					userId: 'u2',
					username: 'Bob',
					rating: 1200,
					acceptedAt: null,
					rejectedAt: null
				}
			]
		},
		...overrides
	};
}

describe('ranked queue helpers', () => {
	it('considers the proposal accepted immediately after a local accept click', () => {
		const status = createStatus();

		expect(
			hasAcceptedCurrentProposal({
				status,
				username: 'Alice',
				locallyAcceptedProposalId: 'proposal-1'
			})
		).toBe(true);
	});

	it('reads the server acceptedAt for the current participant', () => {
		const status = createStatus({
			proposal: {
				id: 'proposal-1',
				expiresAt: '2026-03-19T10:00:30.000Z',
				gameId: null,
				participants: [
					{
						userId: 'u1',
						username: 'Alice',
						rating: 1200,
						acceptedAt: '2026-03-19T10:00:05.000Z',
						rejectedAt: null
					},
					{
						userId: 'u2',
						username: 'Bob',
						rating: 1200,
						acceptedAt: null,
						rejectedAt: null
					}
				]
			}
		});

		expect(hasAcceptedCurrentProposal({ status, username: 'Alice' })).toBe(true);
		expect(hasAcceptedCurrentProposal({ status, username: 'Bob' })).toBe(false);
	});
});
