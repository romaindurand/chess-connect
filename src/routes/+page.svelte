<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import { _ } from 'svelte-i18n';

	import {
		claimRankedGameSessionRemote,
		createGameRemote,
		decideRankedProposalRemote,
		joinRankedQueueRemote,
		leaveRankedQueueRemote,
		openRankedQueueEventStream
	} from '$lib/client/game-api';
	import { hasAcceptedCurrentProposal } from '$lib/client/ranked-queue';
	import { loadPlayerName, savePlayerName } from '$lib/client/player-name-storage';
	import { buildPageTitle, toAbsoluteUrl } from '$lib/seo';
	import type { HostColorPreference, OpponentType, RankedQueueStatus } from '$lib/types/game';
	import favicon from '$lib/assets/favicon.png';
	import AccountPanel from '$lib/components/AccountPanel.svelte';
	import {
		getAuthStateRemote,
		registerRemote,
		loginWithTokenRemote,
		type AuthState
	} from '$lib/client/auth-api';
	import { slide } from 'svelte/transition';

	const pageTitle = $derived($_('home.pageTitle'));
	const pageDescription = $derived($_('home.pageDescription'));
	const canonicalUrl = $derived(page.url.href);
	const ogImageUrl = $derived(toAbsoluteUrl(page.url.origin, favicon));
	type HomeMode = OpponentType | 'ranked';

	let name = $state('');
	let opponentType = $state<OpponentType>('human');
	let selectedMode = $state<HomeMode>('human');
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
	let showLoginForm = $state(false);
	let advancedOptionsOpen = $state(false);
	let advancedOptionsMounted = $state(false);
	let advancedOptionsCloseTimer: ReturnType<typeof setTimeout> | null = null;
	let queueStatus = $state<RankedQueueStatus | null>(null);
	let rankedModalOpen = $state(false);
	let rankedBusy = $state(false);
	let rankedError = $state('');
	let locallyAcceptedProposalId = $state<string | null>(null);
	let rankedSource: EventSource | null = null;
	let nameInput: HTMLInputElement | null = $state(null);
	let recoveryKeyField: HTMLInputElement | null = $state(null);
	const hasAcceptedProposal = $derived(
		hasAcceptedCurrentProposal({
			status: queueStatus,
			username: authState.username,
			locallyAcceptedProposalId
		})
	);

	onMount(() => {
		name = loadPlayerName();
		void (async () => {
			authState = await getAuthStateRemote();
			if (authState.authenticated && authState.username) {
				name = authState.username;
			}
		})();
		return () => {
			if (rankedSource) {
				rankedSource.close();
				rankedSource = null;
			}
		};
	});

	$effect(() => {
		if (!authState.authenticated && selectedMode === 'ranked') {
			selectedMode = 'human';
			opponentType = 'human';
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

		if (selectedMode === 'ranked') {
			await startRankedSearch(trimmed);
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
			opponentType = selectedMode === 'ai' ? 'ai' : 'human';
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

	function connectRankedQueueEvents(): void {
		if (rankedSource) {
			rankedSource.close();
		}
		rankedSource = openRankedQueueEventStream(async (event) => {
			if (event.type !== 'queue') {
				return;
			}
			queueStatus = event.status;
			if (!event.status.proposal || event.status.proposal.id !== locallyAcceptedProposalId) {
				locallyAcceptedProposalId = null;
			}
			const proposal = event.status.proposal;
			if (proposal?.gameId) {
				try {
					await claimRankedGameSessionRemote(proposal.id);
				} catch (error) {
					rankedError = error instanceof Error ? error.message : $_('errors.unexpected');
					return;
				}
				rankedModalOpen = false;
				if (rankedSource) {
					rankedSource.close();
					rankedSource = null;
				}
				await goto(resolve(`/game/${proposal.gameId}`));
			}
		});
	}

	async function startRankedSearch(trimmedName: string): Promise<void> {
		if (!authState.authenticated) {
			errorMessage = $_('errors.notAuthenticated');
			return;
		}
		rankedBusy = true;
		rankedError = '';
		try {
			const status = await joinRankedQueueRemote();
			savePlayerName(trimmedName);
			queueStatus = status;
			rankedModalOpen = true;
			connectRankedQueueEvents();
		} catch (error) {
			rankedError = error instanceof Error ? error.message : $_('errors.unexpected');
		} finally {
			rankedBusy = false;
		}
	}

	async function leaveRankedSearch(): Promise<void> {
		rankedBusy = true;
		try {
			await leaveRankedQueueRemote();
			queueStatus = null;
			locallyAcceptedProposalId = null;
			rankedModalOpen = false;
			rankedError = '';
			if (rankedSource) {
				rankedSource.close();
				rankedSource = null;
			}
		} catch (error) {
			rankedError = error instanceof Error ? error.message : $_('errors.unexpected');
		} finally {
			rankedBusy = false;
		}
	}

	async function decideRankedProposal(accept: boolean): Promise<void> {
		if (!queueStatus?.proposal) {
			return;
		}
		rankedBusy = true;
		rankedError = '';
		const proposalId = queueStatus.proposal.id;
		const previousAcceptedProposalId = locallyAcceptedProposalId;
		if (accept) {
			locallyAcceptedProposalId = proposalId;
		}
		try {
			const result = await decideRankedProposalRemote(proposalId, accept);
			if (result.gameId) {
				locallyAcceptedProposalId = null;
				rankedModalOpen = false;
				if (rankedSource) {
					rankedSource.close();
					rankedSource = null;
				}
				await goto(resolve(`/game/${result.gameId}`));
				return;
			}
			if (!accept) {
				locallyAcceptedProposalId = null;
				rankedModalOpen = false;
			}
		} catch (error) {
			locallyAcceptedProposalId = previousAcceptedProposalId;
			rankedError = error instanceof Error ? error.message : $_('errors.unexpected');
		} finally {
			rankedBusy = false;
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

	function handleAuthLogout() {
		authState = { authenticated: false };
		shownToken = null;
		name = loadPlayerName();
		queueStatus = null;
		locallyAcceptedProposalId = null;
		rankedModalOpen = false;
		if (rankedSource) {
			rankedSource.close();
			rankedSource = null;
		}
	}

	function toggleAdvancedOptions(event: MouseEvent) {
		event.preventDefault();

		if (advancedOptionsCloseTimer) {
			clearTimeout(advancedOptionsCloseTimer);
			advancedOptionsCloseTimer = null;
		}

		if (advancedOptionsOpen) {
			advancedOptionsOpen = false;
			advancedOptionsCloseTimer = setTimeout(() => {
				advancedOptionsMounted = false;
				advancedOptionsCloseTimer = null;
			}, 300);
			return;
		}

		advancedOptionsMounted = true;
		setTimeout(() => {
			advancedOptionsOpen = true;
		}, 0);
	}

	$effect(() => {
		if (selectedMode === 'ranked' && advancedOptionsCloseTimer) {
			clearTimeout(advancedOptionsCloseTimer);
			advancedOptionsCloseTimer = null;
		}
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

<main class="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-8">
	<h1 class="mb-4 text-3xl font-semibold">Chess Connect</h1>
	{#if authState.authenticated && authState.username}
		<div class="mb-6">
			<AccountPanel
				username={authState.username}
				onLogout={handleAuthLogout}
				initialToken={shownToken}
			/>
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
		{#if !authState.authenticated}
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
		{/if}

		<fieldset class="rounded-md border border-gray-200 p-3">
			<legend class="px-1 text-sm font-medium">{$_('home.gameType')}</legend>
			<div
				class={`mt-3 grid gap-2 ${authState.authenticated ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}
			>
				<label
					class={`rounded-md border px-3 py-2 text-sm ${selectedMode === 'human' ? 'border-black bg-black text-white' : 'border-gray-300'}`}
				>
					<input
						class="sr-only"
						type="radio"
						name="homeMode"
						value="human"
						bind:group={selectedMode}
					/>
					<span>{$_('home.versusHuman')}</span>
				</label>
				<label
					class={`rounded-md border px-3 py-2 text-sm ${selectedMode === 'ai' ? 'border-black bg-black text-white' : 'border-gray-300'}`}
				>
					<input
						class="sr-only"
						type="radio"
						name="homeMode"
						value="ai"
						bind:group={selectedMode}
					/>
					<span>{$_('home.versusAi')}</span>
				</label>
				{#if authState.authenticated}
					<label
						class={`rounded-md border px-3 py-2 text-sm ${selectedMode === 'ranked' ? 'border-black bg-black text-white' : 'border-gray-300'}`}
					>
						<input
							class="sr-only"
							type="radio"
							name="homeMode"
							value="ranked"
							bind:group={selectedMode}
						/>
						<span>{$_('home.ranked')}</span>
					</label>
				{/if}
			</div>
			<p class="mt-3 text-sm text-gray-600">
				{#if selectedMode === 'human'}
					{$_('home.modeDescriptionHuman')}
				{:else if selectedMode === 'ai'}
					{$_('home.modeDescriptionAi')}
				{:else}
					{$_('home.modeDescriptionRanked')}
				{/if}
			</p>
		</fieldset>

		{#if selectedMode !== 'ranked'}
			<details
				transition:slide
				class="rounded-md border border-gray-200 p-3"
				open={advancedOptionsMounted}
			>
				<summary
					class="cursor-pointer text-sm font-medium"
					onclick={toggleAdvancedOptions}
					aria-expanded={advancedOptionsOpen}
				>
					{$_('home.advancedOptions')}
				</summary>
				<div
					class={`grid transition-all duration-300 ease-out ${
						advancedOptionsOpen
							? 'mt-3 grid-rows-[1fr] opacity-100'
							: 'mt-0 grid-rows-[0fr] opacity-0'
					}`}
				>
					<div class="overflow-hidden">
						<div class="space-y-3 pb-1">
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
					</div>
				</div>
			</details>
		{/if}

		{#if authState.authenticated}
			<p class="text-sm text-gray-600">
				<a class="underline" href={resolve('/ladder')}>{$_('home.openLadder')}</a>
			</p>
		{/if}

		<button
			type="submit"
			disabled={isSubmitting || rankedBusy}
			class="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
		>
			{#if isSubmitting || rankedBusy}
				{$_('home.creating')}
			{:else if selectedMode === 'ranked'}
				{$_('home.searchGame')}
			{:else if selectedMode === 'ai'}
				{$_('home.playVsAi')}
			{:else}
				{$_('home.createGame')}
			{/if}
		</button>

		{#if errorMessage}
			<p class="text-sm text-red-600">{errorMessage}</p>
		{/if}
		{#if rankedError}
			<p class="text-sm text-red-600">{rankedError}</p>
		{/if}
	</form>

	{#if rankedModalOpen}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div class="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
				<h2 class="text-lg font-semibold">{$_('home.rankedSearchingTitle')}</h2>
				<p class="mt-2 text-sm text-gray-700">
					{$_('home.rankedSearchingTimer', { values: { seconds: queueStatus?.waitSeconds ?? 0 } })}
				</p>
				<p class="mt-1 text-sm text-gray-700">
					{$_('home.rankedSearchRange', { values: { range: queueStatus?.searchRange ?? 0 } })}
				</p>

				{#if queueStatus?.proposal && !queueStatus.proposal.gameId}
					<div class="mt-4 rounded-md border border-gray-200 p-3">
						<p class="text-sm font-medium">{$_('home.matchFound')}</p>
						{#each queueStatus.proposal.participants as participant (participant.userId)}
							<p class="mt-1 text-sm text-gray-700">
								{participant.username} ({participant.rating})
							</p>
						{/each}
						{#if !hasAcceptedProposal}
							<div class="mt-3 flex gap-2">
								<button
									type="button"
									class="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
									onclick={() => decideRankedProposal(true)}
									disabled={rankedBusy}
								>
									{$_('home.acceptMatch')}
								</button>
								<button
									type="button"
									class="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
									onclick={() => decideRankedProposal(false)}
									disabled={rankedBusy}
								>
									{$_('home.rejectMatch')}
								</button>
							</div>
						{/if}
					</div>
				{/if}

				<div class="mt-5 flex justify-end">
					<button
						type="button"
						class="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
						onclick={leaveRankedSearch}
						disabled={rankedBusy}
					>
						{$_('home.leaveQueue')}
					</button>
				</div>
			</div>
		</div>
	{/if}
</main>
