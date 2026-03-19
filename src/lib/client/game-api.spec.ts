import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	claimRankedGameSessionRemote,
	createGameRemote,
	decideRankedProposalRemote,
	getLadderRemote,
	joinRankedQueueRemote,
	leaveRankedQueueRemote
} from '$lib/client/game-api';
import { initI18n, setLanguage } from '$lib/i18n';

function createJsonResponse(payload: unknown, init?: ResponseInit): Response {
	return new Response(JSON.stringify(payload), {
		headers: { 'Content-Type': 'application/json' },
		...init
	});
}

describe('game api', () => {
	initI18n();
	setLanguage('fr');

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('creates a game with the expected payload', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				createJsonResponse({ gameId: 'abcd1234', url: '/game/abcd1234', color: 'white' })
			);
		vi.stubGlobal('fetch', fetchMock);

		await expect(createGameRemote({ name: 'Romain' })).resolves.toEqual({
			gameId: 'abcd1234',
			url: '/game/abcd1234',
			color: 'white'
		});
		expect(fetchMock).toHaveBeenCalledWith('/api/games', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'Romain' })
		});
	});

	it('claims a ready ranked game session by reusing the accept endpoint', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			createJsonResponse({
				proposalId: 'proposal-1',
				accepted: true,
				gameId: 'game-1',
				token: 'opaque'
			})
		);
		vi.stubGlobal('fetch', fetchMock);

		await expect(claimRankedGameSessionRemote('proposal-1')).resolves.toEqual({
			proposalId: 'proposal-1',
			accepted: true,
			gameId: 'game-1',
			token: 'opaque'
		});
		expect(fetchMock).toHaveBeenCalledWith('/api/ranked/match/proposal-1/accept', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ accept: true })
		});
	});

	it('posts ranked queue and ladder requests to the correct endpoints', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				createJsonResponse({
					queued: true,
					enteredAt: '2026-03-19T00:00:00.000Z',
					waitSeconds: 4,
					searchRange: 75,
					proposal: null
				})
			)
			.mockResolvedValueOnce(createJsonResponse({ ok: true }))
			.mockResolvedValueOnce(createJsonResponse({ ladder: [] }))
			.mockResolvedValueOnce(
				createJsonResponse({
					proposalId: 'proposal-2',
					accepted: false,
					gameId: null,
					token: null
				})
			);
		vi.stubGlobal('fetch', fetchMock);

		await joinRankedQueueRemote();
		await leaveRankedQueueRemote();
		await getLadderRemote();
		await decideRankedProposalRemote('proposal-2', false);

		expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/ranked/queue', { method: 'POST' });
		expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/ranked/queue', { method: 'DELETE' });
		expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/ranked/ladder?limit=200');
		expect(fetchMock).toHaveBeenNthCalledWith(4, '/api/ranked/match/proposal-2/accept', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ accept: false })
		});
	});
});
