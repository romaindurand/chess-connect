import {
	type Color,
	type Coord,
	type GameView,
	type HistorySnapshot,
	type PieceType
} from '$lib/types/game';
import { createGameActions } from '$lib/state/game-actions';
import { createGameLifecycle } from '$lib/state/game-lifecycle';
import { createGameView } from '$lib/state/game-view.svelte';

export function createGameState(getGameId: () => string) {
	let game = $state<GameView | null>(null);
	let loading = $state(true);
	let errorMessage = $state('');
	let selectedBoardFrom = $state<Coord | null>(null);
	let selectedReservePiece = $state<PieceType | null>(null);
	let dragBoardFrom = $state<Coord | null>(null);
	let dragReservePiece = $state<PieceType | null>(null);
	let hoveredBoardFrom = $state<Coord | null>(null);
	let hoveredReservePiece = $state<PieceType | null>(null);
	let copying = $state(false);
	let isSubmittingRematch = $state(false);
	let showRulesModal = $state(false);
	let nowMs = $state(Date.now());
	let activePieceTransitionName = $state<string | null>(null);
	let transitionFromBoardKey = $state<string | null>(null);
	let transitionToBoardKey = $state<string | null>(null);
	let transitionReserveKey = $state<string | null>(null);
	let transitionMovingOwner = $state<Color | null>(null);
	let showHistoryPanel = $state(false);
	let historyStep = $state<number | null>(null);
	let historySnapshot = $state<HistorySnapshot | null>(null);
	let showRepetitionDrawModal = $state(false);

	let stream: EventSource | null = null;

	const lifecycle = createGameLifecycle({
		getGameId,
		getSelectedBoardFrom: () => selectedBoardFrom,
		setSelectedBoardFrom: (coord) => {
			selectedBoardFrom = coord;
		},
		getSelectedReservePiece: () => selectedReservePiece,
		setSelectedReservePiece: (piece) => {
			selectedReservePiece = piece;
		},
		getGame: () => game,
		setGame: (nextGame) => {
			game = nextGame;
		},
		setErrorMessage: (message) => {
			errorMessage = message;
		},
		setLoading: (nextLoading) => {
			loading = nextLoading;
		},
		getStream: () => stream,
		setStream: (nextStream) => {
			stream = nextStream;
		},
		setNowMs: (nextNowMs) => {
			nowMs = nextNowMs;
		},
		getActivePieceTransitionName: () => activePieceTransitionName,
		setActivePieceTransitionName: (name) => {
			activePieceTransitionName = name;
		},
		setTransitionFromBoardKey: (key) => {
			transitionFromBoardKey = key;
		},
		setTransitionToBoardKey: (key) => {
			transitionToBoardKey = key;
		},
		setTransitionReserveKey: (key) => {
			transitionReserveKey = key;
		},
		setTransitionMovingOwner: (owner) => {
			transitionMovingOwner = owner;
		},
		getHistoryStep: () => historyStep,
		setHistoryStep: (step) => {
			historyStep = step;
		},
		setHistorySnapshot: (snapshot) => {
			historySnapshot = snapshot;
		},
		getShowHistoryPanel: () => showHistoryPanel,
		setShowHistoryPanel: (open) => {
			showHistoryPanel = open;
		},
		setShowRepetitionDrawModal: (open) => {
			showRepetitionDrawModal = open;
		}
	});

	const view = createGameView({
		getGameId,
		getGame: () => game,
		getHoveredBoardFrom: () => hoveredBoardFrom,
		getHoveredReservePiece: () => hoveredReservePiece,
		getLoading: () => loading,
		getErrorMessage: () => errorMessage,
		getSelectedBoardFrom: () => selectedBoardFrom,
		getSelectedReservePiece: () => selectedReservePiece,
		getCopying: () => copying,
		getShowRulesModal: () => showRulesModal,
		getIsSubmittingRematch: () => isSubmittingRematch,
		getNowMs: () => nowMs,
		getActivePieceTransitionName: () => activePieceTransitionName,
		getTransitionFromBoardKey: () => transitionFromBoardKey,
		getTransitionToBoardKey: () => transitionToBoardKey,
		getTransitionReserveKey: () => transitionReserveKey,
		getTransitionMovingOwner: () => transitionMovingOwner,
		getShowHistoryPanel: () => showHistoryPanel,
		getHistoryStep: () => historyStep,
		getHistorySnapshot: () => historySnapshot,
		getShowRepetitionDrawModal: () => showRepetitionDrawModal
	});

	const actions = createGameActions({
		getGameId,
		getGame: () => game,
		setGame: (nextGame) => {
			game = nextGame;
		},
		getErrorMessage: () => errorMessage,
		setErrorMessage: (message) => {
			errorMessage = message;
		},
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
		setHoveredBoardFrom: (coord) => {
			hoveredBoardFrom = coord;
		},
		setHoveredReservePiece: (piece) => {
			hoveredReservePiece = piece;
		},
		getCopying: () => copying,
		setCopying: (nextCopying) => {
			copying = nextCopying;
		},
		getIsSubmittingRematch: () => isSubmittingRematch,
		setIsSubmittingRematch: (submitting) => {
			isSubmittingRematch = submitting;
		},
		setShowRulesModal: (open) => {
			showRulesModal = open;
		},
		setActivePieceTransitionName: (name) => {
			activePieceTransitionName = name;
		},
		setTransitionFromBoardKey: (key) => {
			transitionFromBoardKey = key;
		},
		setTransitionToBoardKey: (key) => {
			transitionToBoardKey = key;
		},
		setTransitionReserveKey: (key) => {
			transitionReserveKey = key;
		},
		setTransitionMovingOwner: (owner) => {
			transitionMovingOwner = owner;
		},
		getShowHistoryPanel: () => showHistoryPanel,
		setShowHistoryPanel: (open) => {
			showHistoryPanel = open;
		},
		getHistoryStep: () => historyStep,
		setHistoryStep: (step) => {
			historyStep = step;
		},
		getHistorySnapshot: () => historySnapshot,
		setHistorySnapshot: (snapshot) => {
			historySnapshot = snapshot;
		},
		setShowRepetitionDrawModal: (open) => {
			showRepetitionDrawModal = open;
		},
		getIsMyTurn: () => view.isMyTurn,
		getTargetHints: () => view.targetHints,
		reconnectEventStream: lifecycle.reconnectEventStream
	});

	return {
		view,
		actions,
		lifecycle,
		isDragging: () => Boolean(dragBoardFrom || dragReservePiece)
	};
}
