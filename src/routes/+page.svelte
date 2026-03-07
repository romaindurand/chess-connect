<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	import { createGameRemote } from '$lib/client/game-api';

	let name = $state('');
	let timeControlEnabled = $state(false);
	let timeLimitMinutes = $state(5);
	let isSubmitting = $state(false);
	let errorMessage = $state('');

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
				timeLimitMinutes: timeControlEnabled ? timeLimitMinutes : undefined
			});
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
			{isSubmitting ? 'Création...' : 'Créer une nouvelle partie'}
		</button>

		{#if errorMessage}
			<p class="text-sm text-red-600">{errorMessage}</p>
		{/if}
	</form>
</main>
