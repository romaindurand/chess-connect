<script lang="ts">
	import { ChessBishop, ChessKnight, ChessPawn, ChessRook } from '@lucide/svelte';
	import type { Color, PieceType } from '$lib/types/game.js';

	interface Props {
		pieceType: PieceType;
		pieceColor: Color;
		x: number;
		y: number;
	}

	const { pieceType, pieceColor, x, y } = $props();

	$effect(() => {
		console.log('[drag-ghost] DragGhost component updated:', {
			pieceType,
			pieceColor,
			x,
			y
		});
	});

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

	const Icon = $derived(pieceIcon(pieceType));
</script>

<div
	class="drag-ghost"
	style="--ghost-x: {x}px; --ghost-y: {y}px;"
	aria-hidden="true"
>
	<span
		class="ghost-chip inline-flex rounded p-1 {pieceColor === 'white'
			? 'border border-black bg-white text-black'
			: 'border border-black bg-black text-white dark:border-gray-200'}"
	>
		<Icon class="h-10 w-10" />
	</span>
</div>

<style>
	.drag-ghost {
		position: fixed;
		left: var(--ghost-x);
		top: var(--ghost-y);
		pointer-events: none;
		transform: translate(-50%, -50%);
		z-index: 9999;
		transition: left 0.05s ease-out, top 0.05s ease-out;
	}

	.ghost-chip {
		opacity: 0.7;
		filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4));
		user-select: none;
	}
</style>
