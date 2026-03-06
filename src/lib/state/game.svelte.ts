import { type Coord, type GameView, type PieceType } from '$lib/types/game';
import { createGameActions } from '$lib/state/game-actions';
import { createGameLifecycle } from '$lib/state/game-lifecycle';
import { createGameView } from '$lib/state/game-view.svelte';

export function createGameState(getGameId: () => string) {
	let game = $state<GameView | null>(null);
	let loading = $state(true);
	let errorMessage = $state('');
	let selectedBoardFrom = $state<Coord | null>(null);
	let selectedReservePiece = $state<PieceType | null>(null);
	let hoveredBoardFrom = $state<Coord | null>(null);
	let hoveredReservePiece = $state<PieceType | null>(null);
	let copying = $state(false);
	let isSubmittingRematch = $state(false);
	let showRulesModal = $state(false);

	let stream: EventSource | null = null;

	const rulesLines = [
		'La partie se joue sur un plateau 4x4.',
		'Les 6 premiers demi-coups servent uniquement à poser les pièces depuis la réserve.',
		'Ensuite, les pièces se déplacent comme aux échecs, avec capture autorisée.',
		"Un pion qui atteint un bord repart dans l'autre sens au coup suivant.",
		'Une pièce capturée retourne dans la réserve de son propriétaire.',
		'Vous gagnez en alignant 4 de vos pièces (ligne, colonne ou diagonale).'
	] as const;

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
		}
	});

	const view = createGameView({
		getGameId,
		rulesLines,
		getGame: () => game,
		getHoveredBoardFrom: () => hoveredBoardFrom,
		getHoveredReservePiece: () => hoveredReservePiece,
		getLoading: () => loading,
		getErrorMessage: () => errorMessage,
		getSelectedBoardFrom: () => selectedBoardFrom,
		getSelectedReservePiece: () => selectedReservePiece,
		getCopying: () => copying,
		getShowRulesModal: () => showRulesModal,
		getIsSubmittingRematch: () => isSubmittingRematch
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
		getIsMyTurn: () => view.isMyTurn,
		getTargetHints: () => view.targetHints,
		reconnectEventStream: lifecycle.reconnectEventStream
	});

	return {
		view,
		actions,
		lifecycle
	};
}
