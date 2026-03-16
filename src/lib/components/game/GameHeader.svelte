<script lang="ts">
	import { History } from '@lucide/svelte';

	interface Props {
		gameId: string;
		turnLineText: string;
		isViewerTurnNow: boolean;
		copying: boolean;
		historyOpen: boolean;
		onToggleHistory: () => void;
		onShowRules: () => void;
		onCopyInvite: () => void;
	}

	let {
		gameId,
		turnLineText,
		isViewerTurnNow,
		copying,
		historyOpen,
		onToggleHistory,
		onShowRules,
		onCopyInvite
	}: Props = $props();
</script>

<header class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
	<div>
		<h1 class="text-2xl font-semibold">Partie {gameId}</h1>
		{#if turnLineText}
			<p class={`text-sm ${isViewerTurnNow ? 'font-bold text-gray-900' : 'text-gray-700'} h-5`}>
				{turnLineText}
			</p>
		{/if}
	</div>
	<div class="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
		<button class="rounded border px-3 py-2 text-sm" type="button" onclick={onToggleHistory}>
			<span class="inline-flex items-center gap-2">
				<History class="h-4 w-4" />
				{historyOpen ? 'Masquer historique' : 'Historique'}
			</span>
		</button>
		<button class="rounded border px-3 py-2 text-sm" type="button" onclick={onShowRules}
			>Règles</button
		>
		<button class="rounded border px-3 py-2 text-sm" type="button" onclick={onCopyInvite}>
			{copying ? 'Lien copié' : 'Copier le lien'}
		</button>
	</div>
</header>
