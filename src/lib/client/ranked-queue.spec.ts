import { describe, expect, it } from 'vitest';

import {
	createMatchFoundSoundGate,
	getMatchFoundProposalId,
	hasPendingProposal,
	hasAcceptedCurrentProposal
} from './ranked-queue';
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
	it('plays the found sound only once for a proposal id', () => {
		const gate = createMatchFoundSoundGate();

		expect(gate.shouldPlay('proposal-1')).toBe(true);
		expect(gate.shouldPlay('proposal-1')).toBe(false);
	});

	it('allows found sound again for a different proposal id', () => {
		const gate = createMatchFoundSoundGate();

		expect(gate.shouldPlay('proposal-1')).toBe(true);
		expect(gate.shouldPlay('proposal-2')).toBe(true);
	});

	it('returns proposal id when a match is found and awaiting acceptances', () => {
		const status = createStatus();

		expect(getMatchFoundProposalId(status)).toBe('proposal-1');
	});

	it('does not notify once a game id exists', () => {
		const status = createStatus({
			proposal: {
				id: 'proposal-1',
				expiresAt: '2026-03-19T10:00:30.000Z',
				gameId: 'game-42',
				participants: [
					{
						userId: 'u1',
						username: 'Alice',
						rating: 1200,
						acceptedAt: '2026-03-19T10:00:20.000Z',
						rejectedAt: null
					},
					{
						userId: 'u2',
						username: 'Bob',
						rating: 1200,
						acceptedAt: '2026-03-19T10:00:22.000Z',
						rejectedAt: null
					}
				]
			}
		});

		expect(getMatchFoundProposalId(status)).toBeNull();
	});

	it('does not consider a proposal pending when any participant has rejected', () => {
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
						acceptedAt: null,
						rejectedAt: '2026-03-19T10:00:21.000Z'
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

		expect(hasPendingProposal(status)).toBe(false);
		expect(getMatchFoundProposalId(status)).toBeNull();
	});

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
