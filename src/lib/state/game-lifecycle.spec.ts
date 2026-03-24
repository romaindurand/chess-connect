import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGameLifecycle } from '$lib/state/game-lifecycle';
import type { GameView, PieceOnBoard } from '$lib/types/game';
import { getGameViewRemote, openGameEventStream } from '$lib/client/game-api';

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
});
