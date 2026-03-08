import { getGameViewRemote, openGameEventStream } from '$lib/client/game-api';
import { tick } from 'svelte';
import moveSoundUrl from '$lib/assets/move.mp3';
import captureSoundUrl from '$lib/assets/capture.mp3';
import {
	BOARD_SIZE,
	coordKey,
	type Color,
	type Coord,
	type GameView,
	type PieceOnBoard,
	type PieceType
} from '$lib/types/game';

interface GameLifecycleFactoryInput {
	getGameId: () => string;
	getSelectedBoardFrom: () => Coord | null;
	setSelectedBoardFrom: (coord: Coord | null) => void;
	getSelectedReservePiece: () => PieceType | null;
	setSelectedReservePiece: (piece: PieceType | null) => void;
	getGame: () => GameView | null;
	setGame: (game: GameView) => void;
	setErrorMessage: (message: string) => void;
	setLoading: (loading: boolean) => void;
	getStream: () => EventSource | null;
	setStream: (stream: EventSource | null) => void;
	setNowMs: (now: number) => void;
	getActivePieceTransitionName: () => string | null;
	setActivePieceTransitionName: (name: string | null) => void;
	setTransitionFromBoardKey: (key: string | null) => void;
	setTransitionToBoardKey: (key: string | null) => void;
	setTransitionReserveKey: (key: string | null) => void;
	setTransitionMovingOwner: (owner: Color | null) => void;
}

export function createGameLifecycle(input: GameLifecycleFactoryInput) {
	let nowTicker: ReturnType<typeof setInterval> | null = null;
	let snapshotQueue = Promise.resolve();
	let deferredSnapshot: GameView | null = null;
	let deferredSnapshotSound: 'move' | 'capture' | null = null;
	let deferredFlushTimer: ReturnType<typeof setTimeout> | null = null;
	let moveAudio: HTMLAudioElement | null = null;
	let captureAudio: HTMLAudioElement | null = null;

	function playSoundEffect(kind: 'move' | 'capture'): void {
		if (typeof Audio === 'undefined') {
			return;
		}

		const audio =
			kind === 'capture'
				? (captureAudio ??= new Audio(captureSoundUrl))
				: (moveAudio ??= new Audio(moveSoundUrl));

		audio.currentTime = 0;
		void audio.play().catch(() => {
			// Ignore autoplay/policy errors.
		});
	}

	function clearTransitionMarkers(): void {
		input.setActivePieceTransitionName(null);
		input.setTransitionFromBoardKey(null);
		input.setTransitionToBoardKey(null);
		input.setTransitionReserveKey(null);
		input.setTransitionMovingOwner(null);
	}

	function samePiece(a: PieceOnBoard | null, b: PieceOnBoard | null): boolean {
		if (!a && !b) {
			return true;
		}
		if (!a || !b) {
			return false;
		}
		return a.owner === b.owner && a.type === b.type && a.pawnDirection === b.pawnDirection;
	}

	function detectSnapshotTransition(
		previousGame: GameView,
		nextGame: GameView
	):
		| {
				fromBoard?: Coord;
				toBoard: Coord;
				fromReserve?: { owner: Color; piece: PieceType };
				moverColor: Color;
				sound: 'move' | 'capture';
		  }
		| null {
		if (nextGame.state.pliesPlayed !== previousGame.state.pliesPlayed + 1) {
			return null;
		}

		const moverColor = previousGame.state.turn;
		let fromBoard: Coord | null = null;
		let toBoard: Coord | null = null;

		for (let y = 0; y < BOARD_SIZE; y += 1) {
			for (let x = 0; x < BOARD_SIZE; x += 1) {
				const before = previousGame.state.board[y][x];
				const after = nextGame.state.board[y][x];
				if (samePiece(before, after)) {
					continue;
				}

				if (before && before.owner === moverColor && !after) {
					fromBoard = { x, y };
					continue;
				}

				if (after && after.owner === moverColor) {
					toBoard = { x, y };
				}
			}
		}

		if (!toBoard) {
			return null;
		}

		if (fromBoard) {
			const capturedBefore = previousGame.state.board[toBoard.y][toBoard.x];
			return {
				fromBoard,
				toBoard,
				moverColor,
				sound: capturedBefore ? 'capture' : 'move'
			};
		}

		const placedPiece = nextGame.state.board[toBoard.y][toBoard.x];
		if (!placedPiece || placedPiece.owner !== moverColor) {
			return null;
		}

		return {
			toBoard,
			fromReserve: {
				owner: moverColor,
				piece: placedPiece.type
			},
			moverColor,
			sound: 'move'
		};
	}

	async function applySnapshotWithTransition(
		nextGame: GameView
	): Promise<'move' | 'capture' | null> {
		const previousGame = input.getGame();
		if (!previousGame) {
			input.setGame(nextGame);
			return null;
		}

		const markers = detectSnapshotTransition(previousGame, nextGame);
		if (!markers) {
			input.setGame(nextGame);
			return null;
		}

		if (typeof document === 'undefined' || typeof document.startViewTransition !== 'function') {
			input.setGame(nextGame);
			return markers.sound;
		}

		const transitionName = `piece-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
		input.setActivePieceTransitionName(transitionName);
		input.setTransitionFromBoardKey(markers.fromBoard ? coordKey(markers.fromBoard) : null);
		input.setTransitionToBoardKey(coordKey(markers.toBoard));
		input.setTransitionReserveKey(
			markers.fromReserve ? `${markers.fromReserve.owner}:${markers.fromReserve.piece}` : null
		);
		const movingOwner = markers.fromReserve?.owner ?? previousGame.state.turn;
		input.setTransitionMovingOwner(movingOwner);

		await tick();

		const transition = document.startViewTransition(() => {
			input.setGame(nextGame);
		});

		await transition.finished.catch(() => undefined);
		clearTransitionMarkers();
		return markers.sound;
	}

	async function processSnapshot(
		snapshot: GameView,
		fallbackSound: 'move' | 'capture' | null = null
	): Promise<void> {
		const inferredSound = await applySnapshotWithTransition(snapshot);
		const soundToPlay = inferredSound ?? fallbackSound;
		if (soundToPlay) {
			playSoundEffect(soundToPlay);
		}

		const selectedBoardFrom = input.getSelectedBoardFrom();
		if (selectedBoardFrom) {
			const key = coordKey(selectedBoardFrom);
			if (!snapshot.legalOptions.byBoardFrom[key]) {
				input.setSelectedBoardFrom(null);
			}
		}

		const selectedReservePiece = input.getSelectedReservePiece();
		if (
			selectedReservePiece &&
			snapshot.viewerColor &&
			!snapshot.state.reserves[snapshot.viewerColor][selectedReservePiece]
		) {
			input.setSelectedReservePiece(null);
		}
	}

	function scheduleDeferredSnapshotFlush(): void {
		if (deferredFlushTimer) {
			return;
		}

		deferredFlushTimer = setTimeout(() => {
			deferredFlushTimer = null;
			if (input.getActivePieceTransitionName()) {
				scheduleDeferredSnapshotFlush();
				return;
			}

			if (!deferredSnapshot) {
				return;
			}

			const snapshot = deferredSnapshot;
			const snapshotSound = deferredSnapshotSound;
			deferredSnapshot = null;
			deferredSnapshotSound = null;
			snapshotQueue = snapshotQueue.then(() => processSnapshot(snapshot, snapshotSound));
		}, 16);
	}

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
				snapshotQueue = snapshotQueue.then(async () => {
					if (input.getActivePieceTransitionName()) {
						const currentGame = input.getGame();
						deferredSnapshotSound = currentGame
							? (detectSnapshotTransition(currentGame, event.game)?.sound ?? null)
							: null;
						deferredSnapshot = event.game;
						scheduleDeferredSnapshotFlush();
						return;
					}

					await processSnapshot(event.game, null);
				});
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
		if (deferredFlushTimer) {
			clearTimeout(deferredFlushTimer);
			deferredFlushTimer = null;
		}
		deferredSnapshot = null;
		deferredSnapshotSound = null;
	}

	return {
		init,
		destroy,
		reconnectEventStream: connectEventStream
	};
}
