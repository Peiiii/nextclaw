# nextclaw-server

## 0.3.5

### Patch Changes

- Align OpenClaw plugin compatibility for channel runtime behavior.
  - Add channel messageToolHints resolution and inject hints into agent system prompt messaging guidance.
  - Forward plugin AccountId context through runtime bridge so channel/account-specific hints can resolve.
  - Improve OpenClaw channel integration path for ClawBay-compatible plugins and update docs/logs.

- Updated dependencies
  - @nextclaw/core@0.4.9
  - @nextclaw/openclaw-compat@0.1.2

## 0.3.4

### Patch Changes

- Unify internal package names under the `@nextclaw` scope while keeping the CLI package name as `nextclaw`.
  - Rename packages to `@nextclaw/core`, `@nextclaw/server`, and `@nextclaw/openclaw-compat`.
  - Update all workspace imports, dependency declarations, and TypeScript path aliases.
  - Keep plugin compatibility behavior and CLI user experience unchanged.

- Updated dependencies
  - @nextclaw/core@0.4.8
  - @nextclaw/openclaw-compat@0.1.1

## 0.3.3

### Patch Changes

- Align config schema + uiHints pipeline with OpenClaw-style mechanism, add schema API, and unify config redaction.
- Updated dependencies
  - nextclaw-core@0.4.5

## 0.3.2

### Patch Changes

- chore: tighten eslint line limits
- Updated dependencies
  - nextclaw-core@0.4.1

## 0.3.1

### Patch Changes

- Updated dependencies
  - nextclaw-core@0.4.0

## 0.3.0

### Minor Changes

- Add provider hot-reload support and wire_api configuration updates.

### Patch Changes

- Updated dependencies
  - nextclaw-core@0.3.0
