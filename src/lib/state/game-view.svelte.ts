import { SvelteSet } from 'svelte/reactivity';
import {
	coordKey,
	PIECES,
	type Color,
	type Coord,
	type GameView,
	type HistorySnapshot,
	type PieceType
} from '$lib/types/game';

interface GameViewFactoryInput {
	getGameId: () => string;
	rulesLines: readonly string[];
	getGame: () => GameView | null;
	getHoveredBoardFrom: () => Coord | null;
	getHoveredReservePiece: () => PieceType | null;
	getLoading: () => boolean;
	getErrorMessage: () => string;
	getSelectedBoardFrom: () => Coord | null;
	getSelectedReservePiece: () => PieceType | null;
	getCopying: () => boolean;
	getShowRulesModal: () => boolean;
	getIsSubmittingRematch: () => boolean;
	getNowMs: () => number;
	getActivePieceTransitionName: () => string | null;
	getTransitionFromBoardKey: () => string | null;
	getTransitionToBoardKey: () => string | null;
	getTransitionReserveKey: () => string | null;
	getTransitionMovingOwner: () => Color | null;
	getShowHistoryPanel: () => boolean;
	getHistoryStep: () => number | null;
	getHistorySnapshot: () => HistorySnapshot | null;
}

export function createGameView(input: GameViewFactoryInput) {
	const topReserveColor = $derived('black' as const);
	const bottomReserveColor = $derived('white' as const);

	const displayedState = $derived.by(() => {
		const historySnapshot = input.getHistorySnapshot();
		if (historySnapshot) {
			return historySnapshot;
		}
		return input.getGame()?.state ?? null;
	});

	const topReserveIsMine = $derived.by(() => {
		const game = input.getGame();
		return Boolean(game?.viewerColor && game.viewerColor === topReserveColor);
	});

	const bottomReserveIsMine = $derived.by(() => {
		const game = input.getGame();
		return Boolean(game?.viewerColor && game.viewerColor === bottomReserveColor);
	});

	const topReservePieces = $derived.by(() => {
		const state = displayedState;
		if (!state) {
			return [] as PieceType[];
		}
		return PIECES.filter((piece) => state.reserves[topReserveColor][piece]);
	});

	const bottomReservePieces = $derived.by(() => {
		const state = displayedState;
		if (!state) {
			return [] as PieceType[];
		}
		return PIECES.filter((piece) => state.reserves[bottomReserveColor][piece]);
	});

	const displayBoard = $derived.by(() => displayedState?.board ?? []);
	const displayTurn = $derived.by(() => displayedState?.turn ?? 'white');

	const historyEntries = $derived.by(() => input.getGame()?.state.moveHistory ?? []);
	const isHistoryMode = $derived.by(() => {
		const step = input.getHistoryStep();
		return step !== null && step < historyEntries.length;
	});
	const historyStep = $derived.by(() => input.getHistoryStep());
	const historySelectedMoveIndex = $derived.by(() => {
		const step = historyStep;
		if (step === null || step === 0) {
			return null;
		}
		return step - 1;
	});
	const showHistoryPanel = $derived.by(() => input.getShowHistoryPanel());

	const targetHints = $derived.by(() => {
		if (isHistoryMode) {
			return new SvelteSet<string>();
		}
		const game = input.getGame();
		if (!game) {
			return new SvelteSet<string>();
		}

		const hoveredBoardFrom = input.getHoveredBoardFrom();
		if (hoveredBoardFrom) {
			const key = coordKey(hoveredBoardFrom);
			return new SvelteSet((game.legalOptions.byBoardFrom[key] ?? []).map(coordKey));
		}

		const hoveredReservePiece = input.getHoveredReservePiece();
		if (hoveredReservePiece) {
			return new SvelteSet((game.legalOptions.byReservePiece[hoveredReservePiece] ?? []).map(coordKey));
		}

		const selectedBoardFrom = input.getSelectedBoardFrom();
		if (selectedBoardFrom) {
			const key = coordKey(selectedBoardFrom);
			return new SvelteSet((game.legalOptions.byBoardFrom[key] ?? []).map(coordKey));
		}

		const selectedReservePiece = input.getSelectedReservePiece();
		if (selectedReservePiece) {
			return new SvelteSet(
				(game.legalOptions.byReservePiece[selectedReservePiece] ?? []).map(coordKey)
			);
		}

		return new SvelteSet<string>();
	});

	const isMyTurn = $derived.by(() => {
		if (isHistoryMode) {
			return false;
		}
		const game = input.getGame();
		return Boolean(game && game.viewerColor === game.state.turn && game.state.status === 'active');
	});

	const isGameFinished = $derived.by(() => {
		const game = input.getGame();
		return Boolean(game?.state.status === 'finished' && game?.state.winner);
	});

	const canRequestRematch = $derived.by(() => {
		const game = input.getGame();
		if (!game || !game.viewerColor || !isGameFinished || game.state.bestOfWinner) {
			return false;
		}
		if (game.state.rematchRequestedBy || !game.state.winner) {
			return false;
		}
		return game.viewerColor !== game.state.winner;
	});

	const canAcceptRematch = $derived.by(() => {
		const game = input.getGame();
		if (!game || !game.viewerColor || !isGameFinished || game.state.bestOfWinner) {
			return false;
		}
		if (!game.state.rematchRequestedBy) {
			return false;
		}
		return game.viewerColor !== game.state.rematchRequestedBy;
	});

	const winnerModalTitle = $derived.by(() => {
		const game = input.getGame();
		if (!game || !isGameFinished || !game.state.winner) {
			return '';
		}

		if (game.viewerRole === 'white' || game.viewerRole === 'black') {
			return game.viewerColor === game.state.winner ? 'Victoire 🎉' : 'Défaite';
		}

		return `Partie terminée — ${game.state.winner === 'white' ? 'Blanc' : 'Noir'} gagne`;
	});

	const winnerModalSubtitle = $derived.by(() => {
		const game = input.getGame();
		if (!game || !isGameFinished) {
			return '';
		}
		return `Score actuel: Blanc ${game.state.score.white} - Noir ${game.state.score.black}`;
	});

	const winnerDetailsLine = $derived.by(() => {
		const game = input.getGame();
		if (!game || !game.state.winner) {
			return '';
		}
		const whiteName = game.state.players.white?.name ?? 'Joueur blanc';
		const blackName = game.state.players.black?.name ?? 'Joueur noir';
		const winnerName = game.state.winner === 'white' ? whiteName : blackName;
		const winnerColor = game.state.winner === 'white' ? 'Blanc' : 'Noir';
		return `Gagnant: ${winnerName} (${winnerColor})`;
	});

	const roleText = $derived.by(() => {
		const game = input.getGame();
		if (!game) {
			return '';
		}
		if (game.viewerRole === 'white' || game.viewerRole === 'black') {
			return `Vous êtes ${game.viewerRole === 'white' ? 'Blanc' : 'Noir'}`;
		}
		if (game.viewerRole === 'spectator') {
			return 'Mode spectateur';
		}
		return '';
	});

	const turnLineText = $derived.by(() => {
		const game = input.getGame();
		if (!game) {
			return '';
		}
		if (game.state.winner) {
			return `Partie terminée — gagnant: ${game.state.winner === 'white' ? 'Blanc' : 'Noir'}`;
		}
		if (game.viewerRole !== 'white' && game.viewerRole !== 'black') {
			return '';
		}
		const turnNumber = Math.floor(game.state.pliesPlayed / 2) + 1;
		if (game.state.timeControlEnabled) {
			return `Tour ${turnNumber}`;
		}
		const isViewerTurn = game.viewerColor === game.state.turn;
		return `Tour ${turnNumber} — ${isViewerTurn ? "C'est à votre tour de jouer" : "C'est à l'adversaire de jouer"}`;
	});

	const isViewerTurnNow = $derived.by(() => {
		const game = input.getGame();
		if (!game || game.state.winner) {
			return false;
		}
		if (game.viewerRole !== 'white' && game.viewerRole !== 'black') {
			return false;
		}
		return game.viewerColor === game.state.turn;
	});

	const hasTimeControl = $derived.by(() => {
		const game = input.getGame();
		return Boolean(game?.state.timeControlEnabled && game.state.timeRemainingMs);
	});

	const whiteTimeRemainingMs = $derived.by(() => {
		return getRemainingClockMs('white');
	});

	const blackTimeRemainingMs = $derived.by(() => {
		return getRemainingClockMs('black');
	});

	function getRemainingClockMs(color: Color): number | null {
		const game = input.getGame();
		if (!game || !game.state.timeControlEnabled || !game.state.timeRemainingMs) {
			return null;
		}

		let remaining = game.state.timeRemainingMs[color];
		if (game.state.status === 'active' && game.state.turn === color && game.state.turnStartedAt !== null) {
			remaining -= input.getNowMs() - game.state.turnStartedAt;
		}

		return Math.max(0, Math.floor(remaining));
	}

	function boardPieceTransitionName(coord: Coord): string | null {
		const name = input.getActivePieceTransitionName();
		if (!name) {
			return null;
		}
		const state = displayedState;
		if (!state) {
			return null;
		}
		const cell = state.board[coord.y][coord.x];
		const movingOwner = input.getTransitionMovingOwner();
		if (!cell || !movingOwner || cell.owner !== movingOwner) {
			return null;
		}
		const key = coordKey(coord);
		if (key === input.getTransitionFromBoardKey() || key === input.getTransitionToBoardKey()) {
			return name;
		}
		return null;
	}

	function reservePieceTransitionName(owner: Color, piece: PieceType): string | null {
		const name = input.getActivePieceTransitionName();
		if (!name) {
			return null;
		}
		const reserveKey = `${owner}:${piece}`;
		return reserveKey === input.getTransitionReserveKey() ? name : null;
	}

	return {
		get gameId() {
			return input.getGameId();
		},
		rulesLines: input.rulesLines,
		get game() {
			return input.getGame();
		},
		get loading() {
			return input.getLoading();
		},
		get errorMessage() {
			return input.getErrorMessage();
		},
		get selectedBoardFrom() {
			return input.getSelectedBoardFrom();
		},
		get selectedReservePiece() {
			return input.getSelectedReservePiece();
		},
		get topReserveColor() {
			return topReserveColor;
		},
		get bottomReserveColor() {
			return bottomReserveColor;
		},
		get topReserveIsMine() {
			return topReserveIsMine;
		},
		get bottomReserveIsMine() {
			return bottomReserveIsMine;
		},
		get topReservePieces() {
			return topReservePieces;
		},
		get bottomReservePieces() {
			return bottomReservePieces;
		},
		get displayBoard() {
			return displayBoard;
		},
		get displayTurn() {
			return displayTurn;
		},
		get targetHints() {
			return targetHints;
		},
		get isMyTurn() {
			return isMyTurn;
		},
		get copying() {
			return input.getCopying();
		},
		get showRulesModal() {
			return input.getShowRulesModal();
		},
		get isSubmittingRematch() {
			return input.getIsSubmittingRematch();
		},
		get isGameFinished() {
			return isGameFinished;
		},
		get canRequestRematch() {
			return canRequestRematch;
		},
		get canAcceptRematch() {
			return canAcceptRematch;
		},
		get winnerModalTitle() {
			return winnerModalTitle;
		},
		get winnerModalSubtitle() {
			return winnerModalSubtitle;
		},
		get winnerDetailsLine() {
			return winnerDetailsLine;
		},
		get roleText() {
			return roleText;
		},
		get turnLineText() {
			return turnLineText;
		},
		get isViewerTurnNow() {
			return isViewerTurnNow;
		},
		get hasTimeControl() {
			return hasTimeControl;
		},
		get whiteTimeRemainingMs() {
			return whiteTimeRemainingMs;
		},
		get blackTimeRemainingMs() {
			return blackTimeRemainingMs;
		},
		get showHistoryPanel() {
			return showHistoryPanel;
		},
		get historyEntries() {
			return historyEntries;
		},
		get historyStep() {
			return historyStep;
		},
		get historySelectedMoveIndex() {
			return historySelectedMoveIndex;
		},
		get isHistoryMode() {
			return isHistoryMode;
		},
		boardPieceTransitionName,
		reservePieceTransitionName
	};
}
