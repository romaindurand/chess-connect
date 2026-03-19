<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import { _ } from 'svelte-i18n';

	import { createGameRemote } from '$lib/client/game-api';
	import { loadPlayerName, savePlayerName } from '$lib/client/player-name-storage';
	import { buildPageTitle, toAbsoluteUrl } from '$lib/seo';
	import type { HostColorPreference, OpponentType } from '$lib/types/game';
	import favicon from '$lib/assets/favicon.png';
	import AccountPanel from '$lib/components/AccountPanel.svelte';
	import {
		getAuthStateRemote,
		registerRemote,
		loginWithTokenRemote,
		type AuthState
	} from '$lib/client/auth-api';

	const pageTitle = $derived($_('home.pageTitle'));
	const pageDescription = $derived($_('home.pageDescription'));
	const canonicalUrl = $derived(page.url.href);
	const ogImageUrl = $derived(toAbsoluteUrl(page.url.origin, favicon));

	let name = $state('');
	let opponentType = $state<OpponentType>('human');
	let hostColor = $state<HostColorPreference>('random');
	let timeControlEnabled = $state(false);
	let timeLimitMinutesInput = $state(2);
	let timeLimitSecondsInput = $state(0);
	let incrementPerMoveSecondsInput = $state(10);
	let roundLimitEnabled = $state(false);
	let roundLimit = $state(5);
	let allowAiTrainingData = $state(true);
	let isSubmitting = $state(false);
	let errorMessage = $state('');
	let authState = $state<AuthState>({ authenticated: false });
	let recoveryKeyInput = $state('');
	let authError = $state('');
	let isAuthSubmitting = $state(false);
	let shownToken = $state<string | null>(null);
	let tokenCopied = $state(false);
	let showLoginForm = $state(false);
	let nameInput: HTMLInputElement | null = $state(null);
	let recoveryKeyField: HTMLInputElement | null = $state(null);

	onMount(async () => {
		name = loadPlayerName();
		authState = await getAuthStateRemote();
		if (authState.authenticated && authState.username) {
			name = authState.username;
		}
	});

	async function onCreateGame(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		errorMessage = '';

		const trimmed = name.trim();
		if (trimmed.length < 2) {
			errorMessage = $_('errors.nameLength');
			return;
		}

		let timeLimitSeconds: number | undefined;
		let incrementPerMoveSeconds: number | undefined;
		if (timeControlEnabled) {
			if (
				!Number.isInteger(timeLimitMinutesInput) ||
				timeLimitMinutesInput < 0 ||
				!Number.isInteger(timeLimitSecondsInput) ||
				timeLimitSecondsInput < 0
			) {
				errorMessage = $_('errors.timeLimitRange');
				return;
			}
			if (
				!Number.isInteger(incrementPerMoveSecondsInput) ||
				incrementPerMoveSecondsInput < 0 ||
				incrementPerMoveSecondsInput > 60
			) {
				errorMessage = $_('errors.incrementPerMoveRange');
				return;
			}
			timeLimitSeconds = timeLimitMinutesInput * 60 + timeLimitSecondsInput;
			if (timeLimitSeconds < 1 || timeLimitSeconds > 1800) {
				errorMessage = $_('errors.timeLimitRange');
				return;
			}
			incrementPerMoveSeconds = incrementPerMoveSecondsInput;
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
				timeLimitSeconds,
				incrementPerMoveSeconds,
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

	function validateNameForSignup(): boolean {
		if (!name.trim()) {
			authError = '';
			nameInput?.focus();
			nameInput?.reportValidity();
			return false;
		}

		const trimmed = name.trim();
		if (trimmed.length < 2) {
			authError = $_('errors.nameLength');
			nameInput?.focus();
			return false;
		}

		return true;
	}

	async function handleRegister() {
		if (!validateNameForSignup()) {
			return;
		}

		const trimmed = name.trim();
		showLoginForm = false;
		authError = '';
		isAuthSubmitting = true;
		try {
			const result = await registerRemote(trimmed);
			shownToken = result.rawToken;
			tokenCopied = false;
			authState = await getAuthStateRemote();
			if (authState.authenticated && authState.username) {
				name = authState.username;
			}
		} catch (e) {
			authError = e instanceof Error ? e.message : $_('errors.unexpected');
		} finally {
			isAuthSubmitting = false;
		}
	}

	async function handleLoginToken() {
		shownToken = null;
		if (!recoveryKeyInput.trim().startsWith('ccrec_')) {
			authError = $_('errors.invalidKeyFormat');
			recoveryKeyField?.focus();
			return;
		}
		authError = '';
		isAuthSubmitting = true;
		try {
			await loginWithTokenRemote(recoveryKeyInput.trim());
			authState = await getAuthStateRemote();
			if (authState.authenticated && authState.username) {
				name = authState.username;
			}
			recoveryKeyInput = '';
			shownToken = null;
		} catch (e) {
			authError = e instanceof Error ? e.message : $_('errors.unexpected');
		} finally {
			isAuthSubmitting = false;
		}
	}

	async function revealLoginForm() {
		showLoginForm = true;
		authError = '';
		await tick();
		recoveryKeyField?.focus();
	}

	async function copyShownToken() {
		if (!shownToken) return;
		await navigator.clipboard.writeText(shownToken);
		tokenCopied = true;
		setTimeout(() => (tokenCopied = false), 2000);
	}

	function handleAuthLogout() {
		authState = { authenticated: false };
		shownToken = null;
		name = loadPlayerName();
	}

	function dismissShownToken() {
		shownToken = null;
		tokenCopied = false;
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

	{#if shownToken}
		<div class="mb-6 space-y-3 rounded-md border border-green-300 bg-green-50 p-4">
			<p class="text-sm font-medium text-green-800">{$_('auth.recoveryKeyHint')}</p>
			<div class="flex gap-2">
				<input
					class="grow rounded border border-green-400 bg-white px-2 py-1 font-mono text-xs"
					type="text"
					readonly
					value={shownToken}
				/>
				<button
					type="button"
					class="rounded bg-green-700 px-2 py-1 text-xs text-white"
					onclick={copyShownToken}
				>
					{tokenCopied ? $_('auth.keyCopied') : $_('auth.copyKey')}
				</button>
			</div>

			{#if authState.authenticated && authState.username}
				<p class="text-xs text-green-800">
					{$_('auth.loggedInAs', { values: { username: authState.username } })}
				</p>
			{/if}

			<div class="flex justify-end">
				<button
					type="button"
					class="rounded border border-green-700 px-3 py-1 text-xs text-green-800"
					onclick={dismissShownToken}
				>
					{$_('common.close')}
				</button>
			</div>
		</div>
	{/if}

	{#if authState.authenticated && authState.username}
		<div class="mb-6">
			<AccountPanel username={authState.username} onLogout={handleAuthLogout} />
		</div>
	{:else}
		<div class="mb-6 space-y-3 rounded-md border border-gray-200 p-4">
			<div class="flex gap-2 text-sm">
				<button
					type="button"
					class="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
					onclick={handleRegister}
					disabled={isAuthSubmitting}
				>
					{$_('auth.createAccount')}
				</button>
				<button
					type="button"
					class="rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
					onclick={revealLoginForm}
					disabled={isAuthSubmitting}
				>
					{$_('auth.loginSubmit')}
				</button>
			</div>

			{#if showLoginForm}
				<label class="block space-y-1">
					<span class="text-sm font-medium">{$_('auth.recoveryKeyLabel')}</span>
					<div class="flex gap-2">
						<input
							bind:this={recoveryKeyField}
							class="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
							type="text"
							bind:value={recoveryKeyInput}
							placeholder={$_('auth.recoveryKeyPlaceholder')}
						/>
						<button
							type="button"
							class="rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
							onclick={handleLoginToken}
							disabled={isAuthSubmitting}
						>
							{isAuthSubmitting ? $_('common.loading') : $_('auth.validateLogin')}
						</button>
					</div>
				</label>
			{/if}

			{#if authError}
				<p class="text-sm text-red-600">{authError}</p>
			{/if}
		</div>
	{/if}

	<form class="space-y-4" onsubmit={onCreateGame}>
		<label class="block space-y-2">
			<span class="text-sm font-medium">{$_('home.nameLabel')}</span>
			<input
				bind:this={nameInput}
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
		</fieldset>

		<details class="rounded-md border border-gray-200 p-3">
			<summary class="cursor-pointer text-sm font-medium">{$_('home.advancedOptions')}</summary>
			<div class="mt-3 space-y-3">
				<div class="space-y-2">
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

				<label class="flex items-center gap-2 text-sm">
					<input type="checkbox" bind:checked={timeControlEnabled} />
					<span>{$_('home.enableTimeControl')}</span>
				</label>

				{#if timeControlEnabled}
					<div class="space-y-2">
						<span class="text-sm">{$_('home.timePerPlayer')}</span>
						<div class="grid grid-cols-2 gap-2">
							<label class="block space-y-1">
								<span class="text-xs text-gray-600">{$_('home.minutes')}</span>
								<input
									type="number"
									min="0"
									max="30"
									step="1"
									bind:value={timeLimitMinutesInput}
									class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
								/>
							</label>
							<label class="block space-y-1">
								<span class="text-xs text-gray-600">{$_('home.seconds')}</span>
								<input
									type="number"
									min="0"
									max="59"
									step="1"
									bind:value={timeLimitSecondsInput}
									class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
								/>
							</label>
						</div>
						<label class="block space-y-1">
							<span class="text-xs text-gray-600">{$_('home.incrementPerMove')}</span>
							<input
								type="number"
								min="0"
								max="60"
								step="1"
								bind:value={incrementPerMoveSecondsInput}
								class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
							/>
						</label>
					</div>
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
