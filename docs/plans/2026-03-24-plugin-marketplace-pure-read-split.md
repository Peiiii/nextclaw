# Plugin Marketplace Pure Read Split Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the plugin marketplace page fast and predictable by keeping read paths side-effect free and removing remote full-catalog fetch from the plugin list path.

**Architecture:** Split plugin observation from plugin execution. Marketplace installed reads should use a pure discovery/report path that never imports plugin modules, while real runtime/plugin execution continues to use the existing full load path. Plugin catalog listing should proxy remote pagination instead of fetching the entire remote catalog and paginating locally.

**Tech Stack:** TypeScript, Hono, Vitest, React Query, pnpm workspace

---

### Task 1: Add an explicit pure-read plugin discovery report

**Files:**
- Modify: `packages/nextclaw-openclaw-compat/src/plugins/status.ts`
- Test: `packages/nextclaw-openclaw-compat/src/plugins/status.pure-read.test.ts`

**Step 1:** Add a new pure-read report entry such as `discoverPluginStatusReport(...)`.

**Step 2:** Build its records from manifest/config discovery only, including bundled plugins, without importing plugin runtime modules.

**Step 3:** Keep `buildPluginStatusReport(...)` as the full runtime-loading path.

**Step 4:** Add tests proving:
- pure-read discovery does not import a probe plugin module
- full load still imports and registers that probe plugin

### Task 2: Move marketplace installed reads to the pure-read path

**Files:**
- Modify: `packages/nextclaw-server/src/ui/router/marketplace/installed.ts`
- Test: `packages/nextclaw-server/src/ui/router.marketplace-installed.test.ts`

**Step 1:** Replace marketplace installed plugin collection so it uses the new pure-read discovery report instead of the full load report.

**Step 2:** Preserve installed list behavior, including bundled plugins, enable/disable state, uninstall targeting, and canonical spec resolution.

**Step 3:** Keep the existing route-level regression test that proves the installed read path does not import the probe plugin runtime module.

### Task 3: Remove plugin catalog full-fetch behavior

**Files:**
- Modify: `packages/nextclaw-server/src/ui/router/marketplace/plugin.controller.ts`
- Test: `packages/nextclaw-server/src/ui/router.marketplace-content.test.ts`

**Step 1:** Change plugin catalog listing to proxy the requested remote page directly.

**Step 2:** Preserve normalization and UI-safe shaping of returned items.

**Step 3:** Add a regression test proving the plugin list endpoint forwards requested `page/pageSize` and does not loop over remote pages.

### Task 4: Verify, document, and ship

**Files:**
- Create: `docs/logs/v<next>-plugin-marketplace-pure-read-split/README.md`

**Step 1:** Run targeted tests, `tsc`, `build`, and minimal lint/maintainability checks for touched packages.

**Step 2:** Record validation and user-facing acceptance steps in the iteration log.

**Step 3:** Commit only the files for this task with an English commit message.
