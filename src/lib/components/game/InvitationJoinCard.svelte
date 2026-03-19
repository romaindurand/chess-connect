<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { loadPlayerName, savePlayerName } from '$lib/client/player-name-storage';
	import { getAuthStateRemote } from '$lib/client/auth-api';

	interface Props {
		inviterName: string;
		options: string[];
		onJoin: (name: string) => Promise<boolean>;
	}

	let { inviterName, options, onJoin }: Props = $props();

	let name = $state('');
	let isAuthenticated = $state(false);

	onMount(async () => {
		const auth = await getAuthStateRemote();
		if (auth.authenticated && auth.username) {
			name = auth.username;
			isAuthenticated = true;
		} else {
			name = loadPlayerName();
		}
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
		{$_('game.invite.pending', { values: { name: inviterName } })}
	</p>
	<div class="w-full rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-700">
		<p class="font-medium">{$_('game.invite.options')}</p>
		<ul class="mt-1 list-inside list-disc space-y-1">
			{#each options as option (option)}
				<li>{option}</li>
			{/each}
		</ul>
	</div>
	<label class="grow space-y-2">
		<span class="text-sm font-medium">{$_('game.invite.nameLabel')}</span>
		<input
			class="w-full rounded border border-gray-300 px-3 py-2 {isAuthenticated
				? 'cursor-not-allowed bg-gray-100 text-gray-500'
				: ''}"
			type="text"
			bind:value={name}
			maxlength="24"
			readonly={isAuthenticated}
			required
		/>
	</label>
	<button class="rounded bg-black px-3 py-2 text-white" type="submit"
		>{$_('game.invite.accept')}</button
	>
</form>
