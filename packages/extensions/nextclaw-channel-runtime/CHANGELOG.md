# @nextclaw/channel-runtime

## 0.1.5

### Patch Changes

- Align Discord outbound sending with OpenClaw-style chunking so long replies are split safely and no longer fail with Invalid Form Body.

## 0.1.4

### Patch Changes

- Adopt `<noreply/>` as the silent marker and stop reply/output processing when the marker appears. Cascade release all direct dependents of `@nextclaw/core` to keep internal versions aligned.
- Updated dependencies
  - @nextclaw/core@0.6.20

## 0.1.3

### Patch Changes

- Align internal dependency on `@nextclaw/core@^0.6.18` and publish dependent packages together.

## 0.1.2

### Patch Changes

- Fix channel typing lifecycle by introducing a class-based controller and auto-stop safeguards to prevent stale typing indicators when the AI does not reply.

## 0.1.1

### Patch Changes

- Complete final OpenClaw alignment by fully externalizing builtin channel runtime from core, moving extension packages into a dedicated extensions workspace path, and wiring channel plugins directly to runtime package.
- Updated dependencies
  - @nextclaw/core@0.6.17
