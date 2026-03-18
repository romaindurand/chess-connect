import { describe, expect, it } from 'vitest';
import { coordKey, type Coord, type GameView, type HistorySnapshot } from '$lib/types/game';
import { createGameView } from '$lib/state/game-view.svelte';

function createSnapshot(turn: 'white' | 'black'): HistorySnapshot {
	const emptyBoard = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => null));
	return {
		board: emptyBoard,
		reserves: {
			white: { pawn: true, rook: true, knight: true, bishop: true },
			black: { pawn: true, rook: true, knight: true, bishop: true }
		},
		turn,
		pliesPlayed: 2,
		status: 'active',
		winner: null
	};
}

function createGame(): GameView {
	const from: Coord = { x: 1, y: 1 };
	const to: Coord = { x: 1, y: 2 };
	const enemyFrom: Coord = { x: 0, y: 0 };
	const enemyTo: Coord = { x: 0, y: 1 };
	const board = createSnapshot('white').board;
	board[from.y][from.x] = { type: 'rook', owner: 'white', pawnDirection: -1 };
	board[enemyFrom.y][enemyFrom.x] = { type: 'rook', owner: 'black', pawnDirection: 1 };

	return {
		viewerRole: 'white',
		viewerColor: 'white',
		viewerIsInviter: true,
		joinAllowed: false,
		legalOptions: {
			byBoardFrom: {
				[coordKey(from)]: [to]
			},
			byReservePiece: {
				pawn: [],
				rook: [],
				knight: [],
				bishop: []
			}
		},
		legalOptionsByColor: {
			white: {
				byBoardFrom: {
					[coordKey(from)]: [to]
				},
				byReservePiece: {
					pawn: [],
					rook: [],
					knight: [],
					bishop: []
				}
			},
			black: {
				byBoardFrom: {
					[coordKey(enemyFrom)]: [enemyTo]
				},
				byReservePiece: {
					pawn: [],
					rook: [],
					knight: [],
					bishop: []
				}
			}
		},
		state: {
			id: 'g1',
			status: 'active',
			inviter: { name: 'A', joinedAt: 1 },
			hostColor: 'white',
			options: { timeLimitSeconds: null },
			players: {
				white: { name: 'A', joinedAt: 1 },
				black: { name: 'B', joinedAt: 2 }
			},
			board,
			reserves: createSnapshot('white').reserves,
			turn: 'white',
			pliesPlayed: 2,
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
			moveHistory: [
				{
					ply: 1,
					notation: '1. Pa2-a3',
					before: createSnapshot('white'),
					after: createSnapshot('black'),
					transition: {
						moverColor: 'white',
						fromBoard: { x: 0, y: 1 },
						toBoard: { x: 0, y: 2 },
						sound: 'move'
					}
				},
				{
					ply: 2,
					notation: '1... Pb3-b2',
					before: createSnapshot('black'),
					after: createSnapshot('white'),
					transition: {
						moverColor: 'black',
						fromBoard: { x: 1, y: 2 },
						toBoard: { x: 1, y: 1 },
						sound: 'move'
					}
				}
			],
			rematchRequestedBy: null,
			createdAt: 1,
			lastActivityAt: 1,
			version: 1
		}
	};
}

describe('game view history interactions', () => {
	it('keeps interaction enabled when browsing at the last history step', () => {
		let historyStep: number | null = 2;
		const game = createGame();
		const selectedBoardFrom: Coord | null = { x: 1, y: 1 };

		const view = createGameView({
			getGameId: () => 'g1',
			rulesLines: [],
			getGame: () => game,
			getHoveredBoardFrom: () => null,
			getHoveredReservePiece: () => null,
			getLoading: () => false,
			getErrorMessage: () => '',
			getSelectedBoardFrom: () => selectedBoardFrom,
			getSelectedReservePiece: () => null,
			getCopying: () => false,
			getShowRulesModal: () => false,
			getIsSubmittingRematch: () => false,
			getNowMs: () => Date.now(),
			getActivePieceTransitionName: () => null,
			getTransitionFromBoardKey: () => null,
			getTransitionToBoardKey: () => null,
			getTransitionReserveKey: () => null,
			getTransitionMovingOwner: () => null,
			getShowHistoryPanel: () => true,
			getHistoryStep: () => historyStep,
			getHistorySnapshot: () => game.state.moveHistory[1].after,
			getShowRepetitionDrawModal: () => false
		});

		expect(view.isMyTurn).toBe(true);
		expect(Array.from(view.targetHints)).toContain(coordKey({ x: 1, y: 2 }));

		historyStep = 1;
		expect(view.isMyTurn).toBe(false);
		expect(view.targetHints.size).toBe(0);
	});

	it('uses red hints when hovering an enemy piece', () => {
		let hoveredBoardFrom: Coord | null = { x: 0, y: 0 };
		let selectedBoardFrom: Coord | null = null;
		const game = createGame();

		const view = createGameView({
			getGameId: () => 'g1',
			rulesLines: [],
			getGame: () => game,
			getHoveredBoardFrom: () => hoveredBoardFrom,
			getHoveredReservePiece: () => null,
			getLoading: () => false,
			getErrorMessage: () => '',
			getSelectedBoardFrom: () => selectedBoardFrom,
			getSelectedReservePiece: () => null,
			getCopying: () => false,
			getShowRulesModal: () => false,
			getIsSubmittingRematch: () => false,
			getNowMs: () => Date.now(),
			getActivePieceTransitionName: () => null,
			getTransitionFromBoardKey: () => null,
			getTransitionToBoardKey: () => null,
			getTransitionReserveKey: () => null,
			getTransitionMovingOwner: () => null,
			getShowHistoryPanel: () => false,
			getHistoryStep: () => null,
			getHistorySnapshot: () => null,
			getShowRepetitionDrawModal: () => false
		});

		expect(Array.from(view.targetHints)).toContain(coordKey({ x: 0, y: 1 }));
		expect(view.targetHintTone).toBe('enemy');

		hoveredBoardFrom = { x: 1, y: 1 };
		expect(Array.from(view.targetHints)).toContain(coordKey({ x: 1, y: 2 }));
		expect(view.targetHintTone).toBe('ally');

		hoveredBoardFrom = { x: 0, y: 0 };
		selectedBoardFrom = { x: 1, y: 1 };
		expect(Array.from(view.targetHints)).toContain(coordKey({ x: 1, y: 2 }));
		expect(Array.from(view.targetHints)).not.toContain(coordKey({ x: 0, y: 1 }));
		expect(view.targetHintTone).toBe('ally');
	});
});
