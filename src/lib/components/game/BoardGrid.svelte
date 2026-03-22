<script lang="ts">
	import { ChessBishop, ChessKnight, ChessPawn, ChessRook } from '@lucide/svelte';
	import {
		coordKey,
		type Color,
		type Coord,
		type PieceOnBoard,
		type PieceType
	} from '$lib/types/game';

	interface Props {
		board: (PieceOnBoard | null)[][];
		targetHints: Set<string>;
		targetHintTone: 'ally' | 'enemy';
		isMyTurn: boolean;
		viewerColor: Color | null;
		selectedBoardFrom: Coord | null;
		onCellEnter: (coord: Coord, cell: PieceOnBoard | null) => void;
		onCellLeave: () => void;
		onCellClick: (coord: Coord) => void;
		onBoardDragStart: (coord: Coord) => void;
		onCellDrop: (coord: Coord) => void | Promise<void>;
		onDragCancel: () => void;
		pieceTransitionName: (coord: Coord) => string | null;
	}

	let {
		board,
		targetHints,
		targetHintTone,
		isMyTurn,
		viewerColor,
		selectedBoardFrom,
		onCellEnter,
		onCellLeave,
		onCellClick,
		onBoardDragStart,
		onCellDrop,
		onDragCancel,
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
			: 'border border-black bg-black text-white dark:border-gray-200';
	}

	function canDragCell(cell: PieceOnBoard | null): boolean {
		return Boolean(isMyTurn && viewerColor && cell && cell.owner === viewerColor);
	}

	function onPiecePointerDown(event: PointerEvent, coord: Coord, cell: PieceOnBoard | null): void {
		if (event.pointerType === 'mouse' || !canDragCell(cell)) {
			return;
		}
		onBoardDragStart(coord);
	}

	function onCellPointerUp(event: PointerEvent, coord: Coord): void {
		if (event.pointerType === 'mouse') {
			return;
		}
		onCellDrop(coord);
	}

	function onBoardDragStartEvent(event: DragEvent, coord: Coord): void {
		const target = event.currentTarget as HTMLButtonElement;
		const span = target.querySelector('span');
		if (span && event.dataTransfer) {
			event.dataTransfer.setDragImage(span, span.offsetWidth / 2, span.offsetHeight / 2);
		}
		onBoardDragStart(coord);
	}

	function onCellDragOver(event: DragEvent): void {
		event.preventDefault();
	}

	function onCellDropEvent(event: DragEvent, coord: Coord): void {
		event.preventDefault();
		onCellDrop(coord);
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
						class={`aspect-square rounded border ${targetHints.has(key) ? (targetHintTone === 'enemy' ? 'border-red-500 bg-red-100' : 'border-black bg-emerald-100') : 'border-gray-300 dark:bg-gray-800'} ${selectedBoardFrom && selectedBoardFrom.x === x && selectedBoardFrom.y === y ? 'ring-2 ring-black' : ''} ${canDragCell(cell) ? 'cursor-grab active:cursor-grabbing' : ''}`}
						onmouseenter={() => onCellEnter(coord, cell)}
						onmouseleave={onCellLeave}
						onclick={() => onCellClick(coord)}
						ondragover={onCellDragOver}
						ondrop={(event) => onCellDropEvent(event, coord)}
						draggable={canDragCell(cell)}
						ondragstart={(event) => onBoardDragStartEvent(event, coord)}
						ondragend={onDragCancel}
						onpointerdown={(event) => onPiecePointerDown(event, coord, cell)}
						onpointerup={(event) => onCellPointerUp(event, coord)}
						onpointercancel={onDragCancel}
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
