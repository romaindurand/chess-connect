<script lang="ts">
	import { ChessBishop, ChessKnight, ChessPawn, ChessRook } from '@lucide/svelte';
	import { coordKey, type Coord, type PieceOnBoard, type PieceType } from '$lib/types/game';

	interface Props {
		board: (PieceOnBoard | null)[][];
		targetHints: Set<string>;
		selectedBoardFrom: Coord | null;
		onCellEnter: (coord: Coord, cell: PieceOnBoard | null) => void;
		onCellLeave: () => void;
		onCellClick: (coord: Coord) => void;
	}

	let { board, targetHints, selectedBoardFrom, onCellEnter, onCellLeave, onCellClick }: Props =
		$props();

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
</script>

<div class="mx-auto grid w-3/4 grid-cols-4 gap-2">
	{#each board as row, y (y)}
		{#each row as cell, x (x)}
			{@const coord = { x, y }}
			{@const key = coordKey(coord)}
			<button
				type="button"
				class={`aspect-square rounded border ${targetHints.has(key) ? 'border-black bg-emerald-100' : 'border-gray-300 bg-stone-100'} ${selectedBoardFrom && selectedBoardFrom.x === x && selectedBoardFrom.y === y ? 'ring-2 ring-black' : ''}`}
				onmouseenter={() => onCellEnter(coord, cell)}
				onmouseleave={onCellLeave}
				onclick={() => onCellClick(coord)}
			>
				{#if cell}
					{@const Icon = pieceIcon(cell.type)}
					<span class={`inline-flex rounded p-1 ${pieceChipClasses(cell.owner)}`}>
						<Icon class="h-10 w-10" />
					</span>
				{/if}
			</button>
		{/each}
	{/each}
</div>
