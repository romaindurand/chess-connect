# Drag Ghost Visual Feedback Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add visual ghost feedback during touch drag on mobile—piece floats under cursor with 70% opacity and smooth following motion.

**Architecture:** Extend `game.svelte.ts` state to track drag ghost position and piece info. Add document-level `touchmove` listener to update ghost coordinates. Create lightweight `<DragGhost>` component rendered in `+page.svelte` that positions floating icon at tracked coordinates with smooth CSS transition.

**Tech Stack:** Svelte 5 runes, pointer events API, CSS `transform` with `transition` for smooth following.

---

## Task 1: Extend game state with drag ghost tracking

**Files:**

- Modify: `src/lib/state/game.svelte.ts`

**Step 1: Read current game state structure**

Run: `rtk head -80 src/lib/state/game.svelte.ts`

Expected: See current rune definitions and state getters.

**Step 2: Add drag ghost position and piece info runes**

In `src/lib/state/game.svelte.ts`, find the section where `dragBoardFrom` and `dragReservePiece` are defined (around line 15-30). Add these new runes right after:

```typescript
// Drag ghost visual feedback (mobile)
let dragGhostPosition = $state<{ x: number; y: number } | null>(null);
let dragGhostPieceInfo = $state<{ type: PieceType; color: PieceColor } | null>(null);
```

**Step 3: Add getter for drag ghost info**

Find the section with existing getters (around line 100+), add:

```typescript
function getDragGhostInfo() {
	return {
		position: dragGhostPosition,
		pieceInfo: dragGhostPieceInfo
	};
}
```

**Step 4: Export new runes and getter**

In the `return` statement (bottom of file), add:

```typescript
dragGhostPosition,
dragGhostPieceInfo,
getDragGhostInfo,
```

So the interface exposes ways for page to update ghost position and read ghost state.

**Step 5: Commit**

```bash
cd /home/romain/chess-connect
git add src/lib/state/game.svelte.ts
git commit -m "feat: add drag ghost position tracking to game state"
```

---

## Task 2: Create DragGhost component

**Files:**

- Create: `src/lib/components/game/DragGhost.svelte`

**Step 1: Write DragGhost component with visual and positioning**

Create new file `src/lib/components/game/DragGhost.svelte`:

```svelte
<script lang="ts">
	import type { PieceType, PieceColor } from '$lib/types/game.js';
	import { pieceIcon } from '../piece-icon.svelte.js';

	interface Props {
		pieceType: PieceType;
		pieceColor: PieceColor;
		x: number;
		y: number;
	}

	const { pieceType, pieceColor, x, y } = $props();

	const icon = pieceIcon(pieceType);
</script>

<div class="drag-ghost" style="--ghost-x: {x}px; --ghost-y: {y}px;" aria-hidden="true">
	<div class="ghost-icon">
		{icon}
	</div>
</div>

<style>
	:global(.dark-mode) .drag-ghost {
		--ghost-text-color: white;
	}

	:global(:not(.dark-mode)) .drag-ghost {
		--ghost-text-color: black;
	}

	.drag-ghost {
		position: fixed;
		left: var(--ghost-x);
		top: var(--ghost-y);
		pointer-events: none;
		transform: translate(-50%, -50%);
		z-index: 9999;
		transition:
			left 0.05s ease-out,
			top 0.05s ease-out;
	}

	.ghost-icon {
		font-size: 2rem;
		opacity: 0.7;
		color: var(--ghost-text-color);
		filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.2));
		user-select: none;
	}
</style>
```

**Step 2: Verify component structure**

Run: `rtk svelte-check src/lib/components/game/DragGhost.svelte`

Expected: No Svelte errors, types validated.

**Step 3: Commit**

```bash
cd /home/romain/chess-connect
git add src/lib/components/game/DragGhost.svelte
git commit -m "feat: create DragGhost component for visual feedback"
```

---

## Task 3: Add touchmove listener and ghost rendering in +page.svelte

**Files:**

- Modify: `src/routes/game/[id]/+page.svelte`

**Step 1: Import DragGhost component**

At top of script section, add:

```typescript
import DragGhost from '$lib/components/game/DragGhost.svelte';
```

**Step 2: Add touchmove listener for ghost position tracking**

In the `onMount()` function, find where document listeners are added. Add this listener alongside the existing `touchmove` listener:

```typescript
function onDocumentTouchMove(e: TouchEvent) {
	if (!state.isDragging()) {
		return;
	}

	// Prevent page scroll during drag
	e.preventDefault();

	// Update drag ghost position to follow finger
	if (e.touches.length > 0) {
		const touch = e.touches[0];
		state.dragGhostPosition = {
			x: touch.clientX,
			y: touch.clientY
		};
	}
}

document.addEventListener('touchmove', onDocumentTouchMove, { passive: false });
```

**Step 3: Initialize ghost on drag start**

Find the component's pointermove handler on pieces (in BoardGrid or ReserveRow callback). When drag initiates, set ghost piece info. This happens in:

- `onBoardDragStart(from)` callback
- `onReserveDragStart(piece, color)` callback

Replace in page section where these callbacks dispatch:

```typescript
// When receiving onBoardDragStart from BoardGrid
function onBoardDragStart(from: Coord) {
	const piece = state.view.board[from.y][from.x];
	if (piece) {
		state.dragGhostPieceInfo = {
			type: piece.type,
			color: piece.color
		};
	}
	// ... rest of existing logic
}

// When receiving onReserveDragStart from ReserveRow
function onReserveDragStart(piece: PieceType, color: PieceColor) {
	state.dragGhostPieceInfo = {
		type: piece,
		color
	};
	// ... rest of existing logic
}
```

**Step 4: Clear ghost on drag end**

In `onDocumentPointerUp()` after handling drop, add:

```typescript
// Clear ghost visual
state.dragGhostPosition = null;
state.dragGhostPieceInfo = null;
```

Also do this in `onDocumentPointerCancel()`:

```typescript
state.dragGhostPosition = null;
state.dragGhostPieceInfo = null;
```

**Step 5: Clean up touchmove listener on destroy**

In `onDestroy()`, add:

```typescript
document.removeEventListener('touchmove', onDocumentTouchMove);
```

**Step 6: Render DragGhost conditionally in markup**

In the template section (marked `<!-- Game board and controls -->`), add before closing root div:

```svelte
{#if state.dragGhostPieceInfo && state.dragGhostPosition}
	<DragGhost
		pieceType={state.dragGhostPieceInfo.type}
		pieceColor={state.dragGhostPieceInfo.color}
		x={state.dragGhostPosition.x}
		y={state.dragGhostPosition.y}
	/>
{/if}
```

**Step 7: Verify syntax and types**

Run: `rtk svelte-check src/routes/game/\[id\]/+page.svelte`

Expected: No Svelte errors.

**Step 8: Commit**

```bash
cd /home/romain/chess-connect
git add src/routes/game/\[id\]/+page.svelte
git commit -m "feat: add touchmove ghost tracking and DragGhost rendering"
```

---

## Task 4: Run checks and tests

**Step 1: Type check entire project**

Run: `rtk pnpm check`

Expected: 0 TypeScript errors, 0 Svelte errors.

**Step 2: Run full test suite**

Run: `rtk pnpm test`

Expected: All 122 tests pass, 0 failures.

**Step 3: Manual browser test (mobile sim)**

1. Open DevTools → Toggle Device Toolbar (Ctrl+Shift+M)
2. Select iPhone 12 or similar
3. Navigate to active game
4. Touch-drag a piece → ghost should follow finger with 70% opacity and smooth motion
5. Drop piece → ghost disappears, move completes

Expected: Smooth visual feedback, no console errors, ghost vanishes on drop.

**Step 4: Commit final validation**

```bash
cd /home/romain/chess-connect
git add -A
git commit -m "feat: verify drag ghost mobile UX complete and passing"
```

---

## Summary

**Changes:**

- `game.svelte.ts`: +2 state runes, +1 getter for ghost info
- `DragGhost.svelte`: New 50-line component with fixed positioning and smooth transitions
- `+page.svelte`: Enhanced touchmove listener to track position, initialized ghost on drag start, cleanup on drag end, conditional rendering

**Testing:**

- Type safety validated (svelte-check)
- Test suite green (pnpm test)
- Manual mobile browser sim validation

**Commits:**

- 1. Extend game state
- 2. Create DragGhost component
- 3. Add touchmove tracking and rendering
- 4. Final verification

**Estimated time:** 15–20 minutes total.
