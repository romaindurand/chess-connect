import { getGameViewRemote, openGameEventStream } from '$lib/client/game-api';
import { coordKey, type Coord, type GameView, type PieceType } from '$lib/types/game';

interface GameLifecycleFactoryInput {
	getGameId: () => string;
	getSelectedBoardFrom: () => Coord | null;
	setSelectedBoardFrom: (coord: Coord | null) => void;
	getSelectedReservePiece: () => PieceType | null;
	setSelectedReservePiece: (piece: PieceType | null) => void;
	setGame: (game: GameView) => void;
	setErrorMessage: (message: string) => void;
	setLoading: (loading: boolean) => void;
	getStream: () => EventSource | null;
	setStream: (stream: EventSource | null) => void;
	setNowMs: (now: number) => void;
}

export function createGameLifecycle(input: GameLifecycleFactoryInput) {
	let nowTicker: ReturnType<typeof setInterval> | null = null;

	function startNowTicker(): void {
		if (nowTicker) {
			return;
		}
		nowTicker = setInterval(() => {
			input.setNowMs(Date.now());
		}, 1000);
	}

	function stopNowTicker(): void {
		if (!nowTicker) {
			return;
		}
		clearInterval(nowTicker);
		nowTicker = null;
	}

	function connectEventStream(): void {
		input.getStream()?.close();
		const stream = openGameEventStream(input.getGameId(), (event) => {
			if (event.type === 'snapshot') {
				input.setGame(event.game);
				const selectedBoardFrom = input.getSelectedBoardFrom();
				if (selectedBoardFrom) {
					const key = coordKey(selectedBoardFrom);
					if (!event.game.legalOptions.byBoardFrom[key]) {
						input.setSelectedBoardFrom(null);
					}
				}

				const selectedReservePiece = input.getSelectedReservePiece();
				if (
					selectedReservePiece &&
					event.game.viewerColor &&
					!event.game.state.reserves[event.game.viewerColor][selectedReservePiece]
				) {
					input.setSelectedReservePiece(null);
				}
			}
		});
		stream.onerror = () => {
			input.setErrorMessage('Connexion temps réel interrompue, reconnexion en cours...');
		};
		input.setStream(stream);
	}

	async function refreshState(): Promise<void> {
		try {
			const game = await getGameViewRemote(input.getGameId());
			input.setGame(game);
			input.setErrorMessage('');
		} catch (error) {
			input.setErrorMessage(
				error instanceof Error ? error.message : 'Impossible de charger la partie'
			);
		} finally {
			input.setLoading(false);
		}
	}

	async function init(): Promise<void> {
		await refreshState();
		connectEventStream();
		startNowTicker();
	}

	function destroy(): void {
		input.getStream()?.close();
		input.setStream(null);
		stopNowTicker();
	}

	return {
		init,
		destroy,
		reconnectEventStream: connectEventStream
	};
}
