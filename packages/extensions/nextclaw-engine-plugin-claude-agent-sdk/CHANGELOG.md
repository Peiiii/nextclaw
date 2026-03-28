# @nextclaw/nextclaw-engine-claude-agent-sdk

## 0.3.8

### Patch Changes

- Publish the pending frontend UI batch together with the already-drifted public packages required by release guards.

## 0.3.7

### Patch Changes

- Make Claude engine and NCP runtime prompts bootstrap-aware so workspace context and requested skills are injected consistently, and refresh the shared chat UI tool/file cards to match the current tool lifecycle presentation.

## 0.3.6

### Patch Changes

- Ship the full set of current unreleased workspace package changes in one release batch, including the server/CLI updates already sitting in the working tree and the previously committed public package drift that has not been published yet. Republish the NCP agent runtime export surface so NextClaw can resolve `LocalAttachmentStore` after update, and add a release guard that blocks shipping public workspace dependents when a package has drifted past its published tag without a pending changeset.
- Updated dependencies
  - @nextclaw/core@0.11.2

## 0.3.5

### Patch Changes

- Disable the default 30s Claude request timeout for real chat turns so long-running Claude sessions are only stopped by explicit aborts or an explicitly configured `requestTimeoutMs`.

## 0.3.4

### Patch Changes

- Updated dependencies [bb891c2]
  - @nextclaw/core@0.11.0

## 0.3.3

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.10.0

## 0.3.2

### Patch Changes

- Republish all public workspace packages with pnpm publish guards so released manifests no longer retain workspace:\* dependencies and future npm publish misuse is blocked before release.
- Updated dependencies
  - @nextclaw/core@0.9.12

## 0.3.1

### Patch Changes

- Republish the core-linked package set so published consumers resolve the
  DisposableStore export from the updated @nextclaw/core release.
- Updated dependencies
  - @nextclaw/core@0.9.1

## 0.3.0

### Minor Changes

- Unify the latest NCP native chat chain, runtime capability assembly, chat UI alignment, stream/reasoning/tool fixes, and marketplace metadata publishing into a single minor release.

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.0

## 0.2.3

### Patch Changes

- Updated dependencies [eb9562b]
  - @nextclaw/core@0.8.0

## 0.2.2

### Patch Changes

- Publish merged PR changes and synchronize the runtime dependency chain for npm consumption.
  This release includes configurable search provider support and workspace development export alignment.
- Updated dependencies
  - @nextclaw/core@0.7.5

## 0.2.1

### Patch Changes

- Unified ecosystem release for accumulated chat runtime alignment, stop behavior hardening,
  frontend sticky autoscroll fixes, and package dependency consistency.
- Updated dependencies
  - @nextclaw/core@0.7.4

## 0.2.0

### Minor Changes

- Unified minor release for accumulated architecture, engine, and chat UX updates.

  Includes:
  - New pluggable engine runtime support (Codex SDK / Claude Agent SDK)
  - Skill-context propagation and chat interaction stability improvements
  - Main workspace routing and conversation UX refinements
  - Core/server/openclaw compatibility and release alignment updates

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.7.0
