# Sessions Send Removal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the `sessions_send` tool completely from NextClaw so the product no longer exposes, documents, or prompts a standalone fire-and-forget session-send abstraction.

**Architecture:** Delete the tool implementation and every active registration path, then rewrite the remaining guidance so cross-session notification uses the still-supported primitives (`message`, `sessions_list`, `sessions_history`, `sessions_request`, `spawn`) without keeping compatibility glue. Keep behavior explicit and fail-fast instead of preserving the old abstraction behind aliases or hidden routing bridges.

**Tech Stack:** TypeScript, Vitest, Markdown docs, NextClaw core agent loop, NCP tool registry

---

### Task 1: Remove the tool implementation and runtime registration

**Files:**
- Modify: `packages/nextclaw-core/src/agent/tools/sessions.ts`
- Modify: `packages/nextclaw-core/src/agent/loop.ts`
- Modify: `packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-tool-registry.ts`
- Modify: `packages/nextclaw/src/cli/commands/plugin/plugin-command-utils.ts`

**Steps:**
1. Delete `SessionsSendTool` and its helper types/helpers from `sessions.ts`.
2. Remove `SessionsSendTool` imports, registration, and context wiring from both the core loop and NCP registry.
3. Remove `sessions_send` from reserved tool names.
4. Re-scan the runtime tree for live `sessions_send` references and keep deleting until only historical docs remain.

### Task 2: Remove active prompt, skill, and catalog residue

**Files:**
- Modify: `packages/nextclaw-core/src/agent/context.ts`
- Modify: `packages/nextclaw-core/src/agent/tools/tool-catalog.utils.ts`
- Modify: `packages/nextclaw-core/src/agent/skills/cross-channel-messaging/SKILL.md`
- Modify: `docs/prd/current-feature-list.md`
- Modify: `docs/feature-universe.md`
- Modify: `docs/designs/openclaw-alignment-gap-report.md`

**Steps:**
1. Delete `sessions_send` from the exposed tool catalog.
2. Rewrite AI prompt guidance so cross-session delivery uses `message` plus explicit route discovery instead of `sessions_send`.
3. Rewrite the built-in cross-channel messaging skill to stop mentioning or selecting `sessions_send`.
4. Remove the tool from current feature docs and current design-gap docs.

### Task 3: Remove tests tied to the deleted abstraction and keep the surviving coverage

**Files:**
- Modify or move: `packages/nextclaw-core/src/agent/tools/sessions-send.test.ts`
- Modify: `packages/nextclaw-core/src/agent/tests/context.test.ts`

**Steps:**
1. Delete `SessionsSendTool` tests entirely.
2. Preserve the still-useful `SessionsListTool` route-filter tests under a non-`sessions-send` filename.
3. Update context tests to match the new prompt text.

### Task 4: Validate deletion and record the iteration

**Files:**
- Create or update: `docs/logs/<new-iteration>/README.md`

**Steps:**
1. Run targeted tests for the touched core-agent files.
2. Run a repository search to confirm live code/prompt/active-doc references are gone.
3. Run `post-edit-maintainability-guard`.
4. Run `post-edit-maintainability-review`.
5. Record the deletion, validation, acceptance steps, and maintainability conclusion in the iteration log.
