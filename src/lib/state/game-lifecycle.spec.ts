import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGameLifecycle } from '$lib/state/game-lifecycle';
import type { GameView, PieceOnBoard } from '$lib/types/game';
import { getGameViewRemote, openGameEventStream } from '$lib/client/game-api';
import { initI18n, translate } from '$lib/i18n';

vi.mock('$lib/client/game-api', () => ({
	getGameViewRemote: vi.fn(),
	openGameEventStream: vi.fn()
}));

type SnapshotEvent = { type: 'snapshot'; game: GameView };
type SnapshotCallback = (event: SnapshotEvent) => void;

function makeGame(status: 'active' | 'finished', winner: 'white' | 'black' | null): GameView {
	const board: (PieceOnBoard | null)[][] = Array.from({ length: 4 }, () =>
		Array.from({ length: 4 }, () => null)
	);
	board[0][0] = { type: 'rook', owner: 'white', pawnDirection: -1 };

	return {
		viewerRole: 'white',
		viewerColor: 'white',
		viewerIsInviter: true,
		joinAllowed: false,
		legalOptions: {
			byBoardFrom: {},
			byReservePiece: { pawn: [], rook: [], knight: [], bishop: [] }
		},
		legalOptionsByColor: {
			white: {
				byBoardFrom: {},
				byReservePiece: { pawn: [], rook: [], knight: [], bishop: [] }
			},
			black: {
				byBoardFrom: {},
				byReservePiece: { pawn: [], rook: [], knight: [], bishop: [] }
			}
		},
		state: {
			id: 'g-lifecycle',
			status,
			inviter: { name: 'Alice', joinedAt: 1 },
			hostColor: 'white',
			options: { timeLimitSeconds: null },
			players: {
				white: { name: 'Alice', joinedAt: 1 },
				black: { name: 'Bob', joinedAt: 2 }
			},
			board,
			reserves: {
				white: { pawn: true, rook: true, knight: true, bishop: true },
				black: { pawn: true, rook: true, knight: true, bishop: true }
			},
			turn: 'white',
			pliesPlayed: status === 'finished' ? 1 : 0,
			winner,
			bestOfWinner: null,
			score: { white: 0, black: 0 },
			matchScore: { host: 0, guest: 0 },
			gameNumber: 1,
			bestOf: 3,
			timeControlEnabled: false,
			timeControlPerPlayerSeconds: null,
			timeRemainingMs: null,
			turnStartedAt: null,
			moveHistory: [],
			rematchRequestedBy: null,
			createdAt: 1,
			lastActivityAt: 1,
			version: 1
		}
	};
}

describe('game lifecycle end-of-game scroll', () => {
	beforeEach(() => {
		initI18n();
		vi.clearAllMocks();
	});

	it('scrolls smoothly to top when a snapshot ends the game', async () => {
		let game: GameView | null = null;
		const stream = { callback: null as SnapshotCallback | null };
		const scrollTo = vi.fn();

		vi.stubGlobal('window', { scrollTo });
		vi.mocked(getGameViewRemote).mockResolvedValue(makeGame('active', null));
		vi.mocked(openGameEventStream).mockImplementation((_gameId, onEvent) => {
			stream.callback = onEvent as SnapshotCallback;
			return { close: vi.fn(), onerror: null } as unknown as EventSource;
		});

		const lifecycle = createGameLifecycle({
			getGameId: () => 'g-lifecycle',
			getSelectedBoardFrom: () => null,
			setSelectedBoardFrom: vi.fn(),
			getSelectedReservePiece: () => null,
			setSelectedReservePiece: vi.fn(),
			getGame: () => game,
			setGame: (next) => {
				game = next;
			},
			setErrorMessage: vi.fn(),
			setLoading: vi.fn(),
			getStream: () => null,
			setStream: vi.fn(),
			setNowMs: vi.fn(),
			getActivePieceTransitionName: () => null,
			setActivePieceTransitionName: vi.fn(),
			setTransitionFromBoardKey: vi.fn(),
			setTransitionToBoardKey: vi.fn(),
			setTransitionReserveKey: vi.fn(),
			setTransitionMovingOwner: vi.fn(),
			getHistoryStep: () => null,
			setHistoryStep: vi.fn(),
			setHistorySnapshot: vi.fn(),
			getShowHistoryPanel: () => false,
			setShowHistoryPanel: vi.fn(),
			setShowRepetitionDrawModal: vi.fn()
		});

		await lifecycle.init();
		const callback = stream.callback;
		if (!callback) {
			throw new Error('stream callback should be registered');
		}

		callback({ type: 'snapshot', game: makeGame('finished', 'white') });
		await Promise.resolve();
		await Promise.resolve();

		expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
		lifecycle.destroy();
	});

	it('does not scroll when the snapshot keeps the game active', async () => {
		let game: GameView | null = null;
		const stream = { callback: null as SnapshotCallback | null };
		const scrollTo = vi.fn();

		vi.stubGlobal('window', { scrollTo });
		vi.mocked(getGameViewRemote).mockResolvedValue(makeGame('active', null));
		vi.mocked(openGameEventStream).mockImplementation((_gameId, onEvent) => {
			stream.callback = onEvent as SnapshotCallback;
			return { close: vi.fn(), onerror: null } as unknown as EventSource;
		});

		const lifecycle = createGameLifecycle({
			getGameId: () => 'g-lifecycle',
			getSelectedBoardFrom: () => null,
			setSelectedBoardFrom: vi.fn(),
			getSelectedReservePiece: () => null,
			setSelectedReservePiece: vi.fn(),
			getGame: () => game,
			setGame: (next) => {
				game = next;
			},
			setErrorMessage: vi.fn(),
			setLoading: vi.fn(),
			getStream: () => null,
			setStream: vi.fn(),
			setNowMs: vi.fn(),
			getActivePieceTransitionName: () => null,
			setActivePieceTransitionName: vi.fn(),
			setTransitionFromBoardKey: vi.fn(),
			setTransitionToBoardKey: vi.fn(),
			setTransitionReserveKey: vi.fn(),
			setTransitionMovingOwner: vi.fn(),
			getHistoryStep: () => null,
			setHistoryStep: vi.fn(),
			setHistorySnapshot: vi.fn(),
			getShowHistoryPanel: () => false,
			setShowHistoryPanel: vi.fn(),
			setShowRepetitionDrawModal: vi.fn()
		});

		await lifecycle.init();
		const callback = stream.callback;
		if (!callback) {
			throw new Error('stream callback should be registered');
		}

		callback({ type: 'snapshot', game: makeGame('active', null) });
		await Promise.resolve();
		await Promise.resolve();

		expect(scrollTo).not.toHaveBeenCalled();
		lifecycle.destroy();
	});

	it('clears the disconnected error when a snapshot is received again', async () => {
		let game: GameView | null = null;
		const setErrorMessage = vi.fn();
		const stream = {
			callback: null as SnapshotCallback | null,
			source: { close: vi.fn(), onerror: null as (() => void) | null }
		};

		vi.mocked(getGameViewRemote).mockResolvedValue(makeGame('active', null));
		vi.mocked(openGameEventStream).mockImplementation((_gameId, onEvent) => {
			stream.callback = onEvent as SnapshotCallback;
			return stream.source as unknown as EventSource;
		});

		const lifecycle = createGameLifecycle({
			getGameId: () => 'g-lifecycle',
			getSelectedBoardFrom: () => null,
			setSelectedBoardFrom: vi.fn(),
			getSelectedReservePiece: () => null,
			setSelectedReservePiece: vi.fn(),
			getGame: () => game,
			setGame: (next) => {
				game = next;
			},
			setErrorMessage,
			setLoading: vi.fn(),
			getStream: () => null,
			setStream: vi.fn(),
			setNowMs: vi.fn(),
			getActivePieceTransitionName: () => null,
			setActivePieceTransitionName: vi.fn(),
			setTransitionFromBoardKey: vi.fn(),
			setTransitionToBoardKey: vi.fn(),
			setTransitionReserveKey: vi.fn(),
			setTransitionMovingOwner: vi.fn(),
			getHistoryStep: () => null,
			setHistoryStep: vi.fn(),
			setHistorySnapshot: vi.fn(),
			getShowHistoryPanel: () => false,
			setShowHistoryPanel: vi.fn(),
			setShowRepetitionDrawModal: vi.fn()
		});

		await lifecycle.init();
		setErrorMessage.mockClear();
		stream.source.onerror?.();

		const callback = stream.callback;
		if (!callback) {
			throw new Error('stream callback should be registered');
		}

		callback({ type: 'snapshot', game: makeGame('active', null) });
		await Promise.resolve();
		await Promise.resolve();

		expect(setErrorMessage).toHaveBeenNthCalledWith(1, translate('errors.realTimeDisconnected'));
		expect(setErrorMessage).toHaveBeenLastCalledWith('');

		lifecycle.destroy();
	});
});

describe('explicit reconnection on SSE error', () => {
	beforeEach(() => {
		initI18n();
		vi.clearAllMocks();
	});

	it('attempts to reconnect with fixed 1s delay and succeeds on retry', async () => {
		let game: GameView | null = null;
		const setErrorMessage = vi.fn();
		const stream = {
			callback: null as SnapshotCallback | null,
			source: { close: vi.fn(), onerror: null as (() => void) | null }
		};

		let attemptCount = 0;
		vi.mocked(getGameViewRemote).mockImplementation(async () => {
			attemptCount++;
			// Fail on attempts 1 & 2, succeed on attempt 3
			if (attemptCount < 3) {
				throw new Error('network error');
			}
			return makeGame('active', null);
		});

		vi.mocked(openGameEventStream).mockImplementation((_gameId, onEvent) => {
			stream.callback = onEvent as SnapshotCallback;
			return stream.source as unknown as EventSource;
		});

		const lifecycle = createGameLifecycle({
			getGameId: () => 'g-lifecycle',
			getSelectedBoardFrom: () => null,
			setSelectedBoardFrom: vi.fn(),
			getSelectedReservePiece: () => null,
			setSelectedReservePiece: vi.fn(),
			getGame: () => game,
			setGame: (next) => {
				game = next;
			},
			setErrorMessage,
			setLoading: vi.fn(),
			getStream: () => null,
			setStream: vi.fn(),
			setNowMs: vi.fn(),
			getActivePieceTransitionName: () => null,
			setActivePieceTransitionName: vi.fn(),
			setTransitionFromBoardKey: vi.fn(),
			setTransitionToBoardKey: vi.fn(),
			setTransitionReserveKey: vi.fn(),
			setTransitionMovingOwner: vi.fn(),
			getHistoryStep: () => null,
			setHistoryStep: vi.fn(),
			setHistorySnapshot: vi.fn(),
			getShowHistoryPanel: () => false,
			setShowHistoryPanel: vi.fn(),
			setShowRepetitionDrawModal: vi.fn()
		});

		await lifecycle.init();
		setErrorMessage.mockClear();
		vi.mocked(getGameViewRemote).mockClear();

		// Reset attempt counter and configure for reconnect attempts
		attemptCount = 0;
		vi.mocked(getGameViewRemote).mockImplementation(async () => {
			attemptCount++;
			// Fail on attempts 1 & 2, succeed on attempt 3
			if (attemptCount < 3) {
				throw new Error('network error');
			}
			return makeGame('active', null);
		});

		// Simulate SSE error - triggers reconnection logic
		stream.source.onerror?.();

		// Should set initial error message immediately
		expect(setErrorMessage).toHaveBeenNthCalledWith(1, translate('errors.realTimeDisconnected'));

		// Wait for reconnection attempts (2 failures + 1 success = 2s delay ~ 200ms tolerance)
		await new Promise((resolve) => setTimeout(resolve, 2500));

		// Should succeed and clear error
		expect(setErrorMessage).toHaveBeenLastCalledWith('');
		expect(attemptCount).toBe(3); // Exactly 3 attempts

		lifecycle.destroy();
	});

	it('fails after 10 consecutive reconnection attempts and shows retry message', async () => {
		let game: GameView | null = null;
		const setErrorMessage = vi.fn();
		const stream = {
			callback: null as SnapshotCallback | null,
			source: { close: vi.fn(), onerror: null as (() => void) | null }
		};

		vi.mocked(getGameViewRemote).mockRejectedValue(new Error('network error'));
		vi.mocked(openGameEventStream).mockImplementation((_gameId, onEvent) => {
			stream.callback = onEvent as SnapshotCallback;
			return stream.source as unknown as EventSource;
		});

		const lifecycle = createGameLifecycle({
			getGameId: () => 'g-lifecycle',
			getSelectedBoardFrom: () => null,
			setSelectedBoardFrom: vi.fn(),
			getSelectedReservePiece: () => null,
			setSelectedReservePiece: vi.fn(),
			getGame: () => game,
			setGame: (next) => {
				game = next;
			},
			setErrorMessage,
			setLoading: vi.fn(),
			getStream: () => null,
			setStream: vi.fn(),
			setNowMs: vi.fn(),
			getActivePieceTransitionName: () => null,
			setActivePieceTransitionName: vi.fn(),
			setTransitionFromBoardKey: vi.fn(),
			setTransitionToBoardKey: vi.fn(),
			setTransitionReserveKey: vi.fn(),
			setTransitionMovingOwner: vi.fn(),
			getHistoryStep: () => null,
			setHistoryStep: vi.fn(),
			setHistorySnapshot: vi.fn(),
			getShowHistoryPanel: () => false,
			setShowHistoryPanel: vi.fn(),
			setShowRepetitionDrawModal: vi.fn()
		});

		await lifecycle.init();
		setErrorMessage.mockClear();

		// Reset mock to always fail
		vi.mocked(getGameViewRemote).mockRejectedValue(new Error('network error'));

		// Simulate SSE error
		stream.source.onerror?.();

		// Should set initial error immediately
		expect(setErrorMessage).toHaveBeenNthCalledWith(1, translate('errors.realTimeDisconnected'));

		// Wait for all 10 attempts (10 × 1s = 10s, + tolerance)
		await new Promise((resolve) => setTimeout(resolve, 11000));

		// Last message should be reconnection failed
		const lastMsg = setErrorMessage.mock.calls[setErrorMessage.mock.calls.length - 1][0];
		expect(lastMsg).toBe(translate('errors.reconnectionFailed'));

		lifecycle.destroy();
	}, 12000);
});
