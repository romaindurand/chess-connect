<script lang="ts">
	interface Props {
		gameId: string;
		roleText: string;
		turnLineText: string;
		isViewerTurnNow: boolean;
		copying: boolean;
		onShowRules: () => void;
		onCopyInvite: () => void;
	}

	let {
		gameId,
		roleText,
		turnLineText,
		isViewerTurnNow,
		copying,
		onShowRules,
		onCopyInvite
	}: Props = $props();
</script>

<header class="mb-4 flex items-center justify-between gap-3">
	<div>
		<h1 class="text-2xl font-semibold">Partie {gameId}</h1>
		<p class="text-sm text-gray-600">{roleText}</p>
		{#if turnLineText}
			<p class={`text-sm ${isViewerTurnNow ? 'font-bold text-gray-900' : 'text-gray-700'} h-5`}>
				{turnLineText}
			</p>
		{/if}
	</div>
	<div class="flex items-center gap-2">
		<button class="rounded border px-3 py-2 text-sm" type="button" onclick={onShowRules}
			>Règles</button
		>
		<button class="rounded border px-3 py-2 text-sm" type="button" onclick={onCopyInvite}>
			{copying ? 'Lien copié' : 'Copier le lien'}
		</button>
	</div>
</header>
