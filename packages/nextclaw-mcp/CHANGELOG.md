# @nextclaw/mcp

## 0.1.35

### Patch Changes

- Release the codex bridge fix so codex sessions can keep using the codex-sdk runtime with OpenAI-compatible models that only expose chat completions, including DashScope `qwen3-coder-next`.

## 0.1.34

### Patch Changes

- Align bundled Feishu support with the official OpenClaw plugin by vendoring the upstream Feishu plugin into NextClaw, teaching the compat loader to prefer plugin-local OpenClaw SDK resolution, and adding the minimal loader shims needed for the official Feishu tools to register inside NextClaw.

## 0.1.33

### Patch Changes

- Add the Phase 1 Feishu platform foundation for NextClaw, including shared Feishu core primitives, richer message conversion, multi-account routing, and the aligned config UI/runtime release chain.
- Updated dependencies
  - @nextclaw/core@0.10.0

## 0.1.32

### Patch Changes

- Raise remote connector exponential backoff to a 30 minute cap for non-terminal websocket failures so long outages generate fewer reconnect requests while terminal auth and configuration errors still stop immediately.

## 0.1.31

### Patch Changes

- Republish all public workspace packages with pnpm publish guards so released manifests no longer retain workspace:\* dependencies and future npm publish misuse is blocked before release.
- Updated dependencies
  - @nextclaw/core@0.9.12

## 0.1.30

### Patch Changes

- Republish alongside the Weixin host rollout so `@nextclaw/server` and `nextclaw` can release as one aligned package batch.

## 0.1.29

### Patch Changes

- Publish the transparent app transport boundary fix so local and remote streaming remain a true transport-only replacement.
  - keep SSE and multiplex adapters transport-only instead of interpreting upper-layer terminal events
  - preserve `final` as a normal streamed event while keeping `openStream().finished` stable
  - ship the repaired local chat UX and remote request-multiplex behavior in the released CLI/UI/runtime chain

## 0.1.28

### Patch Changes

- Republish the verified Weixin channel plugin release above already occupied npm versions so the published packages match the repository state that passed real QR login and real reply validation.
- Updated dependencies
  - @nextclaw/core@0.9.11

## 0.1.27

### Patch Changes

- Add the Weixin channel plugin with QR login, long-poll inbound handling, `context_token`-based reply delivery, and `accountId` routing across the shared host contracts.

  Expose plugin-aware `nextclaw channels login --channel weixin`, bundle the new Weixin plugin into the OpenClaw compatibility loader, and pass channel `accountId` through the message tool, cron, and service runtime so verified Weixin reply flows work end to end.

- Updated dependencies
  - @nextclaw/core@0.9.10

## 0.1.26

### Patch Changes

- Fix local UI runtime probe fallback so local NextClaw instances keep using local transport
  instead of breaking on `/_remote/runtime` HTML responses.
- Add the Weixin channel plugin with QR login, long-poll inbound handling, `context_token`-based reply delivery, and `accountId` routing across the shared host contracts.

  Expose plugin-aware `nextclaw channels login --channel weixin`, bundle the new Weixin plugin into the OpenClaw compatibility loader, and pass channel `accountId` through the message tool, cron, and service runtime so verified Weixin reply flows work end to end.

- Updated dependencies
  - @nextclaw/core@0.9.9

## 0.1.25

### Patch Changes

- Unify controlled UI requests under appClient, ship the updated built-in UI bundle,
  and keep the CLI release group aligned.

## 0.1.24

### Patch Changes

- Republish the finalized remote app transport multiplex implementation after maintainability refactors so the published packages match the verified runtime code.

## 0.1.23

### Patch Changes

- Add remote app transport multiplexing so the UI can switch from direct local transport to remote runtime transport, including browser-side remote requests, realtime event bridging, and streamed chat turns over the remote relay.

## 0.1.22

### Patch Changes

- Publish the remote instance registration compatibility fix so released CLI builds understand the new platform `instance` payload and registration route.

## 0.1.21

### Patch Changes

- 7795d61: Replace the UI API CORS middleware with an explicit implementation that avoids both `hono/cors` and the `HonoRequest.header()` hot path on long-running Node servers, while also preventing stale remote runtime state from reporting dead services as connected.

## 0.1.20

### Patch Changes

- Fix remote access token-expiry handling so expired platform sessions are no longer treated as logged in.

  The local remote runtime now fails fast on expired or malformed platform tokens, and remote doctor/status surfaces the real token state instead of only checking the `nca.` prefix.
  Republish the CLI release group packages for version alignment.

## 0.1.19

### Patch Changes

- Align the default NextClaw UI port to 55667 across core config, remote access, CLI runtime, UI fallbacks, Docker defaults, smoke scripts, and user-facing docs.
- Updated dependencies
  - @nextclaw/core@0.9.8

## 0.1.18

### Patch Changes

- Fix the first-run CLI init path so the built-in NextClaw provider stays disabled by default for fresh installs.

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
