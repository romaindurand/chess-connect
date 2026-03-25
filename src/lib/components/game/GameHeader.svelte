<script lang="ts">
	import { resolve } from '$app/paths';
	import { Copy, History } from '@lucide/svelte';
	import { _ } from 'svelte-i18n';
	import favicon from '$lib/assets/favicon.png';
	import AppMenu from '../AppMenu.svelte';

	interface Props {
		gameId: string;
		turnLineText: string;
		isViewerTurnNow: boolean;
		copying: boolean;
		historyOpen: boolean;
		onToggleHistory: () => void;
		onCopyInvite: () => void;
	}

	let {
		gameId,
		turnLineText,
		isViewerTurnNow,
		copying,
		historyOpen,
		onToggleHistory,
		onCopyInvite
	}: Props = $props();
</script>

<header class="mb-4 flex flex-col gap-2">
	<!-- Ligne 1 : branding + actions globales -->
	<div class="flex items-center justify-between">
		<a href={resolve('/')} class="flex items-center gap-2" aria-label={$_('home.pageTitle')}>
			<img
				src={favicon}
				alt="Chess Connect"
				width="36"
				height="36"
				style="view-transition-name: app-logo"
			/>
			<span
				class="text-2xl font-semibold dark:text-gray-100"
				style="view-transition-name: app-title">Chess Connect</span
			>
		</a>
		<div class="flex items-center gap-1">
			<AppMenu />
		</div>
	</div>

	<!-- Ligne 2 : identité de la partie + historique -->
	<div class="flex items-center justify-between gap-2">
		<div class="min-w-0">
			<button
				type="button"
				onclick={onCopyInvite}
				class="flex items-center gap-1.5 text-left"
				aria-label={copying ? $_('game.header.copiedLink') : $_('game.header.copyLink')}
				title={copying ? $_('game.header.copiedLink') : $_('game.header.copyLink')}
			>
				<span class="truncate text-base font-semibold dark:text-gray-100">
					{$_('game.pageTitle', { values: { id: gameId } })}
				</span>
				<Copy
					class={`h-3.5 w-3.5 shrink-0 transition-colors ${copying ? 'text-green-500' : 'text-gray-400 dark:text-gray-500'}`}
				/>
			</button>
			{#if turnLineText}
				<p
					class={`text-sm ${isViewerTurnNow ? 'font-bold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}
				>
					{turnLineText}
				</p>
			{/if}
		</div>
		<button
			class="flex shrink-0 items-center gap-1.5 rounded border border-gray-300 px-2.5 py-1.5 text-sm dark:border-gray-700 dark:text-gray-300"
			type="button"
			onclick={onToggleHistory}
			aria-pressed={historyOpen}
			title={historyOpen ? $_('game.header.hideHistory') : $_('game.header.history')}
		>
			<History class="h-4 w-4" />
			<span>{historyOpen ? $_('game.header.hideHistory') : $_('game.header.history')}</span>
		</button>
	</div>
</header>
