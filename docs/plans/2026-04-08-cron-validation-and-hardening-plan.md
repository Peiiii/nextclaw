# Cron Validation And Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Validate the full cron feature end-to-end in dev mode and lock the highest-risk behavior into automated regression coverage.

**Architecture:** Keep the validation centered on the real `CronService` and the real dev-mode `nextclaw serve` entrypoint. Prefer one shared test harness that uses isolated `NEXTCLAW_HOME`, real `pnpm -C packages/nextclaw dev serve`, and direct inspection of `cron/jobs.json` plus `/api/cron` actions so we verify product behavior rather than only internal helpers.

**Tech Stack:** Vitest, `pnpm`, `tsx`, isolated `NEXTCLAW_HOME`, Hono `/api/cron` routes, `CronService`

---

## Implementation Result (2026-04-08)

- Completed.
- Confirmed and fixed three independent failure points:
  - `every` interval jobs lost original cadence after restart/reload.
  - foreground `dev serve` did not expose discoverable service state for CLI cron mutations.
  - UI bridge API base resolution could accidentally build `/api/api/...` requests.
- Final runtime shape:
  - running-service cron creation now uses explicit `POST /api/cron`
  - foreground and background services both expose a usable local service state for CLI discovery
  - dev-mode integration coverage now exercises real CLI add/list/disable/enable/remove/run plus restart recovery
- Final validation:
  - targeted core/server/CLI tests passed
  - `tsc` passed for touched packages
  - maintainability guard passed
  - manual foreground smoke passed without any external delivery

---

### Task 1: Capture the validation matrix

**Files:**
- Modify: `docs/plans/2026-04-08-cron-validation-and-hardening-plan.md`
- Modify: `docs/logs/v0.15.50-cron-interval-restart-recovery/README.md`

**Step 1: List the user-visible cron surfaces**

- CLI add/list/remove/enable/disable/run
- running service `/api/cron` mutations
- `CronService` scheduling for `every` / `at` / `cron`
- running-service hot reload from `cron/jobs.json`
- dev-mode restart recovery for existing interval jobs

**Step 2: Define the high-risk scenarios**

- add while service is already running
- disable prevents future triggers
- enable resumes triggers
- remove stops the job entirely
- `run` on disabled job requires `force`
- one-shot `at` runs once then disables
- restart keeps interval cadence instead of resetting the timer

**Step 3: Record the no-disturbance constraint**

- all runtime validation must use isolated `NEXTCLAW_HOME`
- no external channel delivery
- no writes into repo-local runtime data

### Task 2: Build a reusable dev-mode cron integration harness

**Files:**
- Create: `packages/nextclaw/src/cli/commands/cron-support/cron-dev-service.integration.test.ts`

**Step 1: Add isolated-home helpers**

- temp home creation
- temp cleanup
- `jobs.json` reader
- polling helper for state transitions

**Step 2: Add real process helpers**

- spawn `pnpm -C packages/nextclaw dev serve --ui-port <port>`
- wait until `✓ UI NCP agent: ready`
- graceful stop helper
- CLI helper for `pnpm -C packages/nextclaw dev:build cron ...`
- HTTP helper for `/api/cron`

**Step 3: Keep the harness honest**

- no mocks for scheduling
- only mock-free observation through file state and HTTP responses
- fail with detailed logs when readiness or trigger windows are missed

### Task 3: Lock running-service mutation behavior

**Files:**
- Modify: `packages/nextclaw/src/cli/commands/cron-support/cron-dev-service.integration.test.ts`

**Step 1: Add a running-service add/disable/enable/remove test**

- start dev-mode service
- add `every 2s` job through CLI
- wait for first trigger (`lastRunAtMs` set)
- disable through `/api/cron/:id/enable`
- assert no second trigger while disabled
- enable again
- assert trigger resumes
- remove through `/api/cron/:id`
- assert job disappears from API and store

**Step 2: Add list assertions**

- default list includes disabled jobs
- `enabledOnly=1` excludes disabled jobs

### Task 4: Lock one-shot and manual-run behavior

**Files:**
- Modify: `packages/nextclaw/src/cli/commands/cron-support/cron-dev-service.integration.test.ts`

**Step 1: Add a one-shot `at` test**

- create `at` job for near-future timestamp
- wait for execution
- assert `lastRunAtMs` is set
- assert `enabled === false`
- assert `nextRunAtMs === null`

**Step 2: Add disabled-run semantics**

- create `every` job
- disable it
- call `/api/cron/:id/run` without force and assert `executed === false`
- call again with `force: true` and assert `executed === true`

### Task 5: Lock dev-mode restart cadence recovery

**Files:**
- Modify: `packages/nextclaw/src/cli/commands/cron-support/cron-dev-service.integration.test.ts`
- Modify: `packages/nextclaw-core/src/cron/service.test.ts`

**Step 1: Add dev-mode restart recovery integration coverage**

- create an `every` job before service start
- start dev-mode service briefly, stop it before first trigger, wait, start again
- assert the newly persisted `nextRunAtMs` matches cadence alignment, not `restart time + interval`

**Step 2: Keep service-level unit coverage for pure schedule math**

- preserve the existing `CronService` unit tests as the fast inner loop

### Task 6: Run the validation matrix and fix anything that fails

**Files:**
- Modify: `packages/nextclaw-core/src/cron/service.ts` if needed
- Modify: `packages/nextclaw/src/cli/commands/cron-support/cron-local.service.ts` if needed
- Modify: `packages/nextclaw/src/cli/commands/cron.ts` if needed
- Modify: `packages/nextclaw-server/src/ui/ui-routes/cron.controller.ts` if needed

**Step 1: Run targeted tests**

- `pnpm -C packages/nextclaw-core exec vitest run src/cron/service.test.ts`
- `pnpm -C packages/nextclaw exec vitest run src/cli/commands/cron-support/cron-dev-service.integration.test.ts`
- `pnpm -C packages/nextclaw-server exec vitest run src/ui/router.cron.test.ts`

**Step 2: Run package validation**

- `pnpm -C packages/nextclaw-core lint`
- `pnpm -C packages/nextclaw-core tsc`
- `pnpm -C packages/nextclaw lint`
- `pnpm -C packages/nextclaw tsc`
- `pnpm -C packages/nextclaw-server tsc` if server route code changes

**Step 3: Run maintainability guard**

- `pnpm lint:maintainability:guard`

### Task 7: Update product-facing records

**Files:**
- Modify: `apps/docs/zh/guide/cron.md` if behavior wording changes
- Modify: `apps/docs/en/guide/cron.md` if behavior wording changes
- Modify: `docs/logs/v0.15.50-cron-interval-restart-recovery/README.md`

**Step 1: Record what was truly validated**

- separate unit coverage from real dev-mode end-to-end coverage
- explicitly call out no-external-delivery validation constraints

**Step 2: Record maintainability judgment**

- what got simplified
- what still remains risky
- why any code growth is the minimum necessary
