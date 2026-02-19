# @nextclaw/openclaw-compat

## 0.1.4

### Patch Changes

- - Improve gateway self-restart behavior after in-process update flow.
  - Refine self-management prompts/docs for update and runtime guidance.
  - Disable OpenClaw plugin loading by default unless `NEXTCLAW_ENABLE_OPENCLAW_PLUGINS=1` is explicitly set.
- Updated dependencies
  - @nextclaw/core@0.5.3

## 0.1.3

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.5.0

## 0.1.2

### Patch Changes

- Align OpenClaw plugin compatibility for channel runtime behavior.
  - Add channel messageToolHints resolution and inject hints into agent system prompt messaging guidance.
  - Forward plugin AccountId context through runtime bridge so channel/account-specific hints can resolve.
  - Improve OpenClaw channel integration path for ClawBay-compatible plugins and update docs/logs.

- Updated dependencies
  - @nextclaw/core@0.4.9

## 0.1.1

### Patch Changes

- Unify internal package names under the `@nextclaw` scope while keeping the CLI package name as `nextclaw`.
  - Rename packages to `@nextclaw/core`, `@nextclaw/server`, and `@nextclaw/openclaw-compat`.
  - Update all workspace imports, dependency declarations, and TypeScript path aliases.
  - Keep plugin compatibility behavior and CLI user experience unchanged.

- Updated dependencies
  - @nextclaw/core@0.4.8
