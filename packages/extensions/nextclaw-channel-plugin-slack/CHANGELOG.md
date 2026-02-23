# @nextclaw/channel-plugin-slack

## 0.1.4

### Patch Changes

- Add Discord preview streaming config and runtime support while keeping channel plugin compatibility.
- Updated dependencies
  - @nextclaw/channel-runtime@0.1.15

## 0.1.3

### Patch Changes

- Fix agent tool-loop stalls by emitting a fallback reply after the max tool-iteration limit.
- Updated dependencies
  - @nextclaw/channel-runtime@0.1.14

## 0.1.2

### Patch Changes

- release: add WeCom channel support and harden dev runner port fallback.
  - add built-in WeCom channel runtime, plugin package, schema, UI fields and docs
  - add robust dev-runner port fallback to avoid API misrouting under port conflicts
  - publish linked package updates for runtime/plugin compatibility alignment

- Updated dependencies
  - @nextclaw/channel-runtime@0.1.7

## 0.1.1

### Patch Changes

- Complete final OpenClaw alignment by fully externalizing builtin channel runtime from core, moving extension packages into a dedicated extensions workspace path, and wiring channel plugins directly to runtime package.
- Updated dependencies
  - @nextclaw/channel-runtime@0.1.1
