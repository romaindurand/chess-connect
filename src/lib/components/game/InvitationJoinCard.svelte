<script lang="ts">
	import { onMount } from 'svelte';
	import { loadPlayerName, savePlayerName } from '$lib/client/player-name-storage';

	interface Props {
		inviterName: string;
		options: string[];
		onJoin: (name: string) => Promise<boolean>;
	}

	let { inviterName, options, onJoin }: Props = $props();

	let name = $state('');

	onMount(() => {
		name = loadPlayerName();
	});

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		const trimmed = name.trim();
		const success = await onJoin(trimmed);
		if (success) {
			savePlayerName(trimmed);
			name = trimmed;
		}
	}
</script>

<form class="mb-4 flex flex-wrap items-end gap-3 rounded border p-3" onsubmit={submit}>
	<p class="w-full text-sm text-gray-700">
		Invitation en attente — {inviterName} vous invite à rejoindre la partie.
	</p>
	{#if options.length > 0}
		<div class="w-full rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-700">
			<p class="font-medium">Options de la partie</p>
			<ul class="mt-1 list-inside list-disc space-y-1">
				{#each options as option (option)}
					<li>{option}</li>
				{/each}
			</ul>
		</div>
	{/if}
	<label class="grow space-y-2">
		<span class="text-sm font-medium">Votre pseudo</span>
		<input
			class="w-full rounded border border-gray-300 px-3 py-2"
			type="text"
			bind:value={name}
			maxlength="24"
			required
		/>
	</label>
	<button class="rounded bg-black px-3 py-2 text-white" type="submit">Accepter l'invitation</button>
</form>
