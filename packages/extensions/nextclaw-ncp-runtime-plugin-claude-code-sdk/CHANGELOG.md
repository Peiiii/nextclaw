# @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk

## 0.1.8

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.7

## 0.1.7

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.6

## 0.1.6

### Patch Changes

- Fix Claude readiness probing so working Anthropic-compatible routes are not marked unavailable by a probe-only USD budget cap, and improve local first-party plugin loading when running NextClaw from source.
- Updated dependencies
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.1.2

## 0.1.5

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.5

## 0.1.4

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.4

## 0.1.3

### Patch Changes

- Updated dependencies [7e3aa0d]
  - @nextclaw/core@0.9.3

## 0.1.2

### Patch Changes

- Sync the published plugin manifest version with the package version so `nextclaw plugins info` reports the installed Claude runtime plugin version correctly.

## 0.1.1

### Patch Changes

- Bundle the Claude runtime entry so published artifacts include all required local modules and the marketplace plugin can be installed successfully from npm.
- Updated dependencies
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.1.1

## 0.1.0

### Minor Changes

- Add the first Claude-backed NCP runtime and official plugin package so NextClaw can expose Claude sessions through the pluggable runtime registry and marketplace flow.

### Patch Changes

- Updated dependencies
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.1.0
