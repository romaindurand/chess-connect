<script lang="ts">
	import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from '@lucide/svelte';
	import { _ } from 'svelte-i18n';
	import type { MoveHistoryEntry } from '$lib/types/game';

	interface Props {
		entries: MoveHistoryEntry[];
		selectedMoveIndex: number | null;
		onSelectMove: (moveIndex: number) => void;
		onJumpFirst: () => void;
		onJumpPrevious: () => void;
		onJumpNext: () => void;
		onJumpLast: () => void;
	}

	let {
		entries,
		selectedMoveIndex,
		onSelectMove,
		onJumpFirst,
		onJumpPrevious,
		onJumpNext,
		onJumpLast
	}: Props = $props();

	const groupedRows = $derived.by(() => {
		const rows: Array<{
			turn: number;
			white: { index: number; notation: string } | null;
			black: { index: number; notation: string } | null;
		}> = [];

		for (let index = 0; index < entries.length; index += 1) {
			const entry = entries[index];
			const turn = Math.floor((entry.ply + 1) / 2);
			const slot = entry.ply % 2 === 1 ? 'white' : 'black';

			let row = rows.find((item) => item.turn === turn);
			if (!row) {
				row = { turn, white: null, black: null };
				rows.push(row);
			}

			row[slot] = {
				index,
				notation: entry.notation
			};
		}

		return rows;
	});

	function stripPrefix(notation: string): string {
		const compact = notation.replace(/^\d+\.\.\.\s*/, '').replace(/^\d+\.\s*/, '');
		return compact;
	}
</script>

<aside class="rounded border border-gray-300 p-2">
	<p class="mb-2 text-xs font-medium text-gray-700">{$_('game.history.title')}</p>
	<div class="h-full overflow-y-auto rounded border border-gray-200 bg-white lg:h-130">
		{#if entries.length === 0}
			<p class="p-3 text-xs text-gray-500">{$_('game.history.empty')}</p>
		{:else}
			{#each groupedRows as row (row.turn)}
				{@const whiteMove = row.white}
				{@const blackMove = row.black}
				<div
					class="grid grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1fr)] border-b border-gray-100 last:border-b-0"
				>
					<div class="px-2 py-2 text-[11px] font-medium text-gray-500">{row.turn}.</div>

					{#if whiteMove}
						<button
							type="button"
							class={`px-2 py-2 text-left text-xs ${selectedMoveIndex === whiteMove.index ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
							onclick={() => onSelectMove(whiteMove.index)}
						>
							{stripPrefix(whiteMove.notation)}
						</button>
					{:else}
						<div class="px-2 py-2 text-xs text-gray-300">-</div>
					{/if}

					{#if blackMove}
						<button
							type="button"
							class={`px-2 py-2 text-left text-xs ${selectedMoveIndex === blackMove.index ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
							onclick={() => onSelectMove(blackMove.index)}
						>
							{stripPrefix(blackMove.notation)}
						</button>
					{:else}
						<div class="px-2 py-2 text-xs text-gray-300">-</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
	<div class="mt-2 grid grid-cols-4 gap-2">
		<button
			type="button"
			class="rounded border p-2"
			onclick={onJumpFirst}
			aria-label={$_('game.history.firstMove')}
		>
			<ChevronsLeft class="mx-auto h-4 w-4" />
		</button>
		<button
			type="button"
			class="rounded border p-2"
			onclick={onJumpPrevious}
			aria-label={$_('game.history.previousMove')}
		>
			<ChevronLeft class="mx-auto h-4 w-4" />
		</button>
		<button
			type="button"
			class="rounded border p-2"
			onclick={onJumpNext}
			aria-label={$_('game.history.nextMove')}
		>
			<ChevronRight class="mx-auto h-4 w-4" />
		</button>
		<button
			type="button"
			class="rounded border p-2"
			onclick={onJumpLast}
			aria-label={$_('game.history.lastMove')}
		>
			<ChevronsRight class="mx-auto h-4 w-4" />
		</button>
	</div>
</aside>
