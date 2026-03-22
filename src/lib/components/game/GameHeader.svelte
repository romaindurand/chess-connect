<script lang="ts">
	import { resolve } from '$app/paths';
	import { ChevronDown, History, Languages, Share2 } from '@lucide/svelte';
	import { _ } from 'svelte-i18n';
	import type { SupportedLanguage } from '$lib/i18n';
	import favicon from '$lib/assets/favicon.png';
	import DarkModeToggle from '../DarkModeToggle.svelte';

	interface Props {
		gameId: string;
		turnLineText: string;
		isViewerTurnNow: boolean;
		copying: boolean;
		historyOpen: boolean;
		onToggleHistory: () => void;
		currentLanguage: SupportedLanguage;
		onChangeLanguage: (language: SupportedLanguage) => void;
		onShowRules: () => void;
		onCopyInvite: () => void;
	}

	let {
		gameId,
		turnLineText,
		isViewerTurnNow,
		copying,
		historyOpen,
		onToggleHistory,
		currentLanguage,
		onChangeLanguage,
		onShowRules,
		onCopyInvite
	}: Props = $props();
</script>

<header class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
	<div class="flex items-stretch gap-3">
		<a href={resolve('/')} class="flex shrink-0 items-stretch" aria-label={$_('home.pageTitle')}>
			<img src={favicon} alt="Chess Connect" width="52" />
		</a>
		<div class="flex min-h-[3.25rem] flex-col justify-between">
			<h1 class="text-2xl font-semibold">{$_('game.pageTitle', { values: { id: gameId } })}</h1>
			{#if turnLineText}
				<p
					class={`h-5 text-sm ${isViewerTurnNow ? 'font-bold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}
				>
					{turnLineText}
				</p>
			{/if}
		</div>
	</div>
	<div class="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
		<button
			class="rounded border border-gray-300 p-2 dark:border-gray-700 dark:text-gray-300"
			type="button"
			onclick={onToggleHistory}
			aria-label={historyOpen ? $_('game.header.hideHistory') : $_('game.header.history')}
			title={historyOpen ? $_('game.header.hideHistory') : $_('game.header.history')}
		>
			<History class="h-4 w-4" />
		</button>
		<label
			class="flex items-center gap-2 rounded border border-gray-300 px-2 py-2 text-sm dark:border-gray-700 dark:text-gray-300"
			title={$_('game.header.language')}
		>
			<Languages class="h-4 w-4" aria-hidden="true" />
			<span class="sr-only">{$_('game.header.language')}</span>
			<span class="relative">
				<select
					class="appearance-none border-0 bg-transparent bg-none py-0 pr-5 pl-0 text-sm focus:ring-0 dark:bg-transparent dark:text-gray-300"
					value={currentLanguage}
					onchange={(event) =>
						onChangeLanguage((event.currentTarget as HTMLSelectElement).value as SupportedLanguage)}
					aria-label={$_('game.header.language')}
				>
					<option value="fr">{$_('language.french')}</option>
					<option value="en">{$_('language.english')}</option>
				</select>
				<ChevronDown
					class="pointer-events-none absolute top-1/2 right-0 h-3 w-3 -translate-y-1/2 text-gray-500 dark:text-gray-400"
					aria-hidden="true"
				/>
			</span>
		</label>
		<button
			class="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:text-gray-300"
			type="button"
			onclick={onShowRules}>{$_('game.header.rules')}</button
		>
		<button
			class="rounded border border-gray-300 p-2 dark:border-gray-700 dark:text-gray-300"
			type="button"
			onclick={onCopyInvite}
			aria-label={copying ? $_('game.header.copiedLink') : $_('game.header.copyLink')}
			title={copying ? $_('game.header.copiedLink') : $_('game.header.copyLink')}
		>
			<Share2 class="h-4 w-4" />
		</button>
		<DarkModeToggle />
	</div>
</header>
