<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { rotateTokenRemote, logoutRemote } from '$lib/client/auth-api';
	import { Eye, EyeOff } from '@lucide/svelte';

	interface Props {
		username: string;
		onLogout: () => void;
		initialToken?: string | null;
	}

	let { username, onLogout, initialToken = null }: Props = $props();

	let copied = $state(false);
	let newToken = $state<string | null>(null);
	let rotating = $state(false);
	let rotateError = $state('');
	let showTokenClear = $state(false);
	let appliedInitialToken = $state<string | null>(null);

	$effect(() => {
		if (initialToken && initialToken !== appliedInitialToken) {
			newToken = initialToken;
			copied = false;
			showTokenClear = false;
			appliedInitialToken = initialToken;
		}
	});

	async function copyToken() {
		if (!newToken) return;
		await navigator.clipboard.writeText(newToken);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	async function handleRotate() {
		if (!confirm($_('auth.rotateKeyConfirm'))) return;
		rotating = true;
		rotateError = '';
		try {
			const result = await rotateTokenRemote();
			newToken = result.rawToken;
			copied = false;
			showTokenClear = false;
		} catch (e) {
			rotateError = e instanceof Error ? e.message : '';
		} finally {
			rotating = false;
		}
	}

	async function handleLogout() {
		await logoutRemote();
		onLogout();
	}
</script>

<div
	class="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900"
>
	<p class="text-sm font-medium dark:text-gray-200">
		{$_('auth.loggedInAs', { values: { username } })}
	</p>

	{#if newToken}
		<div class="space-y-2">
			<p class="text-xs text-gray-600 dark:text-gray-400">{$_('auth.recoveryKeyHint')}</p>
			<div class="flex gap-2">
				<div class="relative grow">
					<input
						class="w-full rounded border border-gray-300 px-2 py-1 pr-7 font-mono text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
						type={showTokenClear ? 'text' : 'password'}
						readonly
						value={newToken}
					/>
					<button
						type="button"
						class="absolute inset-y-0 right-1 flex items-center text-gray-500 dark:text-gray-400"
						onclick={() => (showTokenClear = !showTokenClear)}
						aria-label={showTokenClear ? $_('auth.hideKey') : $_('auth.showKey')}
					>
						{#if showTokenClear}
							<EyeOff class="h-3.5 w-3.5" />
						{:else}
							<Eye class="h-3.5 w-3.5" />
						{/if}
					</button>
				</div>
				<button
					class="rounded bg-black px-2 py-1 text-xs text-white dark:bg-gray-800 dark:text-gray-100"
					onclick={copyToken}
				>
					{copied ? $_('auth.keyCopied') : $_('auth.copyKey')}
				</button>
			</div>
		</div>
	{/if}

	{#if rotateError}
		<p class="text-xs text-red-600 dark:text-red-400">{rotateError}</p>
	{/if}

	<div class="flex flex-wrap gap-2">
		<button
			class="rounded border border-gray-300 px-3 py-1 text-xs disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
			onclick={handleRotate}
			disabled={rotating}
		>
			{$_('auth.rotateKey')}
		</button>
		<button
			class="rounded border border-gray-300 px-3 py-1 text-xs dark:border-gray-700 dark:text-gray-300"
			onclick={handleLogout}
		>
			{$_('auth.logout')}
		</button>
	</div>
</div>
