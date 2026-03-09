# Agent Quick Start

This file exists for tooling compatibility with agents that look for `AGENT.md` (singular).

Primary project instructions live in `AGENTS.md`.

## Scoped Rules Summary
- Backend work: follow server-authority constraints and tests for `src/lib/server/**`, `src/routes/api/**`, and `src/lib/types/game.ts`.
- Frontend work: keep components presentation-only and behavior in state/API flow for `src/lib/components/**`, `src/lib/state/**`, and `src/routes/game/**`.

For Copilot file-scoped instruction loading, see:
- `.github/instructions/backend.instructions.md`
- `.github/instructions/frontend.instructions.md`
