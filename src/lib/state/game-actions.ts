import {
	playMoveRemote,
	postGameActionRemote,
	requestRematchRemote,
	acceptRematchRemote
} from '$lib/client/game-api';
import {
	getSnapshotForHistoryStep,
	isAutomaticDrawRoundReset,
	shouldFollowLiveEdge
} from '$lib/state/history-live';
import { tick } from 'svelte';
import {
	coordKey,
	type Color,
	type Coord,
	type GameView,
	type HistorySnapshot,
	type MoveHistoryEntry,
	type PieceOnBoard,
	type PieceType,
	type PlayMovePayload
} from '$lib/types/game';
import { translate } from '$lib/i18n';

interface GameActionsFactoryInput {
	getGameId: () => string;
	getGame: () => GameView | null;
	setGame: (game: GameView) => void;
	getErrorMessage: () => string;
	setErrorMessage: (message: string) => void;
	getSelectedBoardFrom: () => Coord | null;
	setSelectedBoardFrom: (coord: Coord | null) => void;
	getSelectedReservePiece: () => PieceType | null;
	setSelectedReservePiece: (piece: PieceType | null) => void;
	getDragBoardFrom: () => Coord | null;
	setDragBoardFrom: (coord: Coord | null) => void;
	getDragReservePiece: () => PieceType | null;
	setDragReservePiece: (piece: PieceType | null) => void;
	setHoveredBoardFrom: (coord: Coord | null) => void;
	setHoveredReservePiece: (piece: PieceType | null) => void;
	getCopying: () => boolean;
	setCopying: (copying: boolean) => void;
	getIsSubmittingRematch: () => boolean;
	setIsSubmittingRematch: (submitting: boolean) => void;
	setShowRulesModal: (open: boolean) => void;
	setActivePieceTransitionName: (name: string | null) => void;
	setTransitionFromBoardKey: (key: string | null) => void;
	setTransitionToBoardKey: (key: string | null) => void;
	setTransitionReserveKey: (key: string | null) => void;
	setTransitionMovingOwner: (owner: Color | null) => void;
	getShowHistoryPanel: () => boolean;
	setShowHistoryPanel: (open: boolean) => void;
	getHistoryStep: () => number | null;
	setHistoryStep: (step: number | null) => void;
	getHistorySnapshot: () => HistorySnapshot | null;
	setHistorySnapshot: (snapshot: HistorySnapshot | null) => void;
	setShowRepetitionDrawModal: (open: boolean) => void;
	getIsMyTurn: () => boolean;
	getTargetHints: () => Set<string>;
	reconnectEventStream: () => void;
}

export function createGameActions(input: GameActionsFactoryInput) {
	let isDragging = false;
	let preserveSelectionOnNextClickAfterCanceledDrag = false;

	function clearDragState(): void {
		input.setDragBoardFrom(null);
		input.setDragReservePiece(null);
	}

	function resetSelection(): void {
		input.setSelectedBoardFrom(null);
		input.setSelectedReservePiece(null);
		preserveSelectionOnNextClickAfterCanceledDrag = false;
		clearDragState();
	}

	function clearHistoryPreview(): void {
		input.setHistoryStep(null);
		input.setHistorySnapshot(null);
	}

	function clearTransitionMarkers(): void {
		input.setActivePieceTransitionName(null);
		input.setTransitionFromBoardKey(null);
		input.setTransitionToBoardKey(null);
		input.setTransitionReserveKey(null);
		input.setTransitionMovingOwner(null);
	}

	function historyEntries(): MoveHistoryEntry[] {
		return input.getGame()?.state.moveHistory ?? [];
	}

	function isHistoryPreviewMode(): boolean {
		const step = input.getHistoryStep();
		return step !== null && step < historyEntries().length;
	}

	function snapshotAtStep(step: number): HistorySnapshot | null {
		return getSnapshotForHistoryStep(historyEntries(), step);
	}

	function goToHistoryStep(step: number): void {
		const entries = historyEntries();
		if (entries.length === 0 || step < 0 || step > entries.length) {
			return;
		}
		const snapshot = snapshotAtStep(step);
		resetSelection();
		input.setHistoryStep(step);
		input.setHistorySnapshot(snapshot);
	}

	async function playHistoryMove(moveIndex: number): Promise<void> {
		const entries = historyEntries();
		const entry = entries[moveIndex];
		if (!entry) {
			return;
		}

		resetSelection();
		input.setHistoryStep(moveIndex);
		input.setHistorySnapshot(entry.before);

		if (typeof document === 'undefined' || typeof document.startViewTransition !== 'function') {
			input.setHistoryStep(moveIndex + 1);
			input.setHistorySnapshot(getSnapshotForHistoryStep(entries, moveIndex + 1));
			return;
		}

		const transitionName = `history-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
		input.setActivePieceTransitionName(transitionName);
		input.setTransitionFromBoardKey(
			entry.transition.fromBoard ? coordKey(entry.transition.fromBoard) : null
		);
		input.setTransitionToBoardKey(coordKey(entry.transition.toBoard));
		input.setTransitionReserveKey(
			entry.transition.fromReserve
				? `${entry.transition.fromReserve.owner}:${entry.transition.fromReserve.piece}`
				: null
		);
		input.setTransitionMovingOwner(entry.transition.moverColor);

		await tick();

		const transition = document.startViewTransition(() => {
			input.setHistoryStep(moveIndex + 1);
			input.setHistorySnapshot(getSnapshotForHistoryStep(entries, moveIndex + 1));
		});

		await transition.finished.catch(() => undefined);
		clearTransitionMarkers();
	}

	async function playMoveWithPieceTransition(
		payload: PlayMovePayload,
		markers: {
			fromBoard?: Coord;
			toBoard: Coord;
			fromReserve?: { owner: 'white' | 'black'; piece: PieceType };
		}
	): Promise<GameView> {
		const previousGame = input.getGame();
		const previousMoveHistoryLength = previousGame?.state.moveHistory.length ?? 0;
		const followLiveHistory = shouldFollowLiveEdge(
			input.getHistoryStep(),
			previousMoveHistoryLength
		);

		let optimisticGame: GameView | null = null;
		if (previousGame) {
			optimisticGame = JSON.parse(JSON.stringify(previousGame)) as GameView;
			if (payload.move.kind === 'move') {
				const piece = optimisticGame.state.board[payload.move.from.y][payload.move.from.x];
				optimisticGame.state.board[payload.move.from.y][payload.move.from.x] = null;
				optimisticGame.state.board[payload.move.to.y][payload.move.to.x] = piece;
			} else if (payload.move.kind === 'place' && previousGame.viewerColor) {
				const owner = previousGame.viewerColor;
				if (optimisticGame.state.reserves[owner][payload.move.piece]) {
					optimisticGame.state.reserves[owner][payload.move.piece] = false;
					optimisticGame.state.board[payload.move.to.y][payload.move.to.x] = {
						type: payload.move.piece,
						owner,
						pawnDirection: owner === 'white' ? -1 : 1
					};
				}
			}
			optimisticGame.state.turn = optimisticGame.state.turn === 'white' ? 'black' : 'white';
			optimisticGame.legalOptions = { byBoardFrom: {}, byReservePiece: { pawn: [], rook: [], knight: [], bishop: [] } };
		}

		if (typeof document === 'undefined' || typeof document.startViewTransition !== 'function') {
			if (optimisticGame) {
				input.setGame(optimisticGame);
			}
			try {
				const updatedGame = await playMoveRemote(input.getGameId(), payload);
				input.setGame(updatedGame);
				if (isAutomaticDrawRoundReset(previousGame?.state ?? null, updatedGame.state)) {
					input.setShowRepetitionDrawModal(true);
				}
				if (followLiveHistory) {
					input.setHistoryStep(updatedGame.state.moveHistory.length);
					input.setHistorySnapshot(null);
				}
				clearTransitionMarkers();
				return updatedGame;
			} catch (error) {
				if (previousGame) {
					input.setGame(previousGame);
				}
				throw error;
			}
		}

		const transitionName = `piece-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
		input.setActivePieceTransitionName(transitionName);
		input.setTransitionFromBoardKey(markers.fromBoard ? coordKey(markers.fromBoard) : null);
		input.setTransitionToBoardKey(coordKey(markers.toBoard));
		input.setTransitionReserveKey(
			markers.fromReserve ? `${markers.fromReserve.owner}:${markers.fromReserve.piece}` : null
		);
		const movingOwner = markers.fromReserve?.owner ?? previousGame?.viewerColor ?? null;
		input.setTransitionMovingOwner(movingOwner);

		await tick();

		let updatedGame: GameView | null = null;
		let moveError: unknown = null;

		const transition = document.startViewTransition(() => {
			if (optimisticGame) {
				input.setGame(optimisticGame);
			}
		});

		try {
			updatedGame = await playMoveRemote(input.getGameId(), payload);
			// Mettre à jour avec la vérité serveur sans casser l'animation en attente
			await transition.ready.catch(() => undefined);
			input.setGame(updatedGame);
			
			if (isAutomaticDrawRoundReset(previousGame?.state ?? null, updatedGame.state)) {
				input.setShowRepetitionDrawModal(true);
			}
			if (followLiveHistory) {
				input.setHistoryStep(updatedGame.state.moveHistory.length);
				input.setHistorySnapshot(null);
			}
		} catch (error) {
			moveError = error;
			if (previousGame) {
				input.setGame(previousGame);
			}
		}

		await transition.finished.catch(() => undefined);
		clearTransitionMarkers();

		if (moveError) {
			throw moveError;
		}

		if (!updatedGame) {
			throw new Error(translate('errors.invalidMove'));
		}

		return updatedGame;
	}

	function isMyPiece(cell: PieceOnBoard | null): boolean {
		const game = input.getGame();
		return Boolean(game && game.viewerColor && cell && cell.owner === game.viewerColor);
	}

	async function onJoin(name: string): Promise<boolean> {
		const trimmed = name.trim();
		if (trimmed.length < 2) {
			input.setErrorMessage(translate('errors.nameLength'));
			return false;
		}

		try {
			const game = await postGameActionRemote(input.getGameId(), { type: 'join', name: trimmed });
			input.setGame(game);
			input.reconnectEventStream();
			input.setErrorMessage('');
			return true;
		} catch (error) {
			input.setErrorMessage(
				error instanceof Error ? error.message : translate('errors.joinGameFailed')
			);
			return false;
		}
	}

	async function copyInviteLink(url: string): Promise<void> {
		if (input.getCopying()) {
			return;
		}
		input.setCopying(true);
		try {
			await navigator.clipboard.writeText(url);
		} finally {
			setTimeout(() => {
				input.setCopying(false);
			}, 800);
		}
	}

	async function onRequestRematch(): Promise<void> {
		const game = input.getGame();
		if (!game || input.getIsSubmittingRematch()) {
			return;
		}
		input.setIsSubmittingRematch(true);
		try {
			const updatedGame = await requestRematchRemote(input.getGameId());
			input.setGame(updatedGame);
			input.setErrorMessage('');
		} catch (error) {
			input.setErrorMessage(
				error instanceof Error ? error.message : translate('errors.requestRematchFailed')
			);
		} finally {
			input.setIsSubmittingRematch(false);
		}
	}

	async function onAcceptRematch(): Promise<void> {
		const game = input.getGame();
		if (!game || input.getIsSubmittingRematch()) {
			return;
		}
		input.setIsSubmittingRematch(true);
		try {
			const updatedGame = await acceptRematchRemote(input.getGameId());
			input.setGame(updatedGame);
			resetSelection();
			input.setErrorMessage('');
		} catch (error) {
			input.setErrorMessage(
				error instanceof Error ? error.message : translate('errors.startRematchFailed')
			);
		} finally {
			input.setIsSubmittingRematch(false);
		}
	}

	function onBoardHover(coord: Coord, cell: PieceOnBoard | null): void {
		input.setHoveredBoardFrom(cell ? coord : null);
	}

	function clearBoardHover(): void {
		input.setHoveredBoardFrom(null);
	}

	function onReserveHover(reserveColor: 'white' | 'black', piece: PieceType): void {
		const game = input.getGame();
		input.setHoveredReservePiece(reserveColor === game?.viewerColor ? piece : null);
	}

	function clearReserveHover(): void {
		input.setHoveredReservePiece(null);
	}

	async function onCellClick(coord: Coord): Promise<void> {
		if (isDragging) return;
		const preserveSelectionFromCanceledDrag = preserveSelectionOnNextClickAfterCanceledDrag;
		preserveSelectionOnNextClickAfterCanceledDrag = false;
		clearDragState();
		const game = input.getGame();
		if (isHistoryPreviewMode()) {
			return;
		}
		if (!game || !input.getIsMyTurn()) {
			return;
		}

		const cell = game.state.board[coord.y][coord.x];
		const selectedReservePiece = input.getSelectedReservePiece();

		if (selectedReservePiece) {
			if (input.getTargetHints().has(coordKey(coord))) {
				try {
					const viewerColor = game.viewerColor;
					if (!viewerColor) {
						return;
					}
					await playMoveWithPieceTransition(
						{
							type: 'play',
							move: { kind: 'place', piece: selectedReservePiece, to: coord }
						},
						{
							toBoard: coord,
							fromReserve: {
								owner: viewerColor,
								piece: selectedReservePiece
							}
						}
					);
					resetSelection();
				} catch (error) {
					input.setErrorMessage(
						error instanceof Error ? error.message : translate('errors.invalidMove')
					);
				}
				return;
			}

			if (isMyPiece(cell)) {
				input.setSelectedReservePiece(null);
				input.setSelectedBoardFrom(coord);
			}
			return;
		}

		const selectedBoardFrom = input.getSelectedBoardFrom();
		if (selectedBoardFrom) {
			if (coord.x === selectedBoardFrom.x && coord.y === selectedBoardFrom.y) {
				if (preserveSelectionFromCanceledDrag) {
					return;
				}
				input.setSelectedBoardFrom(null);
				return;
			}
			if (input.getTargetHints().has(coordKey(coord))) {
				try {
					await playMoveWithPieceTransition(
						{
							type: 'play',
							move: { kind: 'move', from: selectedBoardFrom, to: coord }
						},
						{
							fromBoard: selectedBoardFrom,
							toBoard: coord
						}
					);
					resetSelection();
				} catch (error) {
					input.setErrorMessage(
						error instanceof Error ? error.message : translate('errors.invalidMove')
					);
				}
				return;
			}
		}

		if (isMyPiece(cell)) {
			input.setSelectedReservePiece(null);
			input.setSelectedBoardFrom(coord);
		}
	}

	function onReserveClick(reserveColor: 'white' | 'black', piece: PieceType): void {
		if (isDragging) return;
		const preserveSelectionFromCanceledDrag = preserveSelectionOnNextClickAfterCanceledDrag;
		preserveSelectionOnNextClickAfterCanceledDrag = false;
		clearDragState();
		const game = input.getGame();
		if (isHistoryPreviewMode()) {
			return;
		}
		if (!game || !game.viewerColor || reserveColor !== game.viewerColor) {
			return;
		}
		if (!game.state.reserves[game.viewerColor][piece]) {
			return;
		}

		input.setErrorMessage('');
		input.setSelectedBoardFrom(null);
		if (preserveSelectionFromCanceledDrag && input.getSelectedReservePiece() === piece) {
			return;
		}
		input.setSelectedReservePiece(input.getSelectedReservePiece() === piece ? null : piece);
	}

	function onBoardDragStart(coord: Coord): void {
		preserveSelectionOnNextClickAfterCanceledDrag = false;
		const game = input.getGame();
		if (isHistoryPreviewMode() || !game || !input.getIsMyTurn()) {
			clearDragState();
			return;
		}

		const cell = game.state.board[coord.y]?.[coord.x] ?? null;
		if (!isMyPiece(cell)) {
			clearDragState();
			return;
		}

		isDragging = true;
		input.setErrorMessage('');
		input.setSelectedReservePiece(null);
		input.setSelectedBoardFrom(coord);
		input.setDragReservePiece(null);
		input.setDragBoardFrom(coord);
	}

	function onReserveDragStart(reserveColor: 'white' | 'black', piece: PieceType): void {
		preserveSelectionOnNextClickAfterCanceledDrag = false;
		const game = input.getGame();
		if (isHistoryPreviewMode()) {
			clearDragState();
			return;
		}
		if (!game || !game.viewerColor || reserveColor !== game.viewerColor) {
			clearDragState();
			return;
		}
		if (!game.state.reserves[game.viewerColor][piece]) {
			clearDragState();
			return;
		}

		isDragging = true;
		input.setErrorMessage('');
		input.setSelectedBoardFrom(null);
		input.setSelectedReservePiece(piece);
		input.setDragBoardFrom(null);
		input.setDragReservePiece(piece);
	}

	async function onCellDrop(coord: Coord): Promise<void> {
		isDragging = false;
		const game = input.getGame();
		if (isHistoryPreviewMode() || !game || !input.getIsMyTurn()) {
			preserveSelectionOnNextClickAfterCanceledDrag = false;
			clearDragState();
			return;
		}

		const activeReservePiece = input.getDragReservePiece() ?? input.getSelectedReservePiece();
		if (activeReservePiece) {
			if (!input.getTargetHints().has(coordKey(coord))) {
				clearDragState();
				return;
			}

			const viewerColor = game.viewerColor;
			if (!viewerColor) {
				clearDragState();
				return;
			}

			try {
				await playMoveWithPieceTransition(
					{
						type: 'play',
						move: { kind: 'place', piece: activeReservePiece, to: coord }
					},
					{
						toBoard: coord,
						fromReserve: {
							owner: viewerColor,
							piece: activeReservePiece
						}
					}
				);
				resetSelection();
				input.setErrorMessage('');
			} catch (error) {
				input.setErrorMessage(
					error instanceof Error ? error.message : translate('errors.invalidMove')
				);
			}
			return;
		}

		const activeBoardFrom = input.getDragBoardFrom() ?? input.getSelectedBoardFrom();
		if (!activeBoardFrom) {
			preserveSelectionOnNextClickAfterCanceledDrag = false;
			return;
		}
		if (coord.x === activeBoardFrom.x && coord.y === activeBoardFrom.y) {
			clearDragState();
			preserveSelectionOnNextClickAfterCanceledDrag = true;
			return;
		}
		if (!input.getTargetHints().has(coordKey(coord))) {
			preserveSelectionOnNextClickAfterCanceledDrag = false;
			clearDragState();
			return;
		}

		try {
			await playMoveWithPieceTransition(
				{
					type: 'play',
					move: { kind: 'move', from: activeBoardFrom, to: coord }
				},
				{
					fromBoard: activeBoardFrom,
					toBoard: coord
				}
			);
			resetSelection();
			input.setErrorMessage('');
		} catch (error) {
			input.setErrorMessage(
				error instanceof Error ? error.message : translate('errors.invalidMove')
			);
		}
		preserveSelectionOnNextClickAfterCanceledDrag = false;
	}

	function cancelDrag(): void {
		const hadActiveDrag = Boolean(input.getDragBoardFrom() || input.getDragReservePiece());
		isDragging = false;
		clearDragState();
		preserveSelectionOnNextClickAfterCanceledDrag = hadActiveDrag;
	}

	function setShowRulesModal(open: boolean): void {
		input.setShowRulesModal(open);
	}

	function setShowRepetitionDrawModal(open: boolean): void {
		input.setShowRepetitionDrawModal(open);
	}

	function toggleHistoryPanel(): void {
		const nextOpen = !input.getShowHistoryPanel();
		input.setShowHistoryPanel(nextOpen);
		if (!nextOpen) {
			clearHistoryPreview();
		}
	}

	function jumpToHistoryFirst(): void {
		goToHistoryStep(0);
	}

	function jumpToHistoryPrevious(): void {
		const entries = historyEntries();
		if (entries.length === 0) {
			return;
		}
		const current = input.getHistoryStep() ?? entries.length;
		goToHistoryStep(Math.max(0, current - 1));
	}

	function jumpToHistoryNext(): void {
		const entries = historyEntries();
		if (entries.length === 0) {
			return;
		}
		const current = input.getHistoryStep() ?? entries.length;
		goToHistoryStep(Math.min(entries.length, current + 1));
	}

	function jumpToHistoryLast(): void {
		const entries = historyEntries();
		if (entries.length === 0) {
			return;
		}
		goToHistoryStep(entries.length);
	}

	return {
		onJoin,
		copyInviteLink,
		onRequestRematch,
		onAcceptRematch,
		onBoardHover,
		clearBoardHover,
		onReserveHover,
		clearReserveHover,
		onCellClick,
		onReserveClick,
		onBoardDragStart,
		onReserveDragStart,
		onCellDrop,
		cancelDrag,
		setShowRulesModal,
		setShowRepetitionDrawModal,
		toggleHistoryPanel,
		playHistoryMove,
		jumpToHistoryFirst,
		jumpToHistoryPrevious,
		jumpToHistoryNext,
		jumpToHistoryLast
	};
}
