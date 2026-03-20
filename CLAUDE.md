# CLAUDE.md

## Defaults
- For any non-trivial task, enter plan mode first.
- If the current approach starts failing or drifting, stop and re-plan.
- For broad exploration, parallel analysis, or review passes, use subagents.
- Prefer direct reads/searches for small local questions.
- Be concise.
- Keep moving autonomously on safe, in-scope engineering work.

## Engineering Rules
- Fix root causes, not symptoms.
- Keep changes as small and local as possible.
- Reuse existing helpers, seams, and contracts before adding new code.
- If the same rule or predicate appears in multiple files, centralize it.
- Do not create scratch workflow files like `tasks/todo.md` or `tasks/lessons.md` unless explicitly requested.
- Do not add docs unless they are real project artifacts or explicitly requested.

## Verification
- Do not call work done without verification that matches the change.
- Start with the narrowest relevant check, then widen if needed.
- For behavior changes, verify actual behavior instead of trusting the diff.
- When relevant, run builds, tests, smoke checks, and inspect logs.

Common LifeOS verification commands:
- `pnpm --dir "/home/xionglei/Project/LifeOnline/LifeOS" --filter server build`
- `pnpm --dir "/home/xionglei/Project/LifeOnline/LifeOS" --filter web build`
- `pnpm --dir "/home/xionglei/Project/LifeOnline/LifeOS" --filter server test`
- `pnpm --dir "/home/xionglei/Project/LifeOnline/LifeOS" check`

## Project Context
- `LifeOnline/` is the repository root.
- `LifeOS/` is the main product codebase here.
- `LingGuangCatcher/` is a separate subsystem for behavior capture.
- `LifeOS/` is a pnpm monorepo:
  - `packages/server` — backend APIs, indexing, watcher, websocket, worker tasks, schedules, tests/smoke.
  - `packages/web` — Vue frontend.
  - `packages/shared` — shared TypeScript contracts.

## Architecture Bias
- Prefer local-first decisions.
- Treat LifeOS as the backend plus content output board, not a generic cloud app.
- Keep handler layers thin and service logic concentrated.
- When changing websocket, API, indexing, or worker behavior, keep `server`, `web`, and `shared` aligned.

## Done Criteria
Before finishing, make sure:
- the approach is still correct after implementation learning;
- the solution is simple enough;
- relevant validation passed;
- affected contracts, listeners, tests, and docs were updated together when needed.
