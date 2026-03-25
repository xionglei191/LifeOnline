# Implementation Plan: Fixes for error.md

## Goal
Fix structural issues reported in `error.md`, align codebase with authoritative baselines, and improve types/security across LifeOS.

## Phases & Tasks

### Phase 1: Security & Type Foundation (Server & Shared)
- [ ] **SQL Injection Prevention** (Server)
    - Review all `db.prepare` usages in `packages/server`.
    - Replace template string interpolation (`${var}`) with parameterized queries (`?`).
- [ ] **Shared Types Refinement**
    - `packages/shared/src/physicalActionTypes.ts`: Fix `WebhookCallPayload.body` (from `any` to `unknown` or robust typing).
    - `packages/shared/src/Note.ts` or equivalent: Define exact literal types for `status` (`pending` | `in_progress` | `done` | `cancelled`) and `priority` (`high` | `medium` | `low`), and `approval_status`.
    - `packages/shared`: Define a discriminated union for `WorkerTaskInput` to replace opaque `Record<string, any>`.

### Phase 2: Server-Side Type Safety
- [ ] **Database Row Types**
    - Define robust interfaces for DB rows (e.g., `NoteRow`, `DagRow`, `SoulActionRow`).
    - Eliminate `.get() as any` and `.all() as any[]` across 16+ files in `server`.
- [ ] **API Spec Compliance**
    - Wrap raw responses into `ApiResponse<T>`.
    - Validate query strings in handlers (e.g., `soulActionHandlers.ts`, `timelineHandler.ts`).

### Phase 3: Web-Side Refactoring
- [ ] **NoteDetail `as any` Elimination**
    - Fix 9 `as any` usages by utilizing strict types defined in Phase 1.
- [ ] **WorkerTaskCard & Filterbar Fixes**
    - Fix 10 `as any` usages accessing input fields in `WorkerTaskCard.vue` using the new `WorkerTaskInput` union.
    - Fix `as any` dynamic key assignments in `FilterBar.vue`.
- [ ] **Global Types**
    - Add `SpeechRecognition` declaration for `window` to `VoiceCapture.vue`.
- [ ] **Nullable Safety**
    - Audit `.value?.xxx` in web codebase and apply safe optional chaining to prevent undefined access.

### Phase 4: CI Enhancements
- [ ] **Lint and Type Check in CI**
    - Configure ESLint for standard JS/TS/Vue linting.
    - Add `lint` and `typecheck` commands to roots and `LifeOS/package.json`.
    - Update GitHub Actions workflow.

## Verification Plan
1. **Compilation Check**: `pnpm build` completes normally without type errors.
2. **Runtime Testing**: Start app locally, navigate Web UI to heavily refactored components (`NoteDetail`, `WorkerTaskCard`), verify no crashes.
3. **CI Validation**: `pnpm check` script passes locally.
