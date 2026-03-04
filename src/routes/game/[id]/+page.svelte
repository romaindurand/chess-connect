<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { fade, fly } from 'svelte/transition';
	import { ChessBishop, ChessKnight, ChessPawn, ChessRook } from '@lucide/svelte';
	import { Confetti } from 'svelte-confetti';

	import {
		acceptRematchRemote,
		getGameViewRemote,
		openGameEventStream,
		playMoveRemote,
		postGameActionRemote,
		requestRematchRemote
	} from '$lib/client/game-api';
	import {
		coordKey,
		PIECES,
		type Coord,
		type GameView,
		type PieceOnBoard,
		type PieceType
	} from '$lib/types/game';

	let { data } = $props();

	const gameId = $derived(data.gameId as string);

	let game = $state<GameView | null>(null);
	let loading = $state(true);
	let errorMessage = $state('');
	let joinName = $state('');
	let selectedBoardFrom = $state<Coord | null>(null);
	let selectedReservePiece = $state<PieceType | null>(null);
	let hoveredBoardFrom = $state<Coord | null>(null);
	let hoveredReservePiece = $state<PieceType | null>(null);
	let copying = $state(false);
	let isSubmittingRematch = $state(false);

	let stream: EventSource | null = null;

	const targetHints = $derived.by(() => {
		if (!game) {
			return new Set<string>();
		}

		if (hoveredBoardFrom) {
			const key = coordKey(hoveredBoardFrom);
			return new Set((game.legalOptions.byBoardFrom[key] ?? []).map(coordKey));
		}

		if (hoveredReservePiece) {
			return new Set((game.legalOptions.byReservePiece[hoveredReservePiece] ?? []).map(coordKey));
		}

		if (selectedBoardFrom) {
			const key = coordKey(selectedBoardFrom);
			return new Set((game.legalOptions.byBoardFrom[key] ?? []).map(coordKey));
		}

		if (selectedReservePiece) {
			return new Set((game.legalOptions.byReservePiece[selectedReservePiece] ?? []).map(coordKey));
		}

		return new Set<string>();
	});

	const isMyTurn = $derived(
		Boolean(game && game.viewerColor === game.state.turn && game.state.status === 'active')
	);

	const topReserveColor = $derived('black' as const);
	const bottomReserveColor = $derived('white' as const);
	const topReserveIsMine = $derived(
		Boolean(game?.viewerColor && game.viewerColor === topReserveColor)
	);
	const bottomReserveIsMine = $derived(
		Boolean(game?.viewerColor && game.viewerColor === bottomReserveColor)
	);

	const topReservePieces = $derived.by(() => {
		const currentGame = game;
		if (!currentGame) {
			return [] as PieceType[];
		}
		return PIECES.filter((piece) => currentGame.state.reserves[topReserveColor][piece]);
	});

	const bottomReservePieces = $derived.by(() => {
		const currentGame = game;
		if (!currentGame) {
			return [] as PieceType[];
		}
		return PIECES.filter((piece) => currentGame.state.reserves[bottomReserveColor][piece]);
	});

	const isGameFinished = $derived(Boolean(game?.state.status === 'finished' && game?.state.winner));

	const canRequestRematch = $derived.by(() => {
		if (!game || !game.viewerColor || !isGameFinished || game.state.bestOfWinner) {
			return false;
		}
		if (game.state.rematchRequestedBy) {
			return false;
		}
		if (!game.state.winner) {
			return false;
		}
		return game.viewerColor !== game.state.winner;
	});

	const canAcceptRematch = $derived.by(() => {
		if (!game || !game.viewerColor || !isGameFinished || game.state.bestOfWinner) {
			return false;
		}
		if (!game.state.rematchRequestedBy) {
			return false;
		}
		return game.viewerColor !== game.state.rematchRequestedBy;
	});

	const winnerModalTitle = $derived.by(() => {
		if (!game || !isGameFinished || !game.state.winner) {
			return '';
		}

		if (game.viewerRole === 'white' || game.viewerRole === 'black') {
			if (game.viewerColor === game.state.winner) {
				return 'Victoire 🎉';
			}
			return 'Défaite';
		}

		return `Partie terminée — ${game.state.winner === 'white' ? 'Blanc' : 'Noir'} gagne`;
	});

	const winnerModalSubtitle = $derived.by(() => {
		if (!game || !isGameFinished) {
			return '';
		}

		return `Score actuel: Blanc ${game.state.score.white} - Noir ${game.state.score.black}`;
	});

	const winnerDetailsLine = $derived.by(() => {
		if (!game || !game.state.winner) {
			return '';
		}

		const whiteName = game.state.players.white?.name ?? 'Joueur blanc';
		const blackName = game.state.players.black?.name ?? 'Joueur noir';
		const winnerName = game.state.winner === 'white' ? whiteName : blackName;
		const winnerColor = game.state.winner === 'white' ? 'Blanc' : 'Noir';

		return `Gagnant: ${winnerName} (${winnerColor})`;
	});

	async function refreshState(): Promise<void> {
		try {
			game = await getGameViewRemote(gameId);
			errorMessage = '';
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Impossible de charger la partie';
		} finally {
			loading = false;
		}
	}

	function resetSelection(): void {
		selectedBoardFrom = null;
		selectedReservePiece = null;
	}

	function connectEventStream(): void {
		stream?.close();
		stream = openGameEventStream(gameId, (event) => {
			if (event.type === 'snapshot') {
				game = event.game;
				if (selectedBoardFrom) {
					const key = coordKey(selectedBoardFrom);
					if (!event.game.legalOptions.byBoardFrom[key]) {
						selectedBoardFrom = null;
					}
				}
				if (
					selectedReservePiece &&
					event.game.viewerColor &&
					!event.game.state.reserves[event.game.viewerColor][selectedReservePiece]
				) {
					selectedReservePiece = null;
				}
			}
		});
		stream.onerror = () => {
			errorMessage = 'Connexion temps réel interrompue, reconnexion en cours...';
		};
	}

	onMount(async () => {
		await refreshState();
		connectEventStream();
	});

	onDestroy(() => {
		stream?.close();
	});

	async function onJoin(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		const name = joinName.trim();
		if (name.length < 2) {
			errorMessage = 'Le pseudo doit contenir au moins 2 caractères.';
			return;
		}

		try {
			game = await postGameActionRemote(gameId, { type: 'join', name });
			connectEventStream();
			joinName = '';
			errorMessage = '';
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Impossible de rejoindre la partie';
		}
	}

	async function copyInviteLink(): Promise<void> {
		copying = true;
		try {
			await navigator.clipboard.writeText(window.location.href);
		} finally {
			setTimeout(() => {
				copying = false;
			}, 800);
		}
	}

	async function onRequestRematch(): Promise<void> {
		if (!game || isSubmittingRematch) {
			return;
		}

		isSubmittingRematch = true;
		try {
			game = await requestRematchRemote(gameId);
			errorMessage = '';
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Impossible de proposer une revanche';
		} finally {
			isSubmittingRematch = false;
		}
	}

	async function onAcceptRematch(): Promise<void> {
		if (!game || isSubmittingRematch) {
			return;
		}

		isSubmittingRematch = true;
		try {
			game = await acceptRematchRemote(gameId);
			resetSelection();
			errorMessage = '';
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Impossible de démarrer la revanche';
		} finally {
			isSubmittingRematch = false;
		}
	}

	function isMyPiece(cell: PieceOnBoard | null): boolean {
		return Boolean(game && game.viewerColor && cell && cell.owner === game.viewerColor);
	}

	async function onCellClick(coord: Coord): Promise<void> {
		if (!game || !isMyTurn) {
			return;
		}

		const cell = game.state.board[coord.y][coord.x];

		if (selectedReservePiece) {
			if (targetHints.has(coordKey(coord))) {
				try {
					game = await playMoveRemote(gameId, {
						type: 'play',
						move: { kind: 'place', piece: selectedReservePiece, to: coord }
					});
					resetSelection();
				} catch (error) {
					errorMessage = error instanceof Error ? error.message : 'Coup invalide';
				}
			}
			return;
		}

		if (selectedBoardFrom) {
			if (coord.x === selectedBoardFrom.x && coord.y === selectedBoardFrom.y) {
				selectedBoardFrom = null;
				return;
			}
			if (targetHints.has(coordKey(coord))) {
				try {
					game = await playMoveRemote(gameId, {
						type: 'play',
						move: { kind: 'move', from: selectedBoardFrom, to: coord }
					});
					resetSelection();
				} catch (error) {
					errorMessage = error instanceof Error ? error.message : 'Coup invalide';
				}
				return;
			}
		}

		if (isMyPiece(cell)) {
			selectedReservePiece = null;
			selectedBoardFrom = coord;
		}
	}

	function onReserveClick(reserveColor: 'white' | 'black', piece: PieceType): void {
		if (!game || !isMyTurn || !game.viewerColor || reserveColor !== game.viewerColor) {
			return;
		}
		if (!game.state.reserves[game.viewerColor][piece]) {
			return;
		}

		errorMessage = '';
		selectedBoardFrom = null;
		selectedReservePiece = selectedReservePiece === piece ? null : piece;
	}

	function playerLabel(color: 'white' | 'black'): string {
		if (!game) {
			return '-';
		}
		return game.state.players[color]?.name ?? 'En attente';
	}

	function roleText(): string {
		if (!game) {
			return '';
		}
		if (game.viewerRole === 'white' || game.viewerRole === 'black') {
			return `Vous êtes ${game.viewerRole === 'white' ? 'Blanc' : 'Noir'}`;
		}
		if (game.viewerRole === 'guest') {
			return 'Invitation en attente';
		}
		return 'Mode spectateur';
	}

	function turnLineText(): string {
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
		const isViewerTurn = game.viewerColor === game.state.turn;
		return `Tour ${turnNumber} — ${isViewerTurn ? "C'est à votre tour de jouer" : "C'est à l'adversaire de jouer"}`;
	}

	function isViewerTurnNow(): boolean {
		if (!game || game.state.winner) {
			return false;
		}
		if (game.viewerRole !== 'white' && game.viewerRole !== 'black') {
			return false;
		}
		return game.viewerColor === game.state.turn;
	}

	function pieceIcon(piece: PieceType): typeof ChessPawn {
		if (piece === 'pawn') {
			return ChessPawn;
		}
		if (piece === 'rook') {
			return ChessRook;
		}
		if (piece === 'knight') {
			return ChessKnight;
		}
		return ChessBishop;
	}

	function pieceChipClasses(owner: 'white' | 'black'): string {
		return owner === 'white'
			? 'border border-black bg-white text-black'
			: 'border border-black bg-black text-white';
	}
</script>

<main class="mx-auto max-w-3xl px-4 py-6">
	<header class="mb-4 flex items-center justify-between gap-3">
		<div>
			<h1 class="text-2xl font-semibold">Partie {gameId}</h1>
			<p class="text-sm text-gray-600">{roleText()}</p>
			{#if turnLineText()}
				<p class={`text-sm ${isViewerTurnNow() ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
					{turnLineText()}
				</p>
			{/if}
		</div>
		<button class="rounded border px-3 py-2 text-sm" type="button" onclick={copyInviteLink}>
			{copying ? 'Lien copié' : 'Copier le lien'}
		</button>
	</header>

	{#if loading}
		<p>Chargement...</p>
	{:else if !game}
		<p class="text-red-600">{errorMessage || 'Partie introuvable'}</p>
	{:else}
		<section class="mb-4 grid grid-cols-2 gap-3 rounded border p-3 text-sm">
			<div>
				<p class="font-medium">Blanc - {game.state.score.white}</p>
				<p>{playerLabel('white')}</p>
			</div>
			<div>
				<p class="font-medium">Noir - {game.state.score.black}</p>
				<p>{playerLabel('black')}</p>
			</div>
		</section>

		{#if game.viewerRole === 'guest' && game.joinAllowed}
			<form class="mb-4 flex flex-wrap items-end gap-3 rounded border p-3" onsubmit={onJoin}>
				<label class="grow space-y-2">
					<span class="text-sm font-medium">Votre pseudo</span>
					<input
						class="w-full rounded border border-gray-300 px-3 py-2"
						type="text"
						bind:value={joinName}
						maxlength="24"
						required
					/>
				</label>
				<button class="rounded bg-black px-3 py-2 text-white" type="submit"
					>Accepter l'invitation</button
				>
			</form>
		{/if}

		<div class="space-y-3">
			<div>
				<p class="mb-1 text-xs text-gray-500 uppercase">Réserve Noir</p>
				<div class="flex flex-wrap gap-2">
					{#each topReservePieces as piece (piece)}
						{@const Icon = pieceIcon(piece)}
						<button
							type="button"
							class={`rounded border px-2 py-1 text-sm ${topReserveIsMine && selectedReservePiece === piece ? 'ring-2 ring-black' : ''} ${!topReserveIsMine ? 'opacity-50' : ''}`}
							onclick={() => onReserveClick(topReserveColor, piece)}
							onmouseenter={() => {
								hoveredReservePiece = topReserveColor === game?.viewerColor ? piece : null;
							}}
							onmouseleave={() => {
								hoveredReservePiece = null;
							}}
							disabled={!topReserveIsMine || !isMyTurn}
							title={piece}
						>
							<span class={`inline-flex rounded p-1 ${pieceChipClasses(topReserveColor)}`}>
								<Icon class="h-8 w-8" />
							</span>
						</button>
					{/each}
				</div>
			</div>

			<div class="mx-auto grid w-3/4 grid-cols-4 gap-2">
				{#each game.state.board as row, y (y)}
					{#each row as cell, x (x)}
						{@const coord = { x, y }}
						{@const key = coordKey(coord)}
						<button
							type="button"
							class={`aspect-square rounded border ${targetHints.has(key) ? 'border-black bg-emerald-100' : 'border-gray-300 bg-stone-100'} ${selectedBoardFrom && selectedBoardFrom.x === x && selectedBoardFrom.y === y ? 'ring-2 ring-black' : ''}`}
							onmouseenter={() => {
								hoveredBoardFrom = isMyPiece(cell) ? coord : null;
							}}
							onmouseleave={() => {
								hoveredBoardFrom = null;
							}}
							onclick={() => onCellClick(coord)}
						>
							{#if cell}
								{@const Icon = pieceIcon(cell.type)}
								<span class={`inline-flex rounded p-1 ${pieceChipClasses(cell.owner)}`}>
									<Icon class="h-10 w-10" />
								</span>
							{/if}
						</button>
					{/each}
				{/each}
			</div>

			<div>
				<p class="mb-1 text-xs text-gray-500 uppercase">Réserve Blanc</p>
				<div class="flex flex-wrap gap-2">
					{#each bottomReservePieces as piece (piece)}
						{@const Icon = pieceIcon(piece)}
						<button
							type="button"
							class={`rounded border px-2 py-1 text-sm ${bottomReserveIsMine && selectedReservePiece === piece ? 'ring-2 ring-black' : ''} ${!bottomReserveIsMine ? 'opacity-50' : ''}`}
							onclick={() => onReserveClick(bottomReserveColor, piece)}
							onmouseenter={() => {
								hoveredReservePiece = bottomReserveColor === game?.viewerColor ? piece : null;
							}}
							onmouseleave={() => {
								hoveredReservePiece = null;
							}}
							disabled={!bottomReserveIsMine || !isMyTurn}
							title={piece}
						>
							<span class={`inline-flex rounded p-1 ${pieceChipClasses(bottomReserveColor)}`}>
								<Icon class="h-8 w-8" />
							</span>
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	{#if isGameFinished}
		<div
			style="position: fixed; top: -50px; left: 0; height: 100vh; width: 100vw; display: flex; justify-content: center; overflow: hidden; pointer-events: none; z-index: 40;"
		>
			<Confetti
				x={[-5, 5]}
				y={[0, 0.1]}
				delay={[0, 1000]}
				duration={3500}
				amount={200}
				fallDistance="100vh"
				iterationCount={1}
			/>
		</div>

		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
			transition:fade={{ duration: 180 }}
		>
			<div
				class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
				transition:fly={{ y: 16, duration: 220 }}
			>
				<h2 class="text-xl font-semibold">{winnerModalTitle}</h2>
				{#if winnerDetailsLine}
					<p class="mt-2 text-sm text-gray-700">{winnerDetailsLine}</p>
				{/if}
				<p class="mt-2 text-sm text-gray-700">{winnerModalSubtitle}</p>

				{#if canRequestRematch}
					<button
						type="button"
						onclick={onRequestRematch}
						disabled={isSubmittingRematch}
						class="mt-4 rounded bg-black px-4 py-2 text-white disabled:opacity-50"
					>
						{isSubmittingRematch ? 'Envoi...' : 'Proposer une revanche'}
					</button>
				{:else if canAcceptRematch}
					<button
						type="button"
						onclick={onAcceptRematch}
						disabled={isSubmittingRematch}
						class="mt-4 rounded bg-black px-4 py-2 text-white disabled:opacity-50"
					>
						{isSubmittingRematch ? 'Démarrage...' : 'Accepter la revanche'}
					</button>
				{:else if game?.state.rematchRequestedBy}
					<p class="mt-4 text-sm text-gray-700">Demande de revanche en attente...</p>
				{:else if game?.state.bestOfWinner}
					<p class="mt-4 text-sm text-gray-700">Ce match est terminé.</p>
				{/if}

				<button
					type="button"
					onclick={() => goto(resolve('/'))}
					class="mt-4 rounded border px-4 py-2 text-sm font-medium"
				>
					Nouvelle partie
				</button>
			</div>
		</div>
	{/if}

	{#if errorMessage}
		<p class="mt-3 text-sm text-red-600">{errorMessage}</p>
	{/if}
</main>
