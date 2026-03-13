# AI Opponent Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a playable AI opponent mode with a TypeScript-only AlphaZero-lite architecture and npm scripts for self-play training.

**Architecture:** Keep the server authoritative and route all AI decisions through the existing game engine/store flow. Split the work into: shared domain types for AI games and training config, server-side AI orchestration for human-vs-AI matches, and a separate offline training pipeline using TensorFlow.js Node for policy/value learning.

**Tech Stack:** TypeScript, SvelteKit 2, Svelte 5, Node.js, TensorFlow.js Node, Vitest.

---

### Task 1: Shared AI domain types

**Files:**

- Modify: `src/lib/types/game.ts`
- Test: `src/lib/server/game-store.spec.ts`

**Step 1: Write the failing test**

- Assert that a created AI game persists the requested AI-related options in state.

**Step 2: Run test to verify it fails**

- Run: `pnpm test -- --run src/lib/server/game-store.spec.ts`

**Step 3: Write minimal implementation**

- Add game mode, AI config, and create payload fields to shared types.
- Extend `GameState` with AI-related options and metadata.

**Step 4: Run test to verify it passes**

- Run: `pnpm test -- --run src/lib/server/game-store.spec.ts`

### Task 2: Create-game flow for AI matches

**Files:**

- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/api/games/+server.ts`
- Modify: `src/lib/server/game-store.ts`
- Test: `src/lib/server/game-store.spec.ts`

**Step 1: Write the failing test**

- Assert AI game creation starts with one human player and one reserved AI side.

**Step 2: Run test to verify it fails**

- Run: `pnpm test -- --run src/lib/server/game-store.spec.ts`

**Step 3: Write minimal implementation**

- Add UI controls for human-vs-human vs human-vs-AI.
- Parse AI creation payload and initialize state accordingly.

**Step 4: Run test to verify it passes**

- Run: `pnpm test -- --run src/lib/server/game-store.spec.ts`

### Task 3: Server AI adapter scaffold

**Files:**

- Create: `src/lib/server/ai/config.ts`
- Create: `src/lib/server/ai/encoder.ts`
- Create: `src/lib/server/ai/model.ts`
- Create: `src/lib/server/ai/mcts.ts`
- Create: `src/lib/server/ai/agent.ts`
- Modify: `src/lib/server/game-store.ts`
- Test: `src/lib/server/ai/agent.spec.ts`

**Step 1: Write the failing test**

- Assert an AI adapter can enumerate legal moves and return a valid move suggestion for a given state.

**Step 2: Run test to verify it fails**

- Run: `pnpm test -- --run src/lib/server/ai/agent.spec.ts`

**Step 3: Write minimal implementation**

- Create no-op AlphaZero-lite interfaces and a baseline policy fallback using legal move enumeration.
- Keep inference decoupled from training.

**Step 4: Run test to verify it passes**

- Run: `pnpm test -- --run src/lib/server/ai/agent.spec.ts`

### Task 4: Automatic AI turns

**Files:**

- Modify: `src/lib/server/game-store.ts`
- Test: `src/lib/server/game-store.spec.ts`

**Step 1: Write the failing test**

- Assert that after a human move in an AI game, the server advances the AI move through the same authoritative path.

**Step 2: Run test to verify it fails**

- Run: `pnpm test -- --run src/lib/server/game-store.spec.ts`

**Step 3: Write minimal implementation**

- Hook AI move scheduling into the existing store flow after validated human moves.

**Step 4: Run test to verify it passes**

- Run: `pnpm test -- --run src/lib/server/game-store.spec.ts`

### Task 5: Training pipeline scaffold

**Files:**

- Create: `src/lib/server/ai/self-play.ts`
- Create: `src/lib/server/ai/train.ts`
- Create: `src/lib/server/ai/checkpoints/.gitkeep`
- Modify: `package.json`
- Modify: `README.md`
- Test: `src/lib/server/ai/train.spec.ts`

**Step 1: Write the failing test**

- Assert training config parsing and checkpoint path resolution work.

**Step 2: Run test to verify it fails**

- Run: `pnpm test -- --run src/lib/server/ai/train.spec.ts`

**Step 3: Write minimal implementation**

- Add npm scripts for self-play and training.
- Add TensorFlow.js Node integration points behind a small adapter.

**Step 4: Run test to verify it passes**

- Run: `pnpm test -- --run src/lib/server/ai/train.spec.ts`

### Task 6: Final verification

**Files:**

- Modify as needed from earlier tasks

**Step 1: Run project verification**

- Run: `pnpm check && pnpm test -- --run`

**Step 2: Run lint if dependencies are stable**

- Run: `pnpm lint`

**Step 3: Update README usage notes**

- Document how to create an AI game and how to launch self-training.
