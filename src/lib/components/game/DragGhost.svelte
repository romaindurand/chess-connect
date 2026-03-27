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
	<div class="ghost-icon" class:white={pieceColor === 'white'} class:black={pieceColor === 'black'}>
		<Icon size={32} />
	</div>
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

	.ghost-icon {
		font-size: 2rem;
		opacity: 0.7;
		filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.2));
		user-select: none;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ghost-icon.white {
		color: black;
	}

	.ghost-icon.black {
		color: white;
	}

	:global(.dark-mode) .ghost-icon.black {
		color: #e5e7eb;
	}
</style>
