<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';

	import { createGameRemote } from '$lib/client/game-api';
	import { loadPlayerName, savePlayerName } from '$lib/client/player-name-storage';
	import type { HostColorPreference, OpponentType } from '$lib/types/game';

	let name = $state('');
	let opponentType = $state<OpponentType>('human');
	let hostColor = $state<HostColorPreference>('random');
	let timeControlEnabled = $state(false);
	let timeLimitMinutes = $state(5);
	let isSubmitting = $state(false);
	let errorMessage = $state('');

	onMount(() => {
		name = loadPlayerName();
	});

	async function onCreateGame(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		errorMessage = '';

		const trimmed = name.trim();
		if (trimmed.length < 2) {
			errorMessage = 'Le pseudo doit contenir au moins 2 caractères.';
			return;
		}
		if (
			timeControlEnabled &&
			(!Number.isInteger(timeLimitMinutes) || timeLimitMinutes < 1 || timeLimitMinutes > 30)
		) {
			errorMessage = 'La limite de temps doit être un entier entre 1 et 30 minutes.';
			return;
		}

		isSubmitting = true;
		try {
			const result = await createGameRemote({
				name: trimmed,
				timeLimitMinutes: timeControlEnabled ? timeLimitMinutes : undefined,
				opponentType,
				hostColor
			});
			savePlayerName(trimmed);
			await goto(resolve(`/game/${result.gameId}`));
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Impossible de créer la partie';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<main class="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-8">
	<h1 class="mb-4 text-3xl font-semibold">Chess Connect</h1>
	<p class="mb-8 text-sm text-gray-600">
		Créez une partie, partagez le lien, puis jouez en direct.
	</p>

	<form class="space-y-4" onsubmit={onCreateGame}>
		<label class="block space-y-2">
			<span class="text-sm font-medium">Votre pseudo</span>
			<input
				class="w-full rounded-md border border-gray-300 px-3 py-2"
				type="text"
				name="name"
				bind:value={name}
				maxlength="24"
				placeholder="Ex: Romain"
				required
			/>
		</label>

		<fieldset class="rounded-md border border-gray-200 p-3">
			<legend class="px-1 text-sm font-medium">Type de partie</legend>
			<div class="mt-3 grid gap-2 sm:grid-cols-2">
				<label
					class={`rounded-md border px-3 py-2 text-sm ${opponentType === 'human' ? 'border-black bg-black text-white' : 'border-gray-300'}`}
				>
					<input
						class="sr-only"
						type="radio"
						name="opponentType"
						value="human"
						bind:group={opponentType}
					/>
					<span>Contre un joueur</span>
				</label>
				<label
					class={`rounded-md border px-3 py-2 text-sm ${opponentType === 'ai' ? 'border-black bg-black text-white' : 'border-gray-300'}`}
				>
					<input
						class="sr-only"
						type="radio"
						name="opponentType"
						value="ai"
						bind:group={opponentType}
					/>
					<span>Contre l'IA</span>
				</label>
			</div>

			{#if opponentType === 'ai'}
				<div class="mt-3 space-y-2">
					<span class="text-sm font-medium">Votre couleur</span>
					<div class="grid gap-2 sm:grid-cols-3">
						<label
							class={`rounded-md border px-3 py-2 text-sm ${hostColor === 'white' ? 'border-black bg-black text-white' : 'border-gray-300'}`}
						>
							<input
								class="sr-only"
								type="radio"
								name="hostColor"
								value="white"
								bind:group={hostColor}
							/>
							<span>Blanc</span>
						</label>
						<label
							class={`rounded-md border px-3 py-2 text-sm ${hostColor === 'black' ? 'border-black bg-black text-white' : 'border-gray-300'}`}
						>
							<input
								class="sr-only"
								type="radio"
								name="hostColor"
								value="black"
								bind:group={hostColor}
							/>
							<span>Noir</span>
						</label>
						<label
							class={`rounded-md border px-3 py-2 text-sm ${hostColor === 'random' ? 'border-black bg-black text-white' : 'border-gray-300'}`}
						>
							<input
								class="sr-only"
								type="radio"
								name="hostColor"
								value="random"
								bind:group={hostColor}
							/>
							<span>Aléatoire</span>
						</label>
					</div>
				</div>
			{/if}
		</fieldset>

		<details class="rounded-md border border-gray-200 p-3">
			<summary class="cursor-pointer text-sm font-medium">Options avancées</summary>
			<div class="mt-3 space-y-3">
				<label class="flex items-center gap-2 text-sm">
					<input type="checkbox" bind:checked={timeControlEnabled} />
					<span>Activer une limite de temps</span>
				</label>

				{#if timeControlEnabled}
					<label class="block space-y-2">
						<span class="text-sm">Durée par joueur (minutes)</span>
						<input
							type="number"
							min="1"
							max="30"
							step="1"
							bind:value={timeLimitMinutes}
							class="w-full rounded-md border border-gray-300 px-3 py-2"
						/>
					</label>
				{/if}
			</div>
		</details>

		<button
			type="submit"
			disabled={isSubmitting}
			class="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
		>
			{#if isSubmitting}
				Création...
			{:else if opponentType === 'ai'}
				Jouer contre l'IA
			{:else}
				Créer une nouvelle partie
			{/if}
		</button>

		{#if errorMessage}
			<p class="text-sm text-red-600">{errorMessage}</p>
		{/if}
	</form>
</main>
