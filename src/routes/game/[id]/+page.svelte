<script lang="ts">
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
	import { createGameState } from '$lib/state/game.svelte';

	const props = $props<{ data: { gameId: string } }>();
	const state = createGameState(() => props.data.gameId);

	onMount(async () => {
		await state.lifecycle.init();
	});

	onDestroy(() => {
		state.lifecycle.destroy();
	});
</script>

<main class="mx-auto max-w-3xl px-4 py-6">
	<GameHeader
		gameId={state.view.gameId}
		roleText={state.view.roleText}
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

		<div class="space-y-3">
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

			<div
				class={`grid gap-3 ${state.view.showHistoryPanel ? 'lg:grid-cols-[minmax(0,1fr)_18rem]' : 'grid-cols-1'}`}
			>
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

				{#if state.view.showHistoryPanel}
					<MoveHistoryPanel
						entries={state.view.historyEntries}
						selectedMoveIndex={state.view.historySelectedMoveIndex}
						onSelectMove={state.actions.playHistoryMove}
						onJumpFirst={state.actions.jumpToHistoryFirst}
						onJumpPrevious={state.actions.jumpToHistoryPrevious}
						onJumpNext={state.actions.jumpToHistoryNext}
						onJumpLast={state.actions.jumpToHistoryLast}
					/>
				{/if}
			</div>

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

	<GameDialog open={state.view.isGameFinished} closable={false} title={state.view.winnerModalTitle}>
		{#if state.view.winnerDetailsLine}
			<p class="mt-2">{state.view.winnerDetailsLine}</p>
		{/if}
		<p class="mt-2">{state.view.winnerModalSubtitle}</p>

		{#if state.view.canRequestRematch}
			<button
				type="button"
				onclick={state.actions.onRequestRematch}
				disabled={state.view.isSubmittingRematch}
				class="mt-4 rounded bg-black px-4 py-2 text-white disabled:opacity-50"
			>
				{state.view.isSubmittingRematch ? 'Envoi...' : 'Proposer une revanche'}
			</button>
		{:else if state.view.canAcceptRematch}
			<button
				type="button"
				onclick={state.actions.onAcceptRematch}
				disabled={state.view.isSubmittingRematch}
				class="mt-4 rounded bg-black px-4 py-2 text-white disabled:opacity-50"
			>
				{state.view.isSubmittingRematch ? 'Démarrage...' : 'Accepter la revanche'}
			</button>
		{:else if state.view.game?.state.rematchRequestedBy}
			<p class="mt-4">Demande de revanche en attente...</p>
		{:else if state.view.game?.state.bestOfWinner}
			<p class="mt-4">Ce match est terminé.</p>
		{/if}

		<button
			type="button"
			onclick={() => goto(resolve('/'))}
			class="mt-4 rounded border px-4 py-2 text-sm font-medium"
		>
			Nouvelle partie
		</button>
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
