# @nextclaw/mcp

## 0.1.17

### Patch Changes

- Disable the built-in NextClaw provider by default on fresh installs so the seeded provider remains present but no longer starts in an enabled state before it is ready.
- Updated dependencies
  - @nextclaw/core@0.9.7

## 0.1.16

### Patch Changes

- Add an `enabled` switch for providers so disabled providers stay configured but are excluded from routing, model selection, and runtime diagnostics.

  Expose the provider enabled state through the server and UI config views, and show disabled providers clearly in the Providers page.

- Updated dependencies
  - @nextclaw/core@0.9.6

## 0.1.15

### Patch Changes

- Fix remote access to bind status and repair actions to the current UI process runtime instead of a stale managed service snapshot.

  Ensure `serve` and dev UI sessions start the remote runtime whenever the current process actually has UI enabled, even if `config.ui.enabled` is false.

## 0.1.14

### Patch Changes

- Align the remote access UI with the existing product style, remove leftover advanced controls from the main flow, expose the device list entry directly, and surface clearer disconnected hints.

## 0.1.13

### Patch Changes

- Refine remote access into a user-first NextClaw account flow, simplify the remote access page, and align the web console device copy with the new product path.

## 0.1.12

### Patch Changes

- Optimize remote relay cost behavior by removing connector heartbeat traffic and aligning the platform relay flow with hibernation-friendly online/session state semantics.

## 0.1.11

### Patch Changes

- Keep the `@nextclaw/mcp` / `@nextclaw/server` / `nextclaw` release group aligned while shipping the `nextclaw` UI static directory contract tightening.
  - `nextclaw`: remove implicit UI static directory fallbacks so the published CLI only serves the bundled `ui-dist` or an explicit `NEXTCLAW_UI_STATIC_DIR` override. Invalid overrides now fail fast with a non-zero exit instead of silently borrowing repo-local frontend artifacts from `cwd`.
  - `@nextclaw/mcp`: version-only companion release for release-group alignment.
  - `@nextclaw/server`: version-only companion release for release-group alignment.

## 0.1.10

### Patch Changes

- Add browser-based remote access platform authorization so users can log out and re-authorize from the UI without falling back to CLI password entry.

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
