import { playMoveRemote, postGameActionRemote, requestRematchRemote, acceptRematchRemote } from '$lib/client/game-api';
import { getSnapshotForHistoryStep, shouldFollowLiveEdge } from '$lib/state/history-live';
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
	function resetSelection(): void {
		input.setSelectedBoardFrom(null);
		input.setSelectedReservePiece(null);
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
		const previousMoveHistoryLength = input.getGame()?.state.moveHistory.length ?? 0;
		const followLiveHistory = shouldFollowLiveEdge(
			input.getHistoryStep(),
			previousMoveHistoryLength
		);

		if (typeof document === 'undefined' || typeof document.startViewTransition !== 'function') {
			const updatedGame = await playMoveRemote(input.getGameId(), payload);
			input.setGame(updatedGame);
			if (followLiveHistory) {
				input.setHistoryStep(updatedGame.state.moveHistory.length);
				input.setHistorySnapshot(null);
			}
			clearTransitionMarkers();
			return updatedGame;
		}

		const transitionName = `piece-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
		input.setActivePieceTransitionName(transitionName);
		input.setTransitionFromBoardKey(markers.fromBoard ? coordKey(markers.fromBoard) : null);
		input.setTransitionToBoardKey(coordKey(markers.toBoard));
		input.setTransitionReserveKey(
			markers.fromReserve ? `${markers.fromReserve.owner}:${markers.fromReserve.piece}` : null
		);
		const movingOwner = markers.fromReserve?.owner ?? input.getGame()?.viewerColor ?? null;
		input.setTransitionMovingOwner(movingOwner);

		await tick();

		let updatedGame: GameView | null = null;
		let moveError: unknown = null;

		const transition = document.startViewTransition(async () => {
			try {
				updatedGame = await playMoveRemote(input.getGameId(), payload);
				input.setGame(updatedGame);
				if (followLiveHistory) {
					input.setHistoryStep(updatedGame.state.moveHistory.length);
					input.setHistorySnapshot(null);
				}
			} catch (error) {
				moveError = error;
			}
		});

		await transition.finished.catch(() => undefined);
		clearTransitionMarkers();

		if (moveError) {
			throw moveError;
		}

		if (!updatedGame) {
			throw new Error('Coup invalide');
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
			input.setErrorMessage('Le pseudo doit contenir au moins 2 caractères.');
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
				error instanceof Error ? error.message : 'Impossible de rejoindre la partie'
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
				error instanceof Error ? error.message : 'Impossible de proposer une revanche'
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
				error instanceof Error ? error.message : 'Impossible de démarrer la revanche'
			);
		} finally {
			input.setIsSubmittingRematch(false);
		}
	}

	function onBoardHover(coord: Coord, cell: PieceOnBoard | null): void {
		input.setHoveredBoardFrom(isMyPiece(cell) ? coord : null);
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
					input.setErrorMessage(error instanceof Error ? error.message : 'Coup invalide');
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
					input.setErrorMessage(error instanceof Error ? error.message : 'Coup invalide');
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
		const game = input.getGame();
		if (isHistoryPreviewMode()) {
			return;
		}
		if (!game || !input.getIsMyTurn() || !game.viewerColor || reserveColor !== game.viewerColor) {
			return;
		}
		if (!game.state.reserves[game.viewerColor][piece]) {
			return;
		}

		input.setErrorMessage('');
		input.setSelectedBoardFrom(null);
		input.setSelectedReservePiece(input.getSelectedReservePiece() === piece ? null : piece);
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
