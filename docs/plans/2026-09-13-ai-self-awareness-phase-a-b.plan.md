# AI 自感知阶段 A-B 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the classic native Agent report its real runtime/portable storage state and present identity, runtime, and session facts exactly once.

**Architecture:** DesktopInstallationProfile remains the installation owner and passes a compact environment contract through both the embedded runtime and managed command surface. A public Kernel resolver projects that contract plus current Core paths into `RuntimeInstanceSnapshot`; Service exposes it through the existing `status --json`. Existing identity/runtime/session prompt blocks are replaced by one `Current Self` projection, while project and tooling facts remain in their current owners.

**Tech Stack:** TypeScript, Electron desktop host, NextClaw Kernel/Service, Vitest, Node test runner, PowerShell Windows smoke scripts, Markdown docs.

---

## Scope

This batch implements stages A and B from `docs/designs/2026-09-13-ai-self-awareness-foundation.design.md`. Capability/permission, action/result, and diagnosis/correction stages remain later independently accepted batches.

### Task 1: Add the runtime-instance public contract

**Files:**

- Create: `packages/nextclaw-kernel/src/features/runtime-instance/utils/runtime-instance-snapshot.utils.ts`
- Create: `packages/nextclaw-kernel/src/features/runtime-instance/utils/runtime-instance-snapshot.utils.test.ts`
- Modify: `packages/nextclaw-kernel/src/features/runtime-instance/index.ts`
- Modify: `packages/nextclaw-kernel/src/index.ts`

**Steps:**

1. Write tests for portable Desktop, installed Desktop, ordinary CLI, invalid environment values, and custom `NEXTCLAW_HOME` inputs.
2. Run the focused Kernel test and confirm the missing resolver fails.
3. Define the environment keys, `RuntimeInstanceSnapshot`, and a pure resolver accepting explicit config/workspace/runtime-log paths plus an optional environment.
4. Normalize paths with platform path resolution, accept only declared enum values, and return `null` for absent Desktop-only fields.
5. Export the feature through the package root and rerun the focused test.

### Task 2: Propagate the Desktop installation context once

**Files:**

- Modify: `apps/desktop/src/managers/desktop-command-surface.manager.ts`
- Modify: `apps/desktop/src/managers/desktop-command-surface.manager.test.ts`
- Modify: `apps/desktop/src/utils/desktop-command-bridge.utils.ts`
- Modify: `apps/desktop/src/utils/desktop-command-bridge.utils.test.ts`

**Steps:**

1. Add failing assertions for distribution, installation kind, portable data root, Desktop data directory, and Desktop logs directory in both runtime and command-bridge environments.
2. Extend the schema-v1 manifest additively with nullable portable data root and Desktop logs directory; tolerate old manifests by treating absent new fields as unknown.
3. Build one environment patch from the verified Desktop profile and reuse it for the embedded runtime and command bridge.
4. Rerun Desktop manager/bridge tests.

### Task 3: Project the snapshot from existing status

**Files:**

- Modify: `packages/nextclaw-service/src/types/cli.types.ts`
- Modify: `packages/nextclaw-service/src/services/diagnostics/diagnostics-commands.service.ts`
- Modify: `packages/nextclaw-service/src/services/diagnostics/diagnostics-commands.service.test.ts`

**Steps:**

1. Add failing tests proving `instance` and `storage` are available while the managed service is stopped and that legacy top-level path fields equal the new projection.
2. Add `instance` and `storage` to `RuntimeStatusReport` using the Kernel public type.
3. Resolve the snapshot once in `collectRuntimeStatus`; keep `configPath` and `workspacePath` as compatibility projections from it.
4. Rerun focused Service diagnostics tests.

### Task 4: Replace duplicate prompt blocks with Current Self

**Files:**

- Modify: `packages/nextclaw-kernel/src/features/native-runtime/utils/nextclaw-ncp-run-context.utils.ts`
- Modify: `packages/nextclaw-kernel/src/contributions/context-provider/providers/current-session-context.provider.ts`
- Modify: `packages/nextclaw-kernel/src/contributions/context-provider/providers/native-static-context.provider.ts`
- Modify: `packages/nextclaw-kernel/src/contributions/context-provider/index.ts`
- Modify: `packages/nextclaw-kernel/src/contributions/context-provider/providers/context-provider-contract.provider.test.ts`

**Steps:**

1. Add prompt-contract assertions that Agent identity, OS/architecture, session, channel, model, and distribution appear once; project/workspace and tool readiness remain in their own blocks.
2. Preserve Agent display name in the existing resolved run-context snapshot.
3. Change the current-session provider into the sole `Current Self` renderer.
4. Remove the replaced assistant-identity and runtime static providers from registration and exports when unused.
5. Rerun context-provider and run-context focused tests, and compare the assembled prompt for duplicate semantic fields.

### Task 5: Teach the AI to query current state

**Files:**

- Modify: `packages/nextclaw-core/src/features/agent/shared/skills/nextclaw-self-manage/SKILL.md`
- Modify: `packages/nextclaw-core/src/features/agent/features/tests/skills.test.ts`
- Modify: `docs/USAGE.md`
- Modify: `packages/nextclaw/resources/USAGE.md`
- Modify: `apps/docs/zh/guide/commands.md`
- Modify: `apps/docs/en/guide/commands.md`

**Steps:**

1. Add a failing Skill contract assertion that current installation/storage/config/workspace/log questions require `nextclaw status --json` and forbid presenting defaults as current facts.
2. Update the Skill with the current/default/unknown answer contract.
3. Document `instance` and `storage`, including separate Desktop and Runtime log directories and portable layout.
4. Keep authoring and packaged USAGE copies byte-identical where required, then rerun Skill tests and documentation sync checks.

### Task 6: Extend packaged Desktop smoke coverage

**Files:**

- Modify: `apps/desktop/scripts/smoke/command-surface-smoke.mjs`
- Modify: `apps/desktop/scripts/smoke-windows-desktop.ps1`

**Steps:**

1. Extend command-surface smoke arguments with optional expected installation/storage values.
2. Assert status fields against normalized expected values.
3. Invoke the command-surface smoke from Windows portable smoke using the current launcher log and portable root.
4. Run deterministic local tests; run the Windows packaged smoke in an available Windows/CI environment before declaring the platform acceptance complete.

### Task 7: Complete validation, review, and mainline delivery

**Files:**

- Create: `.changeset/add-ai-self-awareness-status.md`
- Modify: `docs/designs/2026-09-13-ai-self-awareness-foundation.design.md`

**Steps:**

1. Add the required public-package changeset for the additive status contract and native self-awareness behavior.
2. Run focused tests, matching package `tsc`, docs/resource consistency checks, command-surface smoke, and `git diff --check`.
3. Run the diff-only maintainability checker over every touched source/test/script path.
4. Perform implementation review against RSA-001 through RSA-007 plus prompt de-duplication acceptance; disclose any Windows-only evidence that cannot run locally.
5. Mark the design implemented only after required evidence passes.
6. Stage only precise task files, commit the task branch, run `pnpm release:reconcile:mainline`, and verify `origin/master` contains the commit without disturbing main-workspace WIP.
