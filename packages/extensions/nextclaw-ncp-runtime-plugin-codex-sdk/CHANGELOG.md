# @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk

## 0.1.21

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.11.1

## 0.1.20

### Patch Changes

- Bundle the published Codex runtime plugin entry so internal helper modules are always shipped with the installable package.

## 0.1.19

### Patch Changes

- Collapse the Codex runtime permission model into a single `accessMode` field, default it to `full-access`, and keep legacy `sandboxMode` only as a migration fallback.

## 0.1.18

### Patch Changes

- Updated dependencies [bb891c2]
  - @nextclaw/core@0.11.0

## 0.1.17

### Patch Changes

- 004b779: Stop surfacing Codex SDK non-fatal model metadata warnings as user-visible tool/error messages in codex sessions for OpenAI-compatible models such as DashScope `qwen3-coder-next`.
- Updated dependencies [004b779]
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.3

## 0.1.16

### Patch Changes

- Release the codex bridge fix so codex sessions can keep using the codex-sdk runtime with OpenAI-compatible models that only expose chat completions, including DashScope `qwen3-coder-next`.

## 0.1.15

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.10.0

## 0.1.14

### Patch Changes

- Republish all public workspace packages with pnpm publish guards so released manifests no longer retain workspace:\* dependencies and future npm publish misuse is blocked before release.
- Updated dependencies
  - @nextclaw/core@0.9.12
  - @nextclaw/ncp@0.3.2
  - @nextclaw/ncp-toolkit@0.4.2
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.2

## 0.1.13

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.11

## 0.1.12

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.10

## 0.1.11

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.9

## 0.1.10

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.8

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
