# CLAUDE.md

## Defaults
- If the current approach starts failing or drifting, stop and re-plan.
- For broad exploration, parallel analysis, or review passes, use subagents.
- Prefer direct reads/searches for small local questions.
- Keep moving autonomously on safe, in-scope engineering work.

## Engineering Rules
- Fix root causes, not symptoms.
- Reuse existing helpers, seams, and contracts before adding new code.
- If the same rule or predicate appears in multiple files, centralize it.
- Do not create scratch workflow files like `tasks/todo.md` or `tasks/lessons.md` unless explicitly requested.
- Do not add docs unless they are real project artifacts or explicitly requested.


Common LifeOS verification commands (dev machine):
- `pnpm --dir "/home/xionglei/Project/LifeOnline/LifeOS" --filter server build`
- `pnpm --dir "/home/xionglei/Project/LifeOnline/LifeOS" --filter web build`
- `pnpm --dir "/home/xionglei/Project/LifeOnline/LifeOS" --filter server test`
- `pnpm --dir "/home/xionglei/Project/LifeOnline/LifeOS" check`

Deploy to 246:
- `./scripts/deploy.sh`              — git pull only
- `./scripts/deploy.sh --build`      — git pull + pnpm install + build
- `./scripts/deploy.sh --restart`    — git pull + restart LifeOS server (systemd if available, nohup fallback)
- `./scripts/deploy.sh --build --restart` — full deploy

First-time setup on 246:
- `cd ~/LifeOnline && ./scripts/install-services.sh` — install & enable systemd services

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

## Deployment Information
- **Deploy Server IP**: `192.168.31.246`
  - **LifeOnline Deployment location**: `/home/xionglei/LifeOnline`
  - **Vault location**: `/home/xionglei/Vault_OS`
  - **Systemd user services**:
    - `lifeos-server.service` — LifeOS backend (pnpm dev)
    - `lifeos-web.service` — LifeOS web frontend (pnpm dev --host, port 5173)
    - `openclaw-gateway.service` — OpenClaw (port 18789)
  - **Local deploy script** (not in git): `~/LifeOnline/scripts/deploy-local.sh`
  - **Logs**: `journalctl --user -u lifeos-server -f` / `journalctl --user -u lifeos-web -f`
- **Dev Machine IP**: `192.168.31.252`
  - **LifeOnline Dev location**: `/home/xionglei/Project/LifeOnline`

## Sync Strategy
- **Vault_OS (data)**: Mounted from `192.168.31.246` via SSHFS at `/home/xionglei/Vault_OS` on dev machine. Auto-mount managed by systemd user service `vault-os-sshfs.service`.
- **Code (LifeOnline)**: Managed via GitHub (`xionglei191/LifeOnline`, branch `main`). Dev on 252, deploy via `git pull` on 246.
