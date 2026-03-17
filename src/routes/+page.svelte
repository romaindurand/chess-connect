<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';

	import { createGameRemote } from '$lib/client/game-api';
	import { loadPlayerName, savePlayerName } from '$lib/client/player-name-storage';
	import { buildPageTitle, toAbsoluteUrl } from '$lib/seo';
	import type { HostColorPreference, OpponentType } from '$lib/types/game';
	import favicon from '$lib/assets/favicon.png';

	const pageTitle = $derived($_('home.pageTitle'));
	const pageDescription = $derived($_('home.pageDescription'));
	const canonicalUrl = $derived(page.url.href);
	const ogImageUrl = $derived(toAbsoluteUrl(page.url.origin, favicon));

	let name = $state('');
	let opponentType = $state<OpponentType>('human');
	let hostColor = $state<HostColorPreference>('random');
	let timeControlEnabled = $state(false);
	let timeLimitMinutes = $state(5);
	let roundLimitEnabled = $state(false);
	let roundLimit = $state(5);
	let allowAiTrainingData = $state(true);
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
			errorMessage = $_('errors.nameLength');
			return;
		}
		if (
			timeControlEnabled &&
			(!Number.isInteger(timeLimitMinutes) || timeLimitMinutes < 1 || timeLimitMinutes > 30)
		) {
			errorMessage = $_('errors.timeLimitRange');
			return;
		}
		if (
			roundLimitEnabled &&
			(!Number.isInteger(roundLimit) || roundLimit <= 0 || roundLimit % 2 === 0)
		) {
			errorMessage = $_('errors.roundLimitOddPositive');
			return;
		}

		isSubmitting = true;
		try {
			const result = await createGameRemote({
				name: trimmed,
				timeLimitMinutes: timeControlEnabled ? timeLimitMinutes : undefined,
				roundLimit: roundLimitEnabled ? roundLimit : undefined,
				allowAiTrainingData,
				opponentType,
				hostColor
			});
			savePlayerName(trimmed);
			await goto(resolve(`/game/${result.gameId}`));
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : $_('errors.createGameFailed');
		} finally {
			isSubmitting = false;
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

<main class="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-8">
	<h1 class="mb-4 text-3xl font-semibold">Chess Connect</h1>
	<p class="mb-8 text-sm text-gray-600">
		{$_('home.subtitle')}
	</p>

	<form class="space-y-4" onsubmit={onCreateGame}>
		<label class="block space-y-2">
			<span class="text-sm font-medium">{$_('home.nameLabel')}</span>
			<input
				class="w-full rounded-md border border-gray-300 px-3 py-2"
				type="text"
				name="name"
				bind:value={name}
				maxlength="24"
				placeholder={$_('home.namePlaceholder')}
				required
			/>
		</label>

		<fieldset class="rounded-md border border-gray-200 p-3">
			<legend class="px-1 text-sm font-medium">{$_('home.gameType')}</legend>
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
					<span>{$_('home.versusHuman')}</span>
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
					<span>{$_('home.versusAi')}</span>
				</label>
			</div>

			{#if opponentType === 'ai'}
				<div class="mt-3 space-y-2">
					<span class="text-sm font-medium">{$_('home.yourColor')}</span>
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
							<span>{$_('home.colorWhite')}</span>
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
							<span>{$_('home.colorBlack')}</span>
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
							<span>{$_('home.colorRandom')}</span>
						</label>
					</div>
				</div>
			{/if}
		</fieldset>

		<details class="rounded-md border border-gray-200 p-3">
			<summary class="cursor-pointer text-sm font-medium">{$_('home.advancedOptions')}</summary>
			<div class="mt-3 space-y-3">
				<label class="flex items-center gap-2 text-sm">
					<input type="checkbox" bind:checked={timeControlEnabled} />
					<span>{$_('home.enableTimeControl')}</span>
				</label>

				{#if timeControlEnabled}
					<label class="block space-y-2">
						<span class="text-sm">{$_('home.timePerPlayer')}</span>
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

				<label class="flex items-center gap-2 text-sm">
					<input type="checkbox" bind:checked={roundLimitEnabled} />
					<span>{$_('home.enableRoundLimit')}</span>
				</label>

				{#if roundLimitEnabled}
					<label class="block space-y-2">
						<span class="text-sm">{$_('home.roundLimit')}</span>
						<input
							type="number"
							min="1"
							step="2"
							bind:value={roundLimit}
							class="w-full rounded-md border border-gray-300 px-3 py-2"
						/>
					</label>
				{/if}

				<label class="flex items-center gap-2 text-sm">
					<input type="checkbox" bind:checked={allowAiTrainingData} />
					<span>{$_('home.allowAiTrainingData')}</span>
				</label>
			</div>
		</details>

		<button
			type="submit"
			disabled={isSubmitting}
			class="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
		>
			{#if isSubmitting}
				{$_('home.creating')}
			{:else if opponentType === 'ai'}
				{$_('home.playVsAi')}
			{:else}
				{$_('home.createGame')}
			{/if}
		</button>

		{#if errorMessage}
			<p class="text-sm text-red-600">{errorMessage}</p>
		{/if}
	</form>
</main>
