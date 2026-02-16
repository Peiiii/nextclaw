# nextclaw-core

## 0.4.10

### Patch Changes

- Fix packaged version resolution so `nextclaw --version` and runtime version APIs no longer fall back to `0.0.0`.
  - Resolve package versions by walking up to the correct package root at runtime.
  - Prioritize the `nextclaw` package version in CLI utilities with safe fallback to core version resolution.

## 0.4.9

### Patch Changes

- Align OpenClaw plugin compatibility for channel runtime behavior.
  - Add channel messageToolHints resolution and inject hints into agent system prompt messaging guidance.
  - Forward plugin AccountId context through runtime bridge so channel/account-specific hints can resolve.
  - Improve OpenClaw channel integration path for ClawBay-compatible plugins and update docs/logs.

## 0.4.8

### Patch Changes

- Unify internal package names under the `@nextclaw` scope while keeping the CLI package name as `nextclaw`.
  - Rename packages to `@nextclaw/core`, `@nextclaw/server`, and `@nextclaw/openclaw-compat`.
  - Update all workspace imports, dependency declarations, and TypeScript path aliases.
  - Keep plugin compatibility behavior and CLI user experience unchanged.

## 0.4.7

### Patch Changes

- Show MiniMax API base hints in UI and extend config schema hints/help.

## 0.4.6

### Patch Changes

- Align provider/channel list descriptions with config UI hints and extend schema help entries.

## 0.4.5

### Patch Changes

- Align config schema + uiHints pipeline with OpenClaw-style mechanism, add schema API, and unify config redaction.

## 0.4.4

### Patch Changes

- fix: avoid exec guard blocking curl format query

## 0.4.3

### Patch Changes

- fix: persist tool call history in sessions

## 0.4.2

### Patch Changes

- chore: seed built-in skills during init

## 0.4.1

### Patch Changes

- chore: tighten eslint line limits

## 0.4.0

### Minor Changes

- Align core tools (gateway/sessions/subagents/memory) with openclaw semantics and add gateway update flow.

## 0.3.0

### Minor Changes

- Add provider hot-reload support and wire_api configuration updates.
