---
description: 'Use when changing game rules, server state, API endpoints, auth/session tokens, or SSE flow. Covers server authority, safety checks, and required backend tests.'
name: 'Backend Game And API Rules'
applyTo: 'src/lib/server/**, src/routes/api/**, src/lib/types/game.ts'
---

# Backend Guidelines

- Treat the server as the source of truth for game state. Do not rely on client-side validation for rule enforcement.
- Keep move validation and game-rule logic centralized in `src/lib/server/game-engine.ts`.
- Keep session/token/cookie behavior centralized in `src/lib/server/game-store.ts`.
- Maintain API contracts in `src/lib/types/game.ts` and update both server and client usage together when contracts change.
- Preserve SSE compatibility in `src/routes/api/games/[id]/events/+server.ts`: payload shape changes must be coordinated with client lifecycle handlers.
- Prefer explicit validation and clear HTTP error responses in API routes.
- Keep user-facing server messages in French unless the task explicitly introduces localization changes.

# Backend Verification

- Add or update focused tests for changed server behavior in `src/lib/server/*.spec.ts`.
- Run at minimum: `pnpm check` and `pnpm test`.
- For API behavior changes, verify end-to-end request flow through route handlers and store/engine integration.
