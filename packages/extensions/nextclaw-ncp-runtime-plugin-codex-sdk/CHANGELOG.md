# @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk

## 0.1.9

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.7

## 0.1.8

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.6

## 0.1.7

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.5

## 0.1.6

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.4

## 0.1.5

### Patch Changes

- Updated dependencies [7e3aa0d]
  - @nextclaw/core@0.9.3

## 0.1.4

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.2

## 0.1.3

### Patch Changes

- Republish the NCP-linked package set so published consumers resolve the
  latest NCP protocol/runtime exports used by the current NextClaw CLI build.
- Updated dependencies
  - @nextclaw/ncp@0.3.1
  - @nextclaw/ncp-toolkit@0.4.1
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.1

## 0.1.2

### Patch Changes

- Republish the core-linked package set so published consumers resolve the
  DisposableStore export from the updated @nextclaw/core release.
- Updated dependencies
  - @nextclaw/core@0.9.1

## 0.1.1

### Patch Changes

- Unify the latest NCP native chat chain improvements into a single release batch:
  - fix NCP streaming/state-manager promotion so tool-first assistant streams do not lose parts
  - align session type handling to stay generic outside the built-in native type
  - remove runtime-specific default-model branching and use a generic session-scoped fallback strategy
  - ship the latest NextClaw UI, server, and CLI cutover fixes together
  - republish direct dependents of `@nextclaw/ncp-toolkit` for version alignment

- Updated dependencies
  - @nextclaw/ncp-toolkit@0.4.0
