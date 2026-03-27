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
	import type { Coord, PieceType } from '$lib/types/game';

	const props = $props<{ data: { gameId: string } }>();
	const state = createGameState(() => props.data.gameId);
	const pageTitle = $derived($_('game.pageTitle', { values: { id: props.data.gameId } }));
	const pageDescription = $derived($_('game.pageDescription'));
	const canonicalUrl = $derived(page.url.href);
	const ogImageUrl = $derived(toAbsoluteUrl(page.url.origin, favicon));
	const rankedDeltaText = $derived.by(() => {
		const game = state.view.game;
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
		await state.lifecycle.init();
		if (typeof document !== 'undefined') {
			console.log('[drag-ghost] registering document event listeners');
			document.addEventListener('touchmove', onDocumentTouchMove, { passive: false });
			document.addEventListener('pointerup', onDocumentPointerUp);
			document.addEventListener('pointercancel', onDocumentPointerCancel);
		}
	});

	onDestroy(() => {
		if (typeof document !== 'undefined') {
			document.removeEventListener('touchmove', onDocumentTouchMove);
			document.removeEventListener('pointerup', onDocumentPointerUp);
			document.removeEventListener('pointercancel', onDocumentPointerCancel);
		}
		state.lifecycle.destroy();
	});

	// Debug: log ghost state changes
	$effect(() => {
		console.log('[drag-ghost] state updated:', {
			dragGhostPieceInfo: state.dragGhostPieceInfo,
			dragGhostPosition: state.dragGhostPosition,
			shouldRender: !!(state.dragGhostPieceInfo && state.dragGhostPosition)
		});
	});

	function onDocumentTouchMove(event: TouchEvent): void {
		if (!state.isDragging()) {
			return;
		}

		event.preventDefault();

		// Update drag ghost position to follow finger
		if (event.touches.length > 0) {
			const touch = event.touches[0];
			console.log('[drag-ghost] touchmove:', {
				clientX: touch.clientX,
				clientY: touch.clientY,
				isDragging: state.isDragging(),
				hasPieceInfo: !!state.dragGhostPieceInfo
			});
			state.dragGhostPosition = {
				x: touch.clientX,
				y: touch.clientY
			};
		}
	}

	function onDocumentPointerUp(event: PointerEvent): void {
		if (event.pointerType === 'mouse' || !state.isDragging()) return;
		console.log('[drag-ghost] pointerup triggered:', {
			pointerType: event.pointerType,
			clientX: event.clientX,
			clientY: event.clientY,
			isDragging: state.isDragging()
		});
		const el = document.elementFromPoint(event.clientX, event.clientY);
		const button = el?.closest('[data-cell-x]') as HTMLElement | null;
		if (button?.dataset.cellX !== undefined && button?.dataset.cellY !== undefined) {
			const x = parseInt(button.dataset.cellX, 10);
			const y = parseInt(button.dataset.cellY, 10);
			console.log('[drag-ghost] dropping on cell:', { x, y });
			state.actions.onCellDrop({ x, y });
		} else {
			console.log('[drag-ghost] drop cancelled (no valid cell found)');
			state.actions.cancelDrag();
		}
		// Clear ghost visual
		console.log('[drag-ghost] clearing ghost on pointerup');
		state.dragGhostPosition = null;
		state.dragGhostPieceInfo = null;
	}

	function onDocumentPointerCancel(event: PointerEvent): void {
		if (event.pointerType === 'mouse' || !state.isDragging()) return;
		console.log('[drag-ghost] pointercancel triggered:', { pointerType: event.pointerType });
		state.actions.cancelDrag();
		// Clear ghost visual
		console.log('[drag-ghost] clearing ghost on pointercancel');
		state.dragGhostPosition = null;
		state.dragGhostPieceInfo = null;
	}

	function onBoardDragStartWithGhost(coord: Coord): void {
		console.log('[drag-ghost] board drag start:', coord);
		state.actions.onBoardDragStart(coord);
		// Initialize ghost piece info if drag was successful
		const game = state.view.game;
		if (game && state.isDragging()) {
			const piece = game.state.board[coord.y]?.[coord.x];
			if (piece) {
				console.log('[drag-ghost] initializing board piece:', {
					type: piece.type,
					color: piece.owner,
					position: coord
				});
				state.dragGhostPieceInfo = {
					type: piece.type,
					color: piece.owner
				};
				console.log('[drag-ghost] dragGhostPieceInfo now:', state.dragGhostPieceInfo);
			}
		}
	}

	function onReserveDragStartWithGhost(color: 'white' | 'black', piece: PieceType): void {
		console.log('[drag-ghost] reserve drag start:', { color, piece });
		state.actions.onReserveDragStart(color, piece);
		// Initialize ghost piece info if drag was successful
		if (state.isDragging()) {
			console.log('[drag-ghost] initializing reserve piece:', { type: piece, color });
			state.dragGhostPieceInfo = {
				type: piece,
				color
			};
			console.log('[drag-ghost] dragGhostPieceInfo now:', state.dragGhostPieceInfo);
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
		gameId={state.view.gameId}
		turnLineText={state.view.turnLineText}
		isViewerTurnNow={state.view.isViewerTurnNow}
		copying={state.view.copying}
		historyOpen={state.view.showHistoryPanel}
		onToggleHistory={state.actions.toggleHistoryPanel}
		onCopyInvite={() => state.actions.copyInviteLink(window.location.href)}
	/>

	{#if state.view.loading}
		<p class="dark:text-gray-300">{$_('common.loading')}</p>
	{:else if !state.view.game}
		<p class="text-red-600 dark:text-red-400">
			{state.view.errorMessage || $_('common.gameNotFound')}
		</p>
	{:else}
		{#if state.view.game.viewerRole === 'guest' && state.view.game.joinAllowed && !state.view.game.viewerIsInviter}
			<InvitationJoinCard
				inviterName={state.view.game.state.inviter.name}
				options={state.view.invitationOptions}
				onJoin={state.actions.onJoin}
			/>
		{/if}

		{#if state.view.isGameFinished}
			<section
				transition:slide
				class="mb-3 rounded border border-black bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
			>
				<p class="text-lg font-semibold dark:text-gray-100">{state.view.winnerModalTitle}</p>
				{#if state.view.winnerDetailsLine}
					<p class="mt-1 text-sm text-gray-700 dark:text-gray-300">
						{state.view.winnerDetailsLine}
					</p>
				{/if}
				<p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
					{state.view.winnerModalSubtitle}
				</p>
				{#if rankedDeltaText}
					<p class="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
						{$_('game.winner.rankedDelta', { values: { delta: rankedDeltaText } })}
					</p>
				{/if}

				<div class="mt-4 flex flex-wrap items-center gap-2">
					{#if state.view.canRequestRematch}
						<button
							type="button"
							onclick={state.actions.onRequestRematch}
							disabled={state.view.isSubmittingRematch}
							class="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-gray-800 dark:text-gray-100"
						>
							{state.view.isSubmittingRematch
								? $_('game.rematch.sending')
								: $_('game.rematch.request')}
						</button>
					{:else if state.view.canAcceptRematch}
						<button
							type="button"
							onclick={state.actions.onAcceptRematch}
							disabled={state.view.isSubmittingRematch}
							class="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-gray-800 dark:text-gray-100"
						>
							{state.view.isSubmittingRematch
								? $_('game.rematch.starting')
								: $_('game.rematch.accept')}
						</button>
					{:else if state.view.game?.state.rematchRequestedBy}
						<p class="text-sm text-gray-700 dark:text-gray-300">{$_('game.rematch.pending')}</p>
					{:else if state.view.game?.state.bestOfWinner}
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
			class={`grid gap-3 ${state.view.showHistoryPanel ? 'lg:grid-cols-[minmax(0,1fr)_18rem] lg:grid-rows-[auto_minmax(0,1fr)_auto] lg:items-start' : 'grid-cols-1'}`}
		>
			<div class={state.view.showHistoryPanel ? 'lg:col-start-1 lg:row-start-1' : ''}>
				<ReserveRow
					playerName={state.view.game.state.players.black?.name ?? $_('common.waiting')}
					playerScore={state.view.topPlayerScore}
					clockText={state.view.topClockText}
					clockUrgent={state.view.topClockUrgent}
					isActiveTurn={state.view.displayTurn === 'black'}
					reserveColor={state.view.topReserveColor}
					pieces={state.view.topReservePieces}
					isMine={state.view.topReserveIsMine}
					selectedPiece={state.view.selectedReservePiece}
					onClick={state.actions.onReserveClick}
					onDragStart={onReserveDragStartWithGhost}
					onDragCancel={state.actions.cancelDrag}
					onEnter={state.actions.onReserveHover}
					onLeave={state.actions.clearReserveHover}
					pieceTransitionName={state.view.reservePieceTransitionName}
				/>
			</div>
			{#if state.view.errorMessage}
				<p transition:slide class="my-2 text-sm text-red-600">{state.view.errorMessage}</p>
			{/if}
			<div class={state.view.showHistoryPanel ? 'lg:col-start-1 lg:row-start-2' : ''}>
				<BoardGrid
					board={state.view.displayBoard}
					targetHints={state.view.targetHints}
					targetHintTone={state.view.targetHintTone}
					isMyTurn={state.view.isMyTurn}
					viewerColor={state.view.game?.viewerColor ?? null}
					selectedBoardFrom={state.view.selectedBoardFrom}
					onCellEnter={state.actions.onBoardHover}
					onCellLeave={state.actions.clearBoardHover}
					onCellClick={state.actions.onCellClick}
					onBoardDragStart={onBoardDragStartWithGhost}
					onCellDrop={state.actions.onCellDrop}
					onDragCancel={state.actions.cancelDrag}
					pieceTransitionName={state.view.boardPieceTransitionName}
				/>
			</div>

			<div class={state.view.showHistoryPanel ? 'lg:col-start-1 lg:row-start-3' : ''}>
				<ReserveRow
					playerName={state.view.game.state.players.white?.name ?? $_('common.waiting')}
					playerScore={state.view.bottomPlayerScore}
					clockText={state.view.bottomClockText}
					clockUrgent={state.view.bottomClockUrgent}
					isActiveTurn={state.view.displayTurn === 'white'}
					reserveColor={state.view.bottomReserveColor}
					pieces={state.view.bottomReservePieces}
					isMine={state.view.bottomReserveIsMine}
					selectedPiece={state.view.selectedReservePiece}
					onClick={state.actions.onReserveClick}
					onDragStart={onReserveDragStartWithGhost}
					onDragCancel={state.actions.cancelDrag}
					onEnter={state.actions.onReserveHover}
					onLeave={state.actions.clearReserveHover}
					pieceTransitionName={state.view.reservePieceTransitionName}
				/>
			</div>

			{#if state.view.showHistoryPanel}
				<div class="lg:col-start-2 lg:row-span-3 lg:row-start-1">
					<MoveHistoryPanel
						entries={state.view.historyEntries}
						selectedMoveIndex={state.view.historySelectedMoveIndex}
						onSelectMove={state.actions.playHistoryMove}
						onJumpFirst={state.actions.jumpToHistoryFirst}
						onJumpPrevious={state.actions.jumpToHistoryPrevious}
						onJumpNext={state.actions.jumpToHistoryNext}
						onJumpLast={state.actions.jumpToHistoryLast}
					/>
				</div>
			{/if}
		</div>
	{/if}

	{#if state.view.isGameFinished}
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
		open={state.view.showRepetitionDrawModal}
		closable={true}
		title={state.view.repetitionDrawModalTitle}
		onClose={() => state.actions.setShowRepetitionDrawModal(false)}
	>
		<p class="mt-2 text-gray-700 dark:text-gray-300">{state.view.repetitionDrawModalSubtitle}</p>
		<p class="mt-2 text-gray-700 dark:text-gray-300">{$_('game.repetition.details')}</p>
	</GameDialog>

	{#if state.dragGhostPieceInfo && state.dragGhostPosition}
		<DragGhost
			pieceType={state.dragGhostPieceInfo.type}
			pieceColor={state.dragGhostPieceInfo.color}
			x={state.dragGhostPosition.x}
			y={state.dragGhostPosition.y}
		/>
	{/if}
</main>
