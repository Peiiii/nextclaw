# @nextclaw/runtime

## 0.2.7

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.7

## 0.2.6

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.6

## 0.2.5

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.5

## 0.2.4

### Patch Changes

- Fix npm packaging so publish tarballs always include built `dist` output, and republish the remote access dependency chain above the broken 0.13.2 release.
- Updated dependencies
  - @nextclaw/core@0.9.4

## 0.2.3

### Patch Changes

- 7e3aa0d: Guard OpenAI-compatible automatic `responses` fallback so DashScope models such as `qwen3-coder-next` stay on `chat/completions` instead of being misrouted to an unsupported API.
- Updated dependencies [7e3aa0d]
  - @nextclaw/core@0.9.3

## 0.2.2

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.2

## 0.2.1

### Patch Changes

- Republish the core-linked package set so published consumers resolve the
  DisposableStore export from the updated @nextclaw/core release.
- Updated dependencies
  - @nextclaw/core@0.9.1

## 0.2.0

### Minor Changes

- Unify the latest NCP native chat chain, runtime capability assembly, chat UI alignment, stream/reasoning/tool fixes, and marketplace metadata publishing into a single minor release.

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.0

## 0.1.7

### Patch Changes

- Updated dependencies [eb9562b]
  - @nextclaw/core@0.8.0

## 0.1.6

### Patch Changes

- Add model-level thinking capability configuration and session thinking selector with backend fallback alignment.
- Updated dependencies
  - @nextclaw/core@0.7.7

## 0.1.5

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.7.6

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
