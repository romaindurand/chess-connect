import { describe, expect, it } from 'vitest';
import { createGameView } from '$lib/state/game-view.svelte';
import { type Coord, type GameView, type HistorySnapshot } from '$lib/types/game';

function createClockGame(): GameView {
	const emptyBoard = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => null));
	const emptyReserve = { pawn: true, rook: true, knight: true, bishop: true };

	return {
		viewerRole: 'white',
		viewerColor: 'white',
		viewerIsInviter: true,
		joinAllowed: false,
		legalOptions: {
			byBoardFrom: {},
			byReservePiece: {
				pawn: [],
				rook: [],
				knight: [],
				bishop: []
			}
		},
		legalOptionsByColor: {
			white: {
				byBoardFrom: {},
				byReservePiece: {
					pawn: [],
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
			id: 'g-clock',
			status: 'active',
			inviter: { name: 'Alice', joinedAt: 1 },
			hostColor: 'white',
			options: { timeLimitSeconds: 300 },
			players: {
				white: { name: 'Alice', joinedAt: 1 },
				black: { name: 'Bob', joinedAt: 2 }
			},
			board: emptyBoard,
			reserves: {
				white: emptyReserve,
				black: emptyReserve
			},
			turn: 'white',
			pliesPlayed: 0,
			winner: null,
			bestOfWinner: null,
			score: { white: 0, black: 0 },
			matchScore: { host: 0, guest: 0 },
			gameNumber: 1,
			bestOf: null,
			timeControlEnabled: true,
			timeControlPerPlayerSeconds: 300,
			timeRemainingMs: { white: 300_000, black: 245_000 },
			turnStartedAt: 100_000,
			moveHistory: [],
			rematchRequestedBy: null,
			createdAt: 1,
			lastActivityAt: 1,
			version: 1
		}
	};
}

describe('game view clocks', () => {
	it('formats reserve countdowns and decrements only the active player clock', () => {
		let nowMs = 101_500;
		const game = createClockGame();

		const view = createGameView({
			getGameId: () => 'g-clock',
			getGame: () => game,
			getHoveredBoardFrom: () => null,
			getHoveredReservePiece: () => null,
			getLoading: () => false,
			getErrorMessage: () => '',
			getSelectedBoardFrom: () => null,
			getSelectedReservePiece: () => null,
			getCopying: () => false,
			getShowRulesModal: () => false,
			getIsSubmittingRematch: () => false,
			getNowMs: () => nowMs,
			getActivePieceTransitionName: () => null,
			getTransitionFromBoardKey: () => null,
			getTransitionToBoardKey: () => null,
			getTransitionReserveKey: () => null,
			getTransitionMovingOwner: () => null,
			getShowHistoryPanel: () => false,
			getHistoryStep: () => null,
			getHistorySnapshot: () => null as HistorySnapshot | null,
			getShowRepetitionDrawModal: () => false
		});

		expect(view.bottomClockText).toBe('4:59');
		expect(view.topClockText).toBe('4:05');
		expect(view.bottomClockUrgent).toBe(false);
		expect(view.topClockUrgent).toBe(false);

		nowMs = 160_000;
		expect(view.bottomClockText).toBe('4:00');
		expect(view.topClockText).toBe('4:05');

		nowMs = 391_500;
		expect(view.bottomClockText).toBe('0:09');
		expect(view.bottomClockUrgent).toBe(true);
		expect(view.topClockUrgent).toBe(false);
	});

	it('hides reserve countdowns when the game has no time control', () => {
		const game = createClockGame();
		game.state.timeControlEnabled = false;
		game.state.timeRemainingMs = null;

		const view = createGameView({
			getGameId: () => 'g-clock',
			getGame: () => game,
			getHoveredBoardFrom: () => null,
			getHoveredReservePiece: () => null,
			getLoading: () => false,
			getErrorMessage: () => '',
			getSelectedBoardFrom: () => null as Coord | null,
			getSelectedReservePiece: () => null,
			getCopying: () => false,
			getShowRulesModal: () => false,
			getIsSubmittingRematch: () => false,
			getNowMs: () => 100_000,
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

		expect(view.topClockText).toBeNull();
		expect(view.bottomClockText).toBeNull();
		expect(view.topClockUrgent).toBe(false);
		expect(view.bottomClockUrgent).toBe(false);
	});
});
