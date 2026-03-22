import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
	coordKey,
	type Coord,
	type GameView,
	type PieceOnBoard,
	type PieceType
} from '$lib/types/game';
import { createGameActions } from '$lib/state/game-actions';
import { playMoveRemote } from '$lib/client/game-api';

vi.mock('$lib/client/game-api', () => ({
	playMoveRemote: vi.fn(),
	postGameActionRemote: vi.fn(),
	requestRematchRemote: vi.fn(),
	acceptRematchRemote: vi.fn()
}));

function makeGame(): GameView {
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
			byBoardFrom: {
				[coordKey({ x: 0, y: 0 })]: [{ x: 1, y: 0 }]
			},
			byReservePiece: {
				pawn: [{ x: 2, y: 2 }],
				rook: [],
				knight: [],
				bishop: []
			}
		},
		legalOptionsByColor: {
			white: {
				byBoardFrom: {
					[coordKey({ x: 0, y: 0 })]: [{ x: 1, y: 0 }]
				},
				byReservePiece: {
					pawn: [{ x: 2, y: 2 }],
					rook: [],
					knight: [],
					bishop: []
				}
			},
			black: {
				byBoardFrom: {},
				byReservePiece: {
					pawn: [],
					rook: [],
					knight: [],
					bishop: []
				}
			}
		},
		state: {
			id: 'g-dnd',
			status: 'active',
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
			pliesPlayed: 0,
			winner: null,
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

describe('game actions drag and drop', () => {
	beforeEach(() => {
		vi.mocked(playMoveRemote).mockReset();
	});

	it('moves a board piece when dragged to a legal destination', async () => {
		const game = makeGame();
		const updated = makeGame();
		let selectedBoardFrom: Coord | null = null;
		let selectedReservePiece: PieceType | null = null;
		let dragBoardFrom: Coord | null = null;
		let dragReservePiece: PieceType | null = null;

		vi.mocked(playMoveRemote).mockResolvedValue(updated);

		const actions = createGameActions({
			getGameId: () => 'g-dnd',
			getGame: () => game,
			setGame: vi.fn(),
			getErrorMessage: () => '',
			setErrorMessage: vi.fn(),
			getSelectedBoardFrom: () => selectedBoardFrom,
			setSelectedBoardFrom: (coord) => {
				selectedBoardFrom = coord;
			},
			getSelectedReservePiece: () => selectedReservePiece,
			setSelectedReservePiece: (piece) => {
				selectedReservePiece = piece;
			},
			getDragBoardFrom: () => dragBoardFrom,
			setDragBoardFrom: (coord) => {
				dragBoardFrom = coord;
			},
			getDragReservePiece: () => dragReservePiece,
			setDragReservePiece: (piece) => {
				dragReservePiece = piece;
			},
			setHoveredBoardFrom: vi.fn(),
			setHoveredReservePiece: vi.fn(),
			getCopying: () => false,
			setCopying: vi.fn(),
			getIsSubmittingRematch: () => false,
			setIsSubmittingRematch: vi.fn(),
			setShowRulesModal: vi.fn(),
			setActivePieceTransitionName: vi.fn(),
			setTransitionFromBoardKey: vi.fn(),
			setTransitionToBoardKey: vi.fn(),
			setTransitionReserveKey: vi.fn(),
			setTransitionMovingOwner: vi.fn(),
			getShowHistoryPanel: () => false,
			setShowHistoryPanel: vi.fn(),
			getHistoryStep: () => null,
			setHistoryStep: vi.fn(),
			getHistorySnapshot: () => null,
			setHistorySnapshot: vi.fn(),
			setShowRepetitionDrawModal: vi.fn(),
			getIsMyTurn: () => true,
			getTargetHints: () => new Set([coordKey({ x: 1, y: 0 })]),
			reconnectEventStream: vi.fn()
		});

		actions.onBoardDragStart({ x: 0, y: 0 });
		await actions.onCellDrop({ x: 1, y: 0 });

		expect(playMoveRemote).toHaveBeenCalledWith('g-dnd', {
			type: 'play',
			move: { kind: 'move', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }
		});
		expect(dragBoardFrom).toBeNull();
		expect(dragReservePiece).toBeNull();
		expect(selectedBoardFrom).toBeNull();
		expect(selectedReservePiece).toBeNull();
	});

	it('places a reserve piece when dragged to a legal destination', async () => {
		const game = makeGame();
		const updated = makeGame();
		let dragBoardFrom: Coord | null = null;
		let dragReservePiece: PieceType | null = null;

		vi.mocked(playMoveRemote).mockResolvedValue(updated);

		const actions = createGameActions({
			getGameId: () => 'g-dnd',
			getGame: () => game,
			setGame: vi.fn(),
			getErrorMessage: () => '',
			setErrorMessage: vi.fn(),
			getSelectedBoardFrom: () => null,
			setSelectedBoardFrom: vi.fn(),
			getSelectedReservePiece: () => null,
			setSelectedReservePiece: vi.fn(),
			getDragBoardFrom: () => dragBoardFrom,
			setDragBoardFrom: (coord) => {
				dragBoardFrom = coord;
			},
			getDragReservePiece: () => dragReservePiece,
			setDragReservePiece: (piece) => {
				dragReservePiece = piece;
			},
			setHoveredBoardFrom: vi.fn(),
			setHoveredReservePiece: vi.fn(),
			getCopying: () => false,
			setCopying: vi.fn(),
			getIsSubmittingRematch: () => false,
			setIsSubmittingRematch: vi.fn(),
			setShowRulesModal: vi.fn(),
			setActivePieceTransitionName: vi.fn(),
			setTransitionFromBoardKey: vi.fn(),
			setTransitionToBoardKey: vi.fn(),
			setTransitionReserveKey: vi.fn(),
			setTransitionMovingOwner: vi.fn(),
			getShowHistoryPanel: () => false,
			setShowHistoryPanel: vi.fn(),
			getHistoryStep: () => null,
			setHistoryStep: vi.fn(),
			getHistorySnapshot: () => null,
			setHistorySnapshot: vi.fn(),
			setShowRepetitionDrawModal: vi.fn(),
			getIsMyTurn: () => true,
			getTargetHints: () => new Set([coordKey({ x: 2, y: 2 })]),
			reconnectEventStream: vi.fn()
		});

		actions.onReserveDragStart('white', 'pawn');
		await actions.onCellDrop({ x: 2, y: 2 });

		expect(playMoveRemote).toHaveBeenCalledWith('g-dnd', {
			type: 'play',
			move: { kind: 'place', piece: 'pawn', to: { x: 2, y: 2 } }
		});
		expect(dragReservePiece).toBeNull();
		expect(dragBoardFrom).toBeNull();
	});

	it('ignores drop when no drag is active', async () => {
		const game = makeGame();

		const actions = createGameActions({
			getGameId: () => 'g-dnd',
			getGame: () => game,
			setGame: vi.fn(),
			getErrorMessage: () => '',
			setErrorMessage: vi.fn(),
			getSelectedBoardFrom: () => null,
			setSelectedBoardFrom: vi.fn(),
			getSelectedReservePiece: () => null,
			setSelectedReservePiece: vi.fn(),
			getDragBoardFrom: () => null,
			setDragBoardFrom: vi.fn(),
			getDragReservePiece: () => null,
			setDragReservePiece: vi.fn(),
			setHoveredBoardFrom: vi.fn(),
			setHoveredReservePiece: vi.fn(),
			getCopying: () => false,
			setCopying: vi.fn(),
			getIsSubmittingRematch: () => false,
			setIsSubmittingRematch: vi.fn(),
			setShowRulesModal: vi.fn(),
			setActivePieceTransitionName: vi.fn(),
			setTransitionFromBoardKey: vi.fn(),
			setTransitionToBoardKey: vi.fn(),
			setTransitionReserveKey: vi.fn(),
			setTransitionMovingOwner: vi.fn(),
			getShowHistoryPanel: () => false,
			setShowHistoryPanel: vi.fn(),
			getHistoryStep: () => null,
			setHistoryStep: vi.fn(),
			getHistorySnapshot: () => null,
			setHistorySnapshot: vi.fn(),
			setShowRepetitionDrawModal: vi.fn(),
			getIsMyTurn: () => true,
			getTargetHints: () => new Set<string>(),
			reconnectEventStream: vi.fn()
		});

		await actions.onCellDrop({ x: 1, y: 1 });
		expect(playMoveRemote).not.toHaveBeenCalled();
	});
});
