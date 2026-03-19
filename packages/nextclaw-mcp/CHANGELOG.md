# @nextclaw/mcp

## 0.1.9

### Patch Changes

- Productize remote access in the built-in UI by shipping a dedicated Remote Access page, exposing the supporting server APIs, routing in-page managed-service restart through the shared self-restart coordinator so restart reliably relaunches the service instead of only stopping it, and keeping the required `@nextclaw/mcp` release group aligned with the updated server and CLI packages.

## 0.1.8

### Patch Changes

- Fix Claude readiness probing so working Anthropic-compatible routes are not marked unavailable by a probe-only USD budget cap, and improve local first-party plugin loading when running NextClaw from source.

## 0.1.7

### Patch Changes

- Publish the final host-adapter cleanup for the remote package split so the released nextclaw version matches the finalized repository state.

## 0.1.6

### Patch Changes

- Publish the remote runtime package split through fresh npm versions after the previously generated versions were already occupied on npm.

## 0.1.5

### Patch Changes

- Split the remote access runtime into a standalone `@nextclaw/remote` package and make `nextclaw` consume it through a thin host adapter.

## 0.1.4

### Patch Changes

- Fix Codex chat startup and plugin resolution when running NextClaw from source in dev mode.
  - prefer repo-local first-party plugins from `packages/extensions` when `NEXTCLAW_DEV_FIRST_PARTY_PLUGIN_DIR` is unset
  - avoid loading stale installed Codex runtime plugins from `~/.nextclaw/extensions` during source-mode smoke tests
  - keep the release group for `@nextclaw/mcp`, `@nextclaw/server`, and `nextclaw` in sync while shipping the Codex chat fix

- Updated dependencies
  - @nextclaw/core@0.9.5

## 0.1.3

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.4

## 0.1.2

### Patch Changes

- d1162f2: Recover the linked MCP/server/nextclaw release chain so marketplace MCP APIs ship together with their consumers.
- Updated dependencies [7e3aa0d]
  - @nextclaw/core@0.9.3

## 0.1.1

### Patch Changes

- Deliver live MCP hotplug updates for add, remove, enable, disable, and doctor flows without restart, and improve duplicate add feedback to avoid stack traces.
- Updated dependencies
  - @nextclaw/core@0.9.2
