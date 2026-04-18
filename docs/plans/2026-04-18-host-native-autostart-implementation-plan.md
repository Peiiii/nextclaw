# Host-Native Autostart Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Productize Linux npm/CLI autostart as a host-native `systemd` capability with explicit install, uninstall, status, and doctor commands.

**Architecture:** Keep desktop packaged login-at-login untouched and add a separate CLI-side host autostart owner under `service-support/autostart/`. Wire a new `service` command group into the CLI, implement Linux `systemd --user` and `systemd --system` flows with explicit unit-file generation plus `systemctl` control, and expose one shared JSON/plain-text status contract. Keep macOS/Windows out of scope for this batch and report them as unsupported instead of adding speculative fallbacks.

**Tech Stack:** TypeScript, Commander, Node fs/path/os utilities, Linux systemd, Vitest, existing NextClaw CLI/service command structure

---

### Task 1: Add the host autostart owner

**Files:**
- Create: `packages/nextclaw/src/cli/commands/service-support/autostart/host-autostart.types.ts`
- Create: `packages/nextclaw/src/cli/commands/service-support/autostart/linux-systemd-autostart.service.ts`
- Create: `packages/nextclaw/src/cli/commands/service-support/autostart/host-autostart.service.ts`
- Test: `packages/nextclaw/src/cli/commands/service-support/autostart/tests/linux-systemd-autostart.service.test.ts`

**Step 1: Write failing tests for Linux unit generation, scope selection, unsupported-platform reporting, and status parsing.**

**Step 2: Implement the minimal Linux owner with:**
- unit-file path resolution for `--user` / `--system`
- explicit `NEXTCLAW_HOME` and stable CLI entry resolution
- install / uninstall / status / doctor behavior
- no hidden platform fallback

**Step 3: Run the targeted test file and make it pass.**

### Task 2: Wire commands into the CLI

**Files:**
- Modify: `packages/nextclaw/src/cli/index.ts`
- Modify: `packages/nextclaw/src/cli/runtime.ts`
- Modify: `packages/nextclaw/src/cli/commands/service.ts`

**Step 1: Add a `service` command group with:**
- `install-systemd`
- `uninstall-systemd`
- `autostart status`
- `autostart doctor`

**Step 2: Delegate runtime/controller calls into the new host autostart owner.**

**Step 3: Keep existing `start/restart/stop` commands unchanged.**

### Task 3: Update user-facing docs

**Files:**
- Modify: `apps/docs/en/guide/commands.md`
- Modify: `apps/docs/zh/guide/commands.md`
- Modify: `docs/USAGE.md`
- Modify: `packages/nextclaw/resources/USAGE.md`

**Step 1: Clarify that npm install does not auto-register autostart.**

**Step 2: Document Linux user/system systemd flows and the new status/doctor commands.**

### Task 4: Validate and record the iteration

**Files:**
- Create: `docs/logs/v0.16.67-linux-cli-systemd-autostart/README.md`

**Step 1: Run targeted tests, lint/governance checks, and type-checking for touched files.**

**Step 2: Run a post-edit maintainability review after the guard.**

**Step 3: Record implementation, validation, deployment, acceptance, maintainability, and npm publish status in the iteration README.**
