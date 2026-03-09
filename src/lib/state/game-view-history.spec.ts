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
		state: {
			id: 'g1',
			status: 'active',
			inviter: { name: 'A', joinedAt: 1 },
			hostColor: 'white',
			players: {
				white: { name: 'A', joinedAt: 1 },
				black: { name: 'B', joinedAt: 2 }
			},
			board: createSnapshot('white').board,
			reserves: createSnapshot('white').reserves,
			turn: 'white',
			pliesPlayed: 2,
			winner: null,
			bestOfWinner: null,
			score: { white: 0, black: 0 },
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
});
