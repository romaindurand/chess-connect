<script lang="ts">
	import { ChessBishop, ChessKnight, ChessPawn, ChessRook } from '@lucide/svelte';
	import { coordKey, type Coord, type PieceOnBoard, type PieceType } from '$lib/types/game';

	interface Props {
		board: (PieceOnBoard | null)[][];
		targetHints: Set<string>;
		targetHintTone: 'ally' | 'enemy';
		selectedBoardFrom: Coord | null;
		onCellEnter: (coord: Coord, cell: PieceOnBoard | null) => void;
		onCellLeave: () => void;
		onCellClick: (coord: Coord) => void;
		pieceTransitionName: (coord: Coord) => string | null;
	}

	let {
		board,
		targetHints,
		targetHintTone,
		selectedBoardFrom,
		onCellEnter,
		onCellLeave,
		onCellClick,
		pieceTransitionName
	}: Props = $props();

	function pieceIcon(piece: PieceType): typeof ChessPawn {
		if (piece === 'pawn') {
			return ChessPawn;
		}
		if (piece === 'rook') {
			return ChessRook;
		}
		if (piece === 'knight') {
			return ChessKnight;
		}
		return ChessBishop;
	}

	function pieceChipClasses(owner: 'white' | 'black'): string {
		return owner === 'white'
			? 'border border-black bg-white text-black'
			: 'border border-black bg-black text-white';
	}

	const rowLabels = ['4', '3', '2', '1'] as const;
	const colLabels = ['A', 'B', 'C', 'D'] as const;
</script>

<div class="mx-auto w-3/4">
	<div class="relative mb-6">
		<div
			class="pointer-events-none absolute inset-y-0 -left-6 grid grid-rows-4 gap-2 text-xs font-medium text-gray-500"
		>
			{#each rowLabels as label (label)}
				<div class="flex items-center justify-center">{label}</div>
			{/each}
		</div>

		<div class="mb-8 grid grid-cols-4 gap-2">
			{#each board as row, y (y)}
				{#each row as cell, x (x)}
					{@const coord = { x, y }}
					{@const key = coordKey(coord)}
					<button
						type="button"
						class={`aspect-square rounded border ${targetHints.has(key) ? (targetHintTone === 'enemy' ? 'border-red-500 bg-red-100' : 'border-black bg-emerald-100') : 'border-gray-300 bg-stone-100'} ${selectedBoardFrom && selectedBoardFrom.x === x && selectedBoardFrom.y === y ? 'ring-2 ring-black' : ''}`}
						onmouseenter={() => onCellEnter(coord, cell)}
						onmouseleave={onCellLeave}
						onclick={() => onCellClick(coord)}
					>
						{#if cell}
							{@const Icon = pieceIcon(cell.type)}
							<span
								class={`inline-flex rounded p-1 ${pieceChipClasses(cell.owner)}`}
								style={`view-transition-name: ${pieceTransitionName(coord) ?? 'none'};`}
							>
								<Icon class="h-10 w-10" />
							</span>
						{/if}
					</button>
				{/each}
			{/each}
		</div>

		<div
			class="pointer-events-none absolute inset-x-0 -bottom-6 grid grid-cols-4 gap-2 text-center text-xs font-medium text-gray-500"
		>
			{#each colLabels as label (label)}
				<div>{label}</div>
			{/each}
		</div>
	</div>
</div>
