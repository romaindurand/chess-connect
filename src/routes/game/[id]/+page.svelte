<script lang="ts">
	import { page } from '$app/state';
	import { onDestroy, onMount } from 'svelte';
	import { _, locale } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Confetti } from 'svelte-confetti';
	import BoardGrid from '$lib/components/game/BoardGrid.svelte';
	import GameHeader from '$lib/components/game/GameHeader.svelte';
	import InvitationJoinCard from '$lib/components/game/InvitationJoinCard.svelte';
	import MoveHistoryPanel from '$lib/components/game/MoveHistoryPanel.svelte';
	import ReserveRow from '$lib/components/game/ReserveRow.svelte';
	import GameDialog from '$lib/components/GameDialog.svelte';
	import RulesEn from '$lib/i18n/en/rules.md';
	import RulesFr from '$lib/i18n/fr/rules.md';
	import { isSupportedLanguage, setLanguage, type SupportedLanguage } from '$lib/i18n';
	import { buildPageTitle, toAbsoluteUrl } from '$lib/seo';
	import { createGameState } from '$lib/state/game.svelte';
	import favicon from '$lib/assets/favicon.png';

	const props = $props<{ data: { gameId: string } }>();
	const state = createGameState(() => props.data.gameId);
	const pageTitle = $derived($_('game.pageTitle', { values: { id: props.data.gameId } }));
	const pageDescription = $derived($_('game.pageDescription'));
	const canonicalUrl = $derived(page.url.href);
	const ogImageUrl = $derived(toAbsoluteUrl(page.url.origin, favicon));
	const currentLanguage = $derived(($locale === 'fr' ? 'fr' : 'en') as SupportedLanguage);
	const RulesContent = $derived($locale === 'fr' ? RulesFr : RulesEn);
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

	function onChangeLanguage(language: SupportedLanguage): void {
		if (!isSupportedLanguage(language)) {
			return;
		}
		setLanguage(language);
	}

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
		{currentLanguage}
		{onChangeLanguage}
		onShowRules={() => state.actions.setShowRulesModal(true)}
		onCopyInvite={() => state.actions.copyInviteLink(window.location.href)}
	/>

	{#if state.view.loading}
		<p>{$_('common.loading')}</p>
	{:else if !state.view.game}
		<p class="text-red-600">{state.view.errorMessage || $_('common.gameNotFound')}</p>
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
				{#if rankedDeltaText}
					<p class="mt-1 text-sm font-semibold text-gray-900">
						{$_('game.winner.rankedDelta', { values: { delta: rankedDeltaText } })}
					</p>
				{/if}

				<div class="mt-4 flex flex-wrap items-center gap-2">
					{#if state.view.canRequestRematch}
						<button
							type="button"
							onclick={state.actions.onRequestRematch}
							disabled={state.view.isSubmittingRematch}
							class="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
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
							class="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
						>
							{state.view.isSubmittingRematch
								? $_('game.rematch.starting')
								: $_('game.rematch.accept')}
						</button>
					{:else if state.view.game?.state.rematchRequestedBy}
						<p class="text-sm text-gray-700">{$_('game.rematch.pending')}</p>
					{:else if state.view.game?.state.bestOfWinner}
						<p class="text-sm text-gray-700">{$_('game.rematch.finished')}</p>
					{/if}

					<button
						type="button"
						onclick={() => goto(resolve('/'))}
						class="rounded border px-4 py-2 text-sm font-medium"
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
					playerName={state.view.game.state.players.white?.name ?? $_('common.waiting')}
					playerScore={state.view.bottomPlayerScore}
					clockText={state.view.bottomClockText}
					clockUrgent={state.view.bottomClockUrgent}
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
		title={$_('game.rules.title')}
		onClose={() => state.actions.setShowRulesModal(false)}
	>
		<div
			class="text-gray-700 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:leading-relaxed [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6"
		>
			<RulesContent />
		</div>
	</GameDialog>

	<GameDialog
		open={state.view.showRepetitionDrawModal}
		closable={true}
		title={state.view.repetitionDrawModalTitle}
		onClose={() => state.actions.setShowRepetitionDrawModal(false)}
	>
		<p class="mt-2">{state.view.repetitionDrawModalSubtitle}</p>
		<p class="mt-2">{$_('game.repetition.details')}</p>
	</GameDialog>

	{#if state.view.errorMessage}
		<p class="mt-3 text-sm text-red-600">{state.view.errorMessage}</p>
	{/if}
</main>
