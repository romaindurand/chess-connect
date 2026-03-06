import { playMoveRemote, postGameActionRemote, requestRematchRemote, acceptRematchRemote } from '$lib/client/game-api';
import { coordKey, type Coord, type GameView, type PieceOnBoard, type PieceType } from '$lib/types/game';

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
	getIsMyTurn: () => boolean;
	getTargetHints: () => Set<string>;
	reconnectEventStream: () => void;
}

export function createGameActions(input: GameActionsFactoryInput) {
	function resetSelection(): void {
		input.setSelectedBoardFrom(null);
		input.setSelectedReservePiece(null);
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
		if (!game || !input.getIsMyTurn()) {
			return;
		}

		const cell = game.state.board[coord.y][coord.x];
		const selectedReservePiece = input.getSelectedReservePiece();

		if (selectedReservePiece) {
			if (input.getTargetHints().has(coordKey(coord))) {
				try {
					const updatedGame = await playMoveRemote(input.getGameId(), {
						type: 'play',
						move: { kind: 'place', piece: selectedReservePiece, to: coord }
					});
					input.setGame(updatedGame);
					resetSelection();
				} catch (error) {
					input.setErrorMessage(error instanceof Error ? error.message : 'Coup invalide');
				}
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
					const updatedGame = await playMoveRemote(input.getGameId(), {
						type: 'play',
						move: { kind: 'move', from: selectedBoardFrom, to: coord }
					});
					input.setGame(updatedGame);
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
		setShowRulesModal
	};
}
