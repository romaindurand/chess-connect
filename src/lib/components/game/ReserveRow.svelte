<script lang="ts">
	import { ChessBishop, ChessKnight, ChessPawn, ChessRook } from '@lucide/svelte';
	import type { PieceType } from '$lib/types/game';

	interface Props {
		label: string;
		reserveColor: 'white' | 'black';
		pieces: PieceType[];
		isMine: boolean;
		isMyTurn: boolean;
		selectedPiece: PieceType | null;
		onClick: (reserveColor: 'white' | 'black', piece: PieceType) => void;
		onEnter: (reserveColor: 'white' | 'black', piece: PieceType) => void;
		onLeave: () => void;
		pieceTransitionName: (owner: 'white' | 'black', piece: PieceType) => string | null;
	}

	let {
		label,
		reserveColor,
		pieces,
		isMine,
		isMyTurn,
		selectedPiece,
		onClick,
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
			: 'border border-black bg-black text-white';
	}
</script>

<div class="rounded border border-gray-300 p-2">
	<p class="mb-1 text-xs text-gray-500 uppercase">{label}</p>
	<div class="flex h-14 flex-wrap content-start gap-2 overflow-hidden">
		{#each pieces as piece (piece)}
			{@const Icon = pieceIcon(piece)}
			<button
				type="button"
				class={`rounded px-2 py-1 text-sm ${isMine && selectedPiece === piece ? 'ring-2 ring-black' : ''} ${!isMine ? 'opacity-50' : ''}`}
				onclick={() => onClick(reserveColor, piece)}
				onmouseenter={() => onEnter(reserveColor, piece)}
				onmouseleave={onLeave}
				disabled={!isMine || !isMyTurn}
				title={piece}
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
