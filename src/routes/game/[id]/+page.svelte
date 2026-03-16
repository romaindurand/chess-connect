<script lang="ts">
	import { page } from '$app/state';
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Confetti } from 'svelte-confetti';
	import BoardGrid from '$lib/components/game/BoardGrid.svelte';
	import GameHeader from '$lib/components/game/GameHeader.svelte';
	import InvitationJoinCard from '$lib/components/game/InvitationJoinCard.svelte';
	import MoveHistoryPanel from '$lib/components/game/MoveHistoryPanel.svelte';
	import ReserveRow from '$lib/components/game/ReserveRow.svelte';
	import GameDialog from '$lib/components/GameDialog.svelte';
	import { buildPageTitle, OG_IMAGE_ALT, toAbsoluteUrl, TWITTER_CARD } from '$lib/seo';
	import { createGameState } from '$lib/state/game.svelte';
	import favicon from '$lib/assets/favicon.png';

	const props = $props<{ data: { gameId: string } }>();
	const state = createGameState(() => props.data.gameId);
	const pageTitle = $derived(`Partie ${props.data.gameId}`);
	const pageDescription =
		"Rejoignez une partie Chess Connect et jouez en ligne a ce melange d'echecs et de puissance 4 contre un ami ou l'IA.";
	const canonicalUrl = $derived(page.url.href);
	const ogImageUrl = $derived(toAbsoluteUrl(page.url.origin, favicon));

	onMount(async () => {
		await state.lifecycle.init();
	});

	onDestroy(() => {
		state.lifecycle.destroy();
	});
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
	<meta property="og:image:alt" content={OG_IMAGE_ALT} />
	<meta name="twitter:card" content={TWITTER_CARD} />
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
		onShowRules={() => state.actions.setShowRulesModal(true)}
		onCopyInvite={() => state.actions.copyInviteLink(window.location.href)}
	/>

	{#if state.view.loading}
		<p>Chargement...</p>
	{:else if !state.view.game}
		<p class="text-red-600">{state.view.errorMessage || 'Partie introuvable'}</p>
	{:else}
		{#if state.view.game.viewerRole === 'guest' && state.view.game.joinAllowed && !state.view.game.viewerIsInviter}
			<InvitationJoinCard
				inviterName={state.view.game.state.inviter.name}
				options={state.view.invitationOptions}
				onJoin={state.actions.onJoin}
			/>
		{/if}

		{#if state.view.isGameFinished}
			<section class="mb-3 rounded border border-black bg-white p-4 shadow-sm">
				<p class="text-lg font-semibold">{state.view.winnerModalTitle}</p>
				{#if state.view.winnerDetailsLine}
					<p class="mt-1 text-sm text-gray-700">{state.view.winnerDetailsLine}</p>
				{/if}
				<p class="mt-2 text-sm text-gray-700">{state.view.winnerModalSubtitle}</p>

				<div class="mt-4 flex flex-wrap items-center gap-2">
					{#if state.view.canRequestRematch}
						<button
							type="button"
							onclick={state.actions.onRequestRematch}
							disabled={state.view.isSubmittingRematch}
							class="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
						>
							{state.view.isSubmittingRematch ? 'Envoi...' : 'Proposer une revanche'}
						</button>
					{:else if state.view.canAcceptRematch}
						<button
							type="button"
							onclick={state.actions.onAcceptRematch}
							disabled={state.view.isSubmittingRematch}
							class="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
						>
							{state.view.isSubmittingRematch ? 'Demarrage...' : 'Accepter la revanche'}
						</button>
					{:else if state.view.game?.state.rematchRequestedBy}
						<p class="text-sm text-gray-700">Demande de revanche en attente...</p>
					{:else if state.view.game?.state.bestOfWinner}
						<p class="text-sm text-gray-700">Ce match est termine.</p>
					{/if}

					<button
						type="button"
						onclick={() => goto(resolve('/'))}
						class="rounded border px-4 py-2 text-sm font-medium"
					>
						Nouvelle partie
					</button>
				</div>
			</section>
		{/if}

		<div
			class={`grid gap-3 ${state.view.showHistoryPanel ? 'lg:grid-cols-[minmax(0,1fr)_18rem] lg:grid-rows-[auto_minmax(0,1fr)_auto] lg:items-start' : 'grid-cols-1'}`}
		>
			<div class={state.view.showHistoryPanel ? 'lg:col-start-1 lg:row-start-1' : ''}>
				<ReserveRow
					playerName={state.view.game.state.players.black?.name ?? 'En attente'}
					playerScore={state.view.topPlayerScore}
					isActiveTurn={state.view.displayTurn === 'black'}
					reserveColor={state.view.topReserveColor}
					pieces={state.view.topReservePieces}
					isMine={state.view.topReserveIsMine}
					isMyTurn={state.view.isMyTurn}
					selectedPiece={state.view.selectedReservePiece}
					onClick={state.actions.onReserveClick}
					onEnter={state.actions.onReserveHover}
					onLeave={state.actions.clearReserveHover}
					pieceTransitionName={state.view.reservePieceTransitionName}
				/>
			</div>

			<div class={state.view.showHistoryPanel ? 'lg:col-start-1 lg:row-start-2' : ''}>
				<BoardGrid
					board={state.view.displayBoard}
					targetHints={state.view.targetHints}
					targetHintTone={state.view.targetHintTone}
					selectedBoardFrom={state.view.selectedBoardFrom}
					onCellEnter={state.actions.onBoardHover}
					onCellLeave={state.actions.clearBoardHover}
					onCellClick={state.actions.onCellClick}
					pieceTransitionName={state.view.boardPieceTransitionName}
				/>
			</div>

			<div class={state.view.showHistoryPanel ? 'lg:col-start-1 lg:row-start-3' : ''}>
				<ReserveRow
					playerName={state.view.game.state.players.white?.name ?? 'En attente'}
					playerScore={state.view.bottomPlayerScore}
					isActiveTurn={state.view.displayTurn === 'white'}
					reserveColor={state.view.bottomReserveColor}
					pieces={state.view.bottomReservePieces}
					isMine={state.view.bottomReserveIsMine}
					isMyTurn={state.view.isMyTurn}
					selectedPiece={state.view.selectedReservePiece}
					onClick={state.actions.onReserveClick}
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
		open={state.view.showRulesModal}
		closable={true}
		title="Règles"
		onClose={() => state.actions.setShowRulesModal(false)}
	>
		<div class="space-y-2">
			{#each state.view.rulesLines as rule (rule)}
				<p>{rule}</p>
			{/each}
		</div>
	</GameDialog>

	<GameDialog
		open={state.view.showRepetitionDrawModal}
		closable={true}
		title={state.view.repetitionDrawModalTitle}
		onClose={() => state.actions.setShowRepetitionDrawModal(false)}
	>
		<p class="mt-2">{state.view.repetitionDrawModalSubtitle}</p>
		<p class="mt-2">Le score n'a pas changé, les joueurs échangent de couleur.</p>
	</GameDialog>

	{#if state.view.errorMessage}
		<p class="mt-3 text-sm text-red-600">{state.view.errorMessage}</p>
	{/if}
</main>
