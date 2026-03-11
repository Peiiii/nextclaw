# @nextclaw/runtime

## 0.1.4

### Patch Changes

- Publish merged PR changes and synchronize the runtime dependency chain for npm consumption.
  This release includes configurable search provider support and workspace development export alignment.
- Updated dependencies
  - @nextclaw/core@0.7.5

## 0.1.3

### Patch Changes

- Unified ecosystem release for accumulated chat runtime alignment, stop behavior hardening,
  frontend sticky autoscroll fixes, and package dependency consistency.
- Updated dependencies
  - @nextclaw/core@0.7.4

## 0.1.2

### Patch Changes

- Release core/runtime/server/CLI linkage updates for telegram streaming and subagent behavior fixes.
- Updated dependencies
  - @nextclaw/core@0.7.3

## 0.1.1

### Patch Changes

- Refactor provider and channel architecture with core registry mechanism and runtime assembly.
  - Move builtin provider catalog and builtin channel IDs out of core into `@nextclaw/runtime`.
  - Keep provider registry mechanisms in `@nextclaw/core` with injectable catalog support.
  - Update server/CLI to consume runtime-provided builtin provider/channel metadata.
  - Preserve out-of-box behavior for NextClaw provider bootstrap key generation.

- Updated dependencies
  - @nextclaw/core@0.7.1

## 0.1.0

- Initial runtime assembly package for builtin providers/channels.
