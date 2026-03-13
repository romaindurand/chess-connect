---
description: 'Use when editing Svelte UI, client state orchestration, game page behavior, or event-driven rendering. Covers presentation boundaries, state factories, and UX consistency.'
name: 'Frontend State And UI Rules'
applyTo: 'src/lib/components/**, src/lib/state/**, src/routes/game/**, src/routes/+page.svelte, src/routes/+layout.svelte'
---

# Frontend Guidelines

- Keep `src/lib/components/**` presentation-focused. Route behavior and side effects through `src/lib/state/**` and API clients.
- Reuse existing state factories and patterns (`createGameActions`, `createGameView`, `createGameLifecycle`) instead of introducing parallel state mechanisms.
- Do not bypass API/SSE flow with optimistic mutations that can diverge from server state.
- Preserve move/history rendering behavior and transition mapping used by lifecycle/history modules.
- Keep user-facing copy in French unless localization changes are explicitly requested.
- Preserve board assumptions (`BOARD_SIZE = 4`) unless the task intentionally updates all affected client/server logic.

# Frontend Verification

- For state/interaction changes, add or update focused tests under `src/lib/state/*.spec.ts` when behavior changes.
- Run at minimum: `pnpm check` and `pnpm test`.
- For UI changes, confirm affected screens still load correctly on desktop and mobile layouts.
