# Round Limit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make rounds unlimited by default and add an optional odd positive round limit for rematches.

**Architecture:** Add `roundLimit` as a shared game option (nullable). Validate at API input boundary, enforce match completion on server authority in `game-store`, and expose the new option in home advanced settings and option summaries.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript, Vitest.

---

### Task 1: Add failing tests for unlimited and limited rematch behavior

**Files:**

- Modify: `src/lib/server/game-store.spec.ts`

### Task 2: Add shared option type and API validation

**Files:**

- Modify: `src/lib/types/game.ts`
- Modify: `src/routes/api/games/+server.ts`

### Task 3: Enforce limit in server rematch flow

**Files:**

- Modify: `src/lib/server/game-store.ts`

### Task 4: Expose option in creation UI and display labels

**Files:**

- Modify: `src/routes/+page.svelte`
- Modify: `src/lib/game-options.ts`
- Modify: `src/lib/i18n/fr.json`
- Modify: `src/lib/i18n/en.json`
- Modify: `src/lib/i18n/index.ts`

### Task 5: Verify

**Commands:**

- `pnpm test -- src/lib/server/game-store.spec.ts src/lib/game-options.spec.ts`
- `pnpm check`
- `pnpm lint`
