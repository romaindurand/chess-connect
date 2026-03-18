<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { rotateTokenRemote, logoutRemote } from '$lib/client/auth-api';

	interface Props {
		username: string;
		onLogout: () => void;
	}

	let { username, onLogout }: Props = $props();

	let copied = $state(false);
	let newToken = $state<string | null>(null);
	let rotating = $state(false);
	let rotateError = $state('');

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

<div class="rounded-md border border-gray-200 bg-gray-50 p-4 space-y-3">
	<p class="text-sm font-medium">{$_('auth.loggedInAs', { values: { username } })}</p>

	{#if newToken}
		<div class="space-y-2">
			<p class="text-xs text-gray-600">{$_('auth.recoveryKeyHint')}</p>
			<div class="flex gap-2">
				<input
					class="grow rounded border border-gray-300 px-2 py-1 text-xs font-mono"
					type="text"
					readonly
					value={newToken}
				/>
				<button
					class="rounded bg-black px-2 py-1 text-xs text-white"
					onclick={copyToken}
				>
					{copied ? $_('auth.keyCopied') : $_('auth.copyKey')}
				</button>
			</div>
		</div>
	{/if}

	{#if rotateError}
		<p class="text-xs text-red-600">{rotateError}</p>
	{/if}

	<div class="flex flex-wrap gap-2">
		<button
			class="rounded border border-gray-300 px-3 py-1 text-xs disabled:opacity-50"
			onclick={handleRotate}
			disabled={rotating}
		>
			{$_('auth.rotateKey')}
		</button>
		<button
			class="rounded border border-gray-300 px-3 py-1 text-xs"
			onclick={handleLogout}
		>
			{$_('auth.logout')}
		</button>
	</div>
</div>
