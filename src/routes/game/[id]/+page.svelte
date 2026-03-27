<script lang="ts">
	import { page } from '$app/state';
	import { onDestroy, onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Confetti } from 'svelte-confetti';
	import BoardGrid from '$lib/components/game/BoardGrid.svelte';
	import DragGhost from '$lib/components/game/DragGhost.svelte';
	import GameHeader from '$lib/components/game/GameHeader.svelte';
	import InvitationJoinCard from '$lib/components/game/InvitationJoinCard.svelte';
	import MoveHistoryPanel from '$lib/components/game/MoveHistoryPanel.svelte';
	import ReserveRow from '$lib/components/game/ReserveRow.svelte';
	import GameDialog from '$lib/components/GameDialog.svelte';
	import { buildPageTitle, toAbsoluteUrl } from '$lib/seo';
	import { createGameState } from '$lib/state/game.svelte';
	import favicon from '$lib/assets/favicon.png';
	import { slide } from 'svelte/transition';
	import type { Color, Coord, PieceType } from '$lib/types/game';

	// Local drag ghost state — separate from game state
	let ghostX = $state(0);
	let ghostY = $state(0);
	let ghostPieceType: PieceType | null = $state(null);
	let ghostPieceColor: Color | null = $state(null);
	let ghostVisible = $state(false);

	const props = $props<{ data: { gameId: string } }>();
	const gameState = createGameState(() => props.data.gameId);
	const pageTitle = $derived($_('game.pageTitle', { values: { id: props.data.gameId } }));
	const pageDescription = $derived($_('game.pageDescription'));
	const canonicalUrl = $derived(page.url.href);
	const ogImageUrl = $derived(toAbsoluteUrl(page.url.origin, favicon));
	const rankedDeltaText = $derived.by(() => {
		const game = gameState.view.game;
		if (!game || game.state.options.isRanked !== true || !game.viewerColor) {
			return null;
		}
		const raw =
			game.viewerColor === 'white'
				? game.state.options.rankedWhiteDelta
				: game.state.options.rankedBlackDelta;
		if (typeof raw !== 'number') {
			return null;
		}
		const sign = raw >= 0 ? '+' : '';
		return `${sign}${raw} Elo`;
	});

	onMount(async () => {
		await gameState.lifecycle.init();
		if (typeof document !== 'undefined') {
			console.log('[drag-ghost] registering document event listeners');
			document.addEventListener('touchmove', onDocumentTouchMove, { passive: false });
			document.addEventListener('pointerup', onDocumentPointerUp);
			document.addEventListener('pointercancel', onDocumentPointerCancel);
			document.addEventListener('pointerdown', onFirstPointerDown, { once: true });
		}
	});

	onDestroy(() => {
		if (typeof document !== 'undefined') {
			document.removeEventListener('touchmove', onDocumentTouchMove);
			document.removeEventListener('pointerup', onDocumentPointerUp);
			document.removeEventListener('pointercancel', onDocumentPointerCancel);
			document.removeEventListener('pointerdown', onFirstPointerDown);
		}
		gameState.lifecycle.destroy();
	});

	function onFirstPointerDown(): void {
		gameState.lifecycle.unlockAudio();
	}

	// Debug: log ghost state changes
	$effect(() => {
		console.log('[drag-ghost] state updated:', {
			ghostPieceType,
			ghostPieceColor,
			ghostPosition: ghostPieceType ? { x: ghostX, y: ghostY } : null,
			shouldRender: !!(ghostPieceType && ghostPieceColor)
		});
	});

	function onDocumentTouchMove(event: TouchEvent): void {
		if (!gameState.isDragging()) {
			return;
		}

		event.preventDefault();

		// Update drag ghost position to follow finger
		if (event.touches.length > 0) {
			const touch = event.touches[0];
			console.log('[drag-ghost] touchmove:', {
				clientX: touch.clientX,
				clientY: touch.clientY,
				isDragging: gameState.isDragging(),
				hasPieceInfo: !!ghostPieceType
			});
			ghostX = touch.clientX;
			ghostY = touch.clientY;
			ghostVisible = true;
		}
	}

	function onDocumentPointerUp(event: PointerEvent): void {
		if (event.pointerType === 'mouse' || !gameState.isDragging()) return;
		console.log('[drag-ghost] pointerup triggered:', {
			pointerType: event.pointerType,
			clientX: event.clientX,
			clientY: event.clientY,
			isDragging: gameState.isDragging()
		});
		const el = document.elementFromPoint(event.clientX, event.clientY);
		const button = el?.closest('[data-cell-x]') as HTMLElement | null;
		if (button?.dataset.cellX !== undefined && button?.dataset.cellY !== undefined) {
			const x = parseInt(button.dataset.cellX, 10);
			const y = parseInt(button.dataset.cellY, 10);
			console.log('[drag-ghost] dropping on cell:', { x, y });
			gameState.actions.onCellDrop({ x, y });
		} else {
			console.log('[drag-ghost] drop cancelled (no valid cell found)');
			gameState.actions.cancelDrag();
		}
		// Clear ghost visual
		console.log('[drag-ghost] clearing ghost on pointerup');
		ghostPieceType = null;
		ghostPieceColor = null;
		ghostVisible = false;
	}

	function onDocumentPointerCancel(event: PointerEvent): void {
		if (event.pointerType === 'mouse' || !gameState.isDragging()) return;
		console.log('[drag-ghost] pointercancel triggered:', { pointerType: event.pointerType });
		gameState.actions.cancelDrag();
		// Clear ghost visual
		console.log('[drag-ghost] clearing ghost on pointercancel');
		ghostPieceType = null;
		ghostPieceColor = null;
		ghostVisible = false;
	}

	function onBoardDragStartWithGhost(coord: Coord): void {
		console.log('[drag-ghost] board drag start:', coord);
		gameState.actions.onBoardDragStart(coord);
		// Initialize ghost piece info if drag was successful
		const game = gameState.view.game;
		if (game && gameState.isDragging()) {
			const piece = game.state.board[coord.y]?.[coord.x];
			if (piece) {
				console.log('[drag-ghost] initializing board piece:', {
					type: piece.type,
					color: piece.owner,
					position: coord
				});
				ghostPieceType = piece.type;
				ghostPieceColor = piece.owner;
				ghostX = 0;
				ghostY = 0;
				console.log('[drag-ghost] ghost initialized:', {
					type: ghostPieceType,
					color: ghostPieceColor
				});
			}
		}
	}

	function onReserveDragStartWithGhost(color: 'white' | 'black', piece: PieceType): void {
		console.log('[drag-ghost] reserve drag start:', { color, piece });
		gameState.actions.onReserveDragStart(color, piece);
		// Initialize ghost piece info if drag was successful
		if (gameState.isDragging()) {
			console.log('[drag-ghost] initializing reserve piece:', { type: piece, color });
			ghostPieceType = piece;
			ghostPieceColor = color;
			ghostX = 0;
			ghostY = 0;
			console.log('[drag-ghost] ghost initialized:', {
				type: ghostPieceType,
				color: ghostPieceColor
			});
		}
	}
</script>

<svelte:head>
	<title>{buildPageTitle(pageTitle)}</title>
	<meta name="description" content={pageDescription} />
	<link rel="canonical" href={canonicalUrl} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={buildPageTitle(pageTitle)} />
	<meta property="og:description" content={pageDescription} />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:image" content={ogImageUrl} />
	<meta property="og:image:alt" content={$_('meta.ogImageAlt')} />
	<meta name="twitter:card" content={$_('meta.twitterCard')} />
	<meta name="twitter:title" content={buildPageTitle(pageTitle)} />
	<meta name="twitter:description" content={pageDescription} />
	<meta name="twitter:image" content={ogImageUrl} />
</svelte:head>

<main class="mx-auto max-w-3xl px-4 py-6">
	<GameHeader
		gameId={gameState.view.gameId}
		turnLineText={gameState.view.turnLineText}
		isViewerTurnNow={gameState.view.isViewerTurnNow}
		copying={gameState.view.copying}
		historyOpen={gameState.view.showHistoryPanel}
		onToggleHistory={gameState.actions.toggleHistoryPanel}
		onCopyInvite={() => gameState.actions.copyInviteLink(window.location.href)}
	/>

	{#if gameState.view.loading}
		<p class="dark:text-gray-300">{$_('common.loading')}</p>
	{:else if !gameState.view.game}
		<p class="text-red-600 dark:text-red-400">
			{gameState.view.errorMessage || $_('common.gameNotFound')}
		</p>
	{:else}
		{#if gameState.view.game.viewerRole === 'guest' && gameState.view.game.joinAllowed && !gameState.view.game.viewerIsInviter}
			<InvitationJoinCard
				inviterName={gameState.view.game.state.inviter.name}
				options={gameState.view.invitationOptions}
				onJoin={gameState.actions.onJoin}
			/>
		{/if}

		{#if gameState.view.isGameFinished}
			<section
				transition:slide
				class="mb-3 rounded border border-black bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
			>
				<p class="text-lg font-semibold dark:text-gray-100">{gameState.view.winnerModalTitle}</p>
				{#if gameState.view.winnerDetailsLine}
					<p class="mt-1 text-sm text-gray-700 dark:text-gray-300">
						{gameState.view.winnerDetailsLine}
					</p>
				{/if}
				<p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
					{gameState.view.winnerModalSubtitle}
				</p>
				{#if rankedDeltaText}
					<p class="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
						{$_('game.winner.rankedDelta', { values: { delta: rankedDeltaText } })}
					</p>
				{/if}

				<div class="mt-4 flex flex-wrap items-center gap-2">
					{#if gameState.view.canRequestRematch}
						<button
							type="button"
							onclick={gameState.actions.onRequestRematch}
							disabled={gameState.view.isSubmittingRematch}
							class="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-gray-800 dark:text-gray-100"
						>
							{gameState.view.isSubmittingRematch
								? $_('game.rematch.sending')
								: $_('game.rematch.request')}
						</button>
					{:else if gameState.view.canAcceptRematch}
						<button
							type="button"
							onclick={gameState.actions.onAcceptRematch}
							disabled={gameState.view.isSubmittingRematch}
							class="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-gray-800 dark:text-gray-100"
						>
							{gameState.view.isSubmittingRematch
								? $_('game.rematch.starting')
								: $_('game.rematch.accept')}
						</button>
					{:else if gameState.view.game?.state.rematchRequestedBy}
						<p class="text-sm text-gray-700 dark:text-gray-300">{$_('game.rematch.pending')}</p>
					{:else if gameState.view.game?.state.bestOfWinner}
						<p class="text-sm text-gray-700 dark:text-gray-300">{$_('game.rematch.finished')}</p>
					{/if}

					<button
						type="button"
						onclick={() => goto(resolve('/'))}
						class="rounded border border-gray-300 px-4 py-2 text-sm font-medium dark:border-gray-700 dark:text-gray-300"
					>
						{$_('game.rematch.newGame')}
					</button>
				</div>
			</section>
		{/if}

		<div
			class={`grid gap-3 ${gameState.view.showHistoryPanel ? 'lg:grid-cols-[minmax(0,1fr)_18rem] lg:grid-rows-[auto_minmax(0,1fr)_auto] lg:items-start' : 'grid-cols-1'}`}
		>
			<div class={gameState.view.showHistoryPanel ? 'lg:col-start-1 lg:row-start-1' : ''}>
				<ReserveRow
					playerName={gameState.view.game.state.players.black?.name ?? $_('common.waiting')}
					playerScore={gameState.view.topPlayerScore}
					clockText={gameState.view.topClockText}
					clockUrgent={gameState.view.topClockUrgent}
					isActiveTurn={gameState.view.displayTurn === 'black'}
					reserveColor={gameState.view.topReserveColor}
					pieces={gameState.view.topReservePieces}
					isMine={gameState.view.topReserveIsMine}
					selectedPiece={gameState.view.selectedReservePiece}
					onClick={gameState.actions.onReserveClick}
					onDragStart={onReserveDragStartWithGhost}
					onDragCancel={gameState.actions.cancelDrag}
					onEnter={gameState.actions.onReserveHover}
					onLeave={gameState.actions.clearReserveHover}
					pieceTransitionName={gameState.view.reservePieceTransitionName}
				/>
			</div>
			{#if gameState.view.errorMessage}
				<p transition:slide class="my-2 text-sm text-red-600">{gameState.view.errorMessage}</p>
			{/if}
			<div class={gameState.view.showHistoryPanel ? 'lg:col-start-1 lg:row-start-2' : ''}>
				<BoardGrid
					board={gameState.view.displayBoard}
					targetHints={gameState.view.targetHints}
					targetHintTone={gameState.view.targetHintTone}
					isMyTurn={gameState.view.isMyTurn}
					viewerColor={gameState.view.game?.viewerColor ?? null}
					selectedBoardFrom={gameState.view.selectedBoardFrom}
					onCellEnter={gameState.actions.onBoardHover}
					onCellLeave={gameState.actions.clearBoardHover}
					onCellClick={gameState.actions.onCellClick}
					onBoardDragStart={onBoardDragStartWithGhost}
					onCellDrop={gameState.actions.onCellDrop}
					onDragCancel={gameState.actions.cancelDrag}
					pieceTransitionName={gameState.view.boardPieceTransitionName}
				/>
			</div>

			<div class={gameState.view.showHistoryPanel ? 'lg:col-start-1 lg:row-start-3' : ''}>
				<ReserveRow
					playerName={gameState.view.game.state.players.white?.name ?? $_('common.waiting')}
					playerScore={gameState.view.bottomPlayerScore}
					clockText={gameState.view.bottomClockText}
					clockUrgent={gameState.view.bottomClockUrgent}
					isActiveTurn={gameState.view.displayTurn === 'white'}
					reserveColor={gameState.view.bottomReserveColor}
					pieces={gameState.view.bottomReservePieces}
					isMine={gameState.view.bottomReserveIsMine}
					selectedPiece={gameState.view.selectedReservePiece}
					onClick={gameState.actions.onReserveClick}
					onDragStart={onReserveDragStartWithGhost}
					onDragCancel={gameState.actions.cancelDrag}
					onEnter={gameState.actions.onReserveHover}
					onLeave={gameState.actions.clearReserveHover}
					pieceTransitionName={gameState.view.reservePieceTransitionName}
				/>
			</div>

			{#if gameState.view.showHistoryPanel}
				<div class="lg:col-start-2 lg:row-span-3 lg:row-start-1">
					<MoveHistoryPanel
						entries={gameState.view.historyEntries}
						selectedMoveIndex={gameState.view.historySelectedMoveIndex}
						onSelectMove={gameState.actions.playHistoryMove}
						onJumpFirst={gameState.actions.jumpToHistoryFirst}
						onJumpPrevious={gameState.actions.jumpToHistoryPrevious}
						onJumpNext={gameState.actions.jumpToHistoryNext}
						onJumpLast={gameState.actions.jumpToHistoryLast}
					/>
				</div>
			{/if}
		</div>
	{/if}

	{#if gameState.view.isGameFinished}
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
	{/if}

	<GameDialog
		open={gameState.view.showRepetitionDrawModal}
		closable={true}
		title={gameState.view.repetitionDrawModalTitle}
		onClose={() => gameState.actions.setShowRepetitionDrawModal(false)}
	>
		<p class="mt-2 text-gray-700 dark:text-gray-300">
			{gameState.view.repetitionDrawModalSubtitle}
		</p>
		<p class="mt-2 text-gray-700 dark:text-gray-300">{$_('game.repetition.details')}</p>
	</GameDialog>

	{#if ghostPieceType && ghostPieceColor && ghostVisible}
		<DragGhost pieceType={ghostPieceType} pieceColor={ghostPieceColor} x={ghostX} y={ghostY} />
	{/if}
</main>
