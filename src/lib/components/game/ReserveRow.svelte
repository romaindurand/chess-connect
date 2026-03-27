<script lang="ts">
	import { ChessBishop, ChessKnight, ChessPawn, ChessRook } from '@lucide/svelte';
	import { _ } from 'svelte-i18n';
	import type { PieceType } from '$lib/types/game';

	interface Props {
		playerName: string;
		playerScore: number;
		clockText: string | null;
		clockUrgent: boolean;
		isActiveTurn: boolean;
		reserveColor: 'white' | 'black';
		pieces: PieceType[];
		isMine: boolean;
		selectedPiece: PieceType | null;
		onClick: (reserveColor: 'white' | 'black', piece: PieceType) => void;
		onDragStart: (reserveColor: 'white' | 'black', piece: PieceType) => void;
		onDragCancel: () => void;
		onEnter: (reserveColor: 'white' | 'black', piece: PieceType) => void;
		onLeave: () => void;
		pieceTransitionName: (owner: 'white' | 'black', piece: PieceType) => string | null;
	}

	let {
		playerName,
		playerScore,
		clockText,
		clockUrgent,
		isActiveTurn,
		reserveColor,
		pieces,
		isMine,
		selectedPiece,
		onClick,
		onDragStart,
		onDragCancel,
		onEnter,
		onLeave,
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

	function onPiecePointerDown(event: PointerEvent, piece: PieceType): void {
		if (event.pointerType === 'mouse' || !isMine) {
			return;
		}
		onDragStart(reserveColor, piece);
	}

	function onReserveDragStartEvent(event: DragEvent, piece: PieceType): void {
		const target = event.currentTarget as HTMLButtonElement;
		const span = target.querySelector('span');
		if (span && event.dataTransfer) {
			event.dataTransfer.setDragImage(span, span.offsetWidth / 2, span.offsetHeight / 2);
		}
		onDragStart(reserveColor, piece);
	}
</script>

<div
	class={`rounded border p-2 ${isActiveTurn ? 'border-black dark:border-gray-200' : 'border-gray-300 dark:border-gray-600'}`}
>
	<div class="mb-1 flex items-center justify-between gap-3 text-gray-700 dark:text-gray-300">
		<p class="min-w-0 truncate">{playerName} - {playerScore}</p>
		{#if clockText}
			<span
				class={`shrink-0 rounded px-2 py-0.5 font-mono text-sm ${clockUrgent ? 'bg-red-600 text-white dark:bg-red-600' : isActiveTurn ? 'bg-black text-white dark:bg-gray-800 dark:text-gray-100' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}
			>
				{clockText}
			</span>
		{/if}
	</div>
	<div class="flex h-16 flex-wrap content-start gap-2 overflow-hidden p-2">
		{#each pieces as piece (piece)}
			{@const Icon = pieceIcon(piece)}
			<button
				type="button"
				class={`rounded px-2 py-1 text-sm ${isMine && selectedPiece === piece ? 'ring-2 ring-black dark:ring-gray-400' : ''} ${!isMine ? 'opacity-50' : ''} ${isMine ? 'cursor-grab touch-none active:cursor-grabbing' : ''}`}
				onclick={() => onClick(reserveColor, piece)}
				ondragstart={(event) => onReserveDragStartEvent(event, piece)}
				ondragend={onDragCancel}
				onpointerdown={(event) => onPiecePointerDown(event, piece)}
				onmouseenter={() => onEnter(reserveColor, piece)}
				onmouseleave={onLeave}
				draggable={isMine}
				disabled={!isMine}
				title={$_(`piece.${piece}`)}
			>
				<span
					class={`inline-flex rounded p-1 ${pieceChipClasses(reserveColor)}`}
					style={`view-transition-name: ${pieceTransitionName(reserveColor, piece) ?? 'none'};`}
				>
					<Icon class="h-8 w-8" />
				</span>
			</button>
		{/each}
	</div>
</div>
