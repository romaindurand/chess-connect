import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	claimRapidGameSessionRemote,
	claimRankedGameSessionRemote,
	createGameRemote,
	decideRapidProposalRemote,
	decideRankedProposalRemote,
	getLadderRemote,
	joinRapidQueueRemote,
	joinRankedQueueRemote,
	leaveRapidQueueRemote,
	leaveRankedQueueRemote
} from '$lib/client/game-api';
import { initI18n, setLanguage } from '$lib/i18n';

vi.mock('../../routes/api/games.remote', () => ({
	createGameRemote: vi.fn(),
	getGameViewRemote: vi.fn(),
	postGameActionRemote: vi.fn()
}));

vi.mock('../../routes/api/ranked.remote', () => ({
	getLadderRemote: vi.fn(),
	getRankedQueueStatusRemote: vi.fn(),
	joinRankedQueueRemote: vi.fn(),
	leaveRankedQueueRemote: vi.fn(),
	decideRankedProposalRemote: vi.fn()
}));

vi.mock('../../routes/api/rapid.remote', () => ({
	getRapidQueueStatusRemote: vi.fn(),
	joinRapidQueueRemote: vi.fn(),
	leaveRapidQueueRemote: vi.fn(),
	decideRapidProposalRemote: vi.fn()
}));

import * as gamesRemote from '../../routes/api/games.remote';
import * as rankedRemote from '../../routes/api/ranked.remote';
import * as rapidRemote from '../../routes/api/rapid.remote';

describe('game api', () => {
	initI18n();
	setLanguage('fr');

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('creates a game with the expected payload', async () => {
		const result = { gameId: 'abcd1234', url: '/game/abcd1234', color: 'white' as const };
		vi.mocked(gamesRemote.createGameRemote).mockResolvedValue(result);

		await expect(createGameRemote({ name: 'Romain' })).resolves.toEqual(result);
		
		expect(gamesRemote.createGameRemote).toHaveBeenCalledWith({ name: 'Romain' });
	});

	it('claims a ready ranked game session by reusing the accept endpoint', async () => {
		const result = {
			proposalId: 'proposal-1',
			accepted: true,
			gameId: 'game-1',
			token: 'opaque'
		};
		vi.mocked(rankedRemote.decideRankedProposalRemote).mockResolvedValue(result);

		await expect(claimRankedGameSessionRemote('proposal-1')).resolves.toEqual(result);
		expect(rankedRemote.decideRankedProposalRemote).toHaveBeenCalledWith({ proposalId: 'proposal-1', accept: true });
	});

	it('posts ranked queue and ladder requests to the correct endpoints', async () => {
		vi.mocked(rankedRemote.joinRankedQueueRemote).mockResolvedValue({
			queued: true,
			enteredAt: '2026-03-19T00:00:00.000Z',
			waitSeconds: 4,
			searchRange: 75,
			proposal: null
		});
		vi.mocked(rankedRemote.leaveRankedQueueRemote).mockResolvedValue(undefined as unknown as {ok: boolean});
		vi.mocked(rankedRemote.getLadderRemote).mockResolvedValue({ ladder: [] });
		vi.mocked(rankedRemote.decideRankedProposalRemote).mockResolvedValue({
			proposalId: 'proposal-2',
			accepted: false,
			gameId: null,
			token: null
		});

		await joinRankedQueueRemote();
		await leaveRankedQueueRemote();
		await getLadderRemote();
		await decideRankedProposalRemote('proposal-2', false);

		expect(rankedRemote.joinRankedQueueRemote).toHaveBeenCalled();
		expect(rankedRemote.leaveRankedQueueRemote).toHaveBeenCalled();
		expect(rankedRemote.getLadderRemote).toHaveBeenCalledWith(200);
		expect(rankedRemote.decideRankedProposalRemote).toHaveBeenCalledWith({ proposalId: 'proposal-2', accept: false });
	});

	it('posts rapid queue requests to the correct endpoints', async () => {
		vi.mocked(rapidRemote.joinRapidQueueRemote).mockResolvedValue({
			queued: true,
			enteredAt: '2026-03-19T00:00:00.000Z',
			waitSeconds: 2,
			searchRange: 75,
			proposal: null
		});
		vi.mocked(rapidRemote.leaveRapidQueueRemote).mockResolvedValue(undefined as unknown as {ok: boolean});
		
		vi.mocked(rapidRemote.decideRapidProposalRemote)
			.mockResolvedValueOnce({
				proposalId: 'proposal-rapid-1',
				accepted: true,
				gameId: null,
				token: null
			})
			.mockResolvedValueOnce({
				proposalId: 'proposal-rapid-2',
				accepted: true,
				gameId: 'game-rapid-1',
				token: 'rapid-token'
			});

		await joinRapidQueueRemote();
		await leaveRapidQueueRemote();
		await decideRapidProposalRemote('proposal-rapid-1', true);
		await claimRapidGameSessionRemote('proposal-rapid-2');

		expect(rapidRemote.joinRapidQueueRemote).toHaveBeenCalled();
		expect(rapidRemote.leaveRapidQueueRemote).toHaveBeenCalled();
		expect(rapidRemote.decideRapidProposalRemote).toHaveBeenNthCalledWith(1, { proposalId: 'proposal-rapid-1', accept: true });
		expect(rapidRemote.decideRapidProposalRemote).toHaveBeenNthCalledWith(2, { proposalId: 'proposal-rapid-2', accept: true });
	});
});
