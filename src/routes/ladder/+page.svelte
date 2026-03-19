<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { _ } from 'svelte-i18n';
	import { onMount } from 'svelte';

	import { getLadderRemote } from '$lib/client/game-api';
	import { buildPageTitle } from '$lib/seo';
	import type { LadderEntry } from '$lib/types/game';

	const pageTitle = $derived($_('ladder.pageTitle'));
	const pageDescription = $derived($_('ladder.pageDescription'));
	const canonicalUrl = $derived(page.url.href);

	let entries = $state<LadderEntry[]>([]);
	let loading = $state(true);
	let error = $state('');

	onMount(async () => {
		loading = true;
		error = '';
		try {
			const response = await getLadderRemote(200);
			entries = response.ladder;
		} catch (e) {
			error = e instanceof Error ? e.message : $_('errors.unexpected');
		} finally {
			loading = false;
		}
	});

	function ratio(entry: LadderEntry): string {
		const total = entry.rankedWins + entry.rankedLosses;
		if (total === 0) {
			return '-';
		}
		return `${Math.round((entry.rankedWins / total) * 100)}%`;
	}
</script>

<svelte:head>
	<title>{buildPageTitle(pageTitle)}</title>
	<meta name="description" content={pageDescription} />
	<link rel="canonical" href={canonicalUrl} />
</svelte:head>

<main class="mx-auto min-h-screen max-w-4xl px-4 py-8">
	<div class="mb-6 flex items-center justify-between gap-4">
		<h1 class="text-3xl font-semibold">{$_('ladder.title')}</h1>
		<a class="rounded-md border border-gray-300 px-3 py-2 text-sm" href={resolve('/')}
			>{$_('ladder.backHome')}</a
		>
	</div>

	{#if loading}
		<p class="text-sm text-gray-600">{$_('common.loading')}</p>
	{:else if error}
		<p class="text-sm text-red-600">{error}</p>
	{:else if entries.length === 0}
		<p class="text-sm text-gray-600">{$_('ladder.empty')}</p>
	{:else}
		<div class="overflow-x-auto rounded-lg border border-gray-200">
			<table class="min-w-full divide-y divide-gray-200 text-left text-sm">
				<thead class="bg-gray-50 text-gray-700">
					<tr>
						<th class="px-4 py-3">#</th>
						<th class="px-4 py-3">{$_('ladder.player')}</th>
						<th class="px-4 py-3">{$_('ladder.elo')}</th>
						<th class="px-4 py-3">{$_('ladder.games')}</th>
						<th class="px-4 py-3">{$_('ladder.winrate')}</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100">
					{#each entries as entry, index (entry.userId)}
						<tr>
							<td class="px-4 py-3">{index + 1}</td>
							<td class="px-4 py-3">{entry.username}</td>
							<td class="px-4 py-3 font-semibold">{entry.rating}</td>
							<td class="px-4 py-3">{entry.rankedWins + entry.rankedLosses}</td>
							<td class="px-4 py-3">{ratio(entry)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</main>
