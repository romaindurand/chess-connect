# Project Guidelines

## Code Style

- Language: TypeScript with Svelte 5 and SvelteKit 2.
- Package manager: use `pnpm` for installs and scripts.
- Keep formatting and linting consistent with project tools: Prettier + ESLint.
- Prefer small, explicit functions for rules/state transitions over large mixed-responsibility blocks.

## Architecture

- `src/lib/types/game.ts`: shared domain contract for client/server.
- `src/lib/server/*`: authoritative game logic and persistence (`game-engine.ts`, `game-store.ts`).
- `src/lib/state/*`: client-side orchestration and derived view state.
- `src/lib/components/*`: presentation only; route business behavior through `state` and server APIs.
- `src/routes/api/games/*`: REST + SSE surface used by the client.

Server is the source of truth for game state. Avoid optimistic client-side mutations that bypass API/SSE flow.

## Build and Test

- Install: `pnpm install`
- Dev server: `pnpm dev`
- Type and Svelte checks: `pnpm check`
- Lint: `pnpm lint`
- Unit tests (watch): `pnpm test:unit`
- Unit tests (single run): `pnpm test`
- Production build: `pnpm build`

Preferred verification before completion: `pnpm check && pnpm lint && pnpm test`.

## Conventions

- Keep game rules in `src/lib/server/game-engine.ts`; do not duplicate move validation in UI.
- Keep API-side session/token behavior centralized in `src/lib/server/game-store.ts`.
- Use existing state factory patterns in `src/lib/state/*` (`createGameActions`, `createGameView`, `createGameLifecycle`).
- Maintain French user-facing copy unless asked to introduce localization changes.
- Board assumptions are currently tuned for `BOARD_SIZE = 4`; treat dimension changes as cross-cutting.
- For stable auth tokens across restarts, set `CHESS_CONNECT_SECRET` in non-local environments.

## Svelte MCP Workflow

When asked Svelte/SvelteKit questions, follow this sequence:

1. `list-sections`: run first to discover relevant documentation sections.
2. `get-documentation`: fetch all sections relevant to the task based on `use_cases`.
3. `svelte-autofixer`: run on any Svelte code before presenting it; iterate until clean.
4. `playground-link`: only after user confirmation, and never when code is written to project files.

## Multi-Agent Compatibility

These rules are intentionally duplicated in root instructions so agents that do not scan `.github/instructions` still discover project constraints.

Backend scope: `src/lib/server/**`, `src/routes/api/**`, `src/lib/types/game.ts`.

- Keep rules/state authority on the server; never rely on client-side rule enforcement.
- Centralize game rules in `src/lib/server/game-engine.ts`.
- Centralize tokens/sessions/cookies in `src/lib/server/game-store.ts`.
- Keep API payload compatibility aligned with client lifecycle/SSE consumers.
- For backend behavior changes, add or update focused `src/lib/server/*.spec.ts` tests.

Frontend scope: `src/lib/components/**`, `src/lib/state/**`, `src/routes/game/**`, `src/routes/+page.svelte`, `src/routes/+layout.svelte`.

- Keep components presentation-only; put behavior in state factories and API flow.
- Reuse `createGameActions`, `createGameView`, `createGameLifecycle` patterns.
- Do not introduce optimistic client mutations that bypass API/SSE updates.
- Preserve French copy unless localization work is explicitly requested.

Companion Copilot-specific files are available in `.github/instructions/backend.instructions.md` and `.github/instructions/frontend.instructions.md`.
