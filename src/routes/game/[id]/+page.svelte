<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	import {
		getGameViewRemote,
		openGameEventStream,
		playMoveRemote,
		postGameActionRemote
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

	onMount(async () => {
		await refreshState();
		stream = openGameEventStream(gameId, (event) => {
			if (event.type === 'snapshot') {
				game = event.game;
				if (selectedBoardFrom) {
					const key = coordKey(selectedBoardFrom);
					if (!event.game.legalOptions.byBoardFrom[key]) {
						selectedBoardFrom = null;
					}
				}
			}
		});
		stream.onerror = () => {
			errorMessage = 'Connexion temps réel interrompue, reconnexion en cours...';
		};
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

	function onReserveClick(piece: PieceType): void {
		if (!game || !isMyTurn || !game.viewerColor) {
			return;
		}
		if (!game.state.reserves[game.viewerColor][piece]) {
			return;
		}

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
</script>

<main class="mx-auto max-w-3xl px-4 py-6">
	<header class="mb-4 flex items-center justify-between gap-3">
		<div>
			<h1 class="text-2xl font-semibold">Partie {gameId}</h1>
			<p class="text-sm text-gray-600">{roleText()}</p>
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
				<p class="font-medium">Blanc</p>
				<p>{playerLabel('white')}</p>
			</div>
			<div>
				<p class="font-medium">Noir</p>
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
					{#each PIECES as piece (piece)}
						<button
							type="button"
							class={`rounded border px-2 py-1 text-sm ${selectedReservePiece === piece ? 'ring-2 ring-black' : ''}`}
							onclick={() => onReserveClick(piece)}
							onmouseenter={() => {
								hoveredReservePiece = topReserveColor === game?.viewerColor ? piece : null;
							}}
							onmouseleave={() => {
								hoveredReservePiece = null;
							}}
							disabled={!game.state.reserves[topReserveColor][piece]}
						>
							{piece}
						</button>
					{/each}
				</div>
			</div>

			<div class="grid grid-cols-4 gap-2">
				{#each game.state.board as row, y (y)}
					{#each row as cell, x (x)}
						{@const coord = { x, y }}
						{@const key = coordKey(coord)}
						<button
							type="button"
							class={`aspect-square rounded border text-xs ${targetHints.has(key) ? 'border-black bg-gray-100' : 'border-gray-300'} ${selectedBoardFrom && selectedBoardFrom.x === x && selectedBoardFrom.y === y ? 'ring-2 ring-black' : ''}`}
							onmouseenter={() => {
								hoveredBoardFrom = isMyPiece(cell) ? coord : null;
							}}
							onmouseleave={() => {
								hoveredBoardFrom = null;
							}}
							onclick={() => onCellClick(coord)}
						>
							{#if cell}
								<span
									>{cell.owner === 'white' ? 'W' : 'B'}-{cell.type.slice(0, 1).toUpperCase()}</span
								>
							{/if}
						</button>
					{/each}
				{/each}
			</div>

			<div>
				<p class="mb-1 text-xs text-gray-500 uppercase">Réserve Blanc</p>
				<div class="flex flex-wrap gap-2">
					{#each PIECES as piece (piece)}
						<button
							type="button"
							class={`rounded border px-2 py-1 text-sm ${selectedReservePiece === piece ? 'ring-2 ring-black' : ''}`}
							disabled={!game.state.reserves[bottomReserveColor][piece]}
							onclick={() => onReserveClick(piece)}
							onmouseenter={() => {
								hoveredReservePiece = bottomReserveColor === game?.viewerColor ? piece : null;
							}}
							onmouseleave={() => {
								hoveredReservePiece = null;
							}}
						>
							{piece}
						</button>
					{/each}
				</div>
			</div>
		</div>

		<p class="mt-4 text-sm text-gray-700">
			{#if game.state.winner}
				Partie terminée — gagnant: {game.state.winner === 'white' ? 'Blanc' : 'Noir'}
			{:else}
				Tour actuel: {game.state.turn === 'white' ? 'Blanc' : 'Noir'}
			{/if}
		</p>
	{/if}

	{#if errorMessage}
		<p class="mt-3 text-sm text-red-600">{errorMessage}</p>
	{/if}
</main>
