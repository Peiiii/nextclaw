# nextclaw

## 0.14.2

### Patch Changes

- Release the codex bridge fix so codex sessions can keep using the codex-sdk runtime with OpenAI-compatible models that only expose chat completions, including DashScope `qwen3-coder-next`.
- Updated dependencies
  - @nextclaw/mcp@0.1.35
  - @nextclaw/server@0.10.39
  - @nextclaw/ncp-mcp@0.1.34
  - @nextclaw/remote@0.1.33

## 0.14.1

### Patch Changes

- Align bundled Feishu support with the official OpenClaw plugin by vendoring the upstream Feishu plugin into NextClaw, teaching the compat loader to prefer plugin-local OpenClaw SDK resolution, and adding the minimal loader shims needed for the official Feishu tools to register inside NextClaw.
- Updated dependencies
  - @nextclaw/openclaw-compat@0.3.20
  - @nextclaw/mcp@0.1.34
  - @nextclaw/server@0.10.38
  - @nextclaw/ncp-mcp@0.1.33
  - @nextclaw/remote@0.1.32

## 0.14.0

### Minor Changes

- Add the Phase 1 Feishu platform foundation for NextClaw, including shared Feishu core primitives, richer message conversion, multi-account routing, and the aligned config UI/runtime release chain.

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.10.0
  - @nextclaw/openclaw-compat@0.3.19
  - @nextclaw/mcp@0.1.33
  - @nextclaw/server@0.10.37
  - @nextclaw/remote@0.1.31
  - @nextclaw/runtime@0.2.13
  - @nextclaw/ncp-mcp@0.1.32

## 0.13.40

### Patch Changes

- Raise remote connector exponential backoff to a 30 minute cap for non-terminal websocket failures so long outages generate fewer reconnect requests while terminal auth and configuration errors still stop immediately.
- Updated dependencies
  - @nextclaw/remote@0.1.30
  - @nextclaw/mcp@0.1.32
  - @nextclaw/server@0.10.36
  - @nextclaw/ncp-mcp@0.1.31

## 0.13.39

### Patch Changes

- Republish all public workspace packages with pnpm publish guards so released manifests no longer retain workspace:\* dependencies and future npm publish misuse is blocked before release.
- Updated dependencies
  - @nextclaw/core@0.9.12
  - @nextclaw/mcp@0.1.31
  - @nextclaw/ncp@0.3.2
  - @nextclaw/ncp-agent-runtime@0.2.2
  - @nextclaw/ncp-mcp@0.1.30
  - @nextclaw/ncp-toolkit@0.4.2
  - @nextclaw/openclaw-compat@0.3.18
  - @nextclaw/remote@0.1.29
  - @nextclaw/runtime@0.2.12
  - @nextclaw/server@0.10.35

## 0.13.38

### Patch Changes

- @nextclaw/mcp@0.1.30
- @nextclaw/openclaw-compat@0.3.17
- @nextclaw/server@0.10.34
- @nextclaw/remote@0.1.28

## 0.13.37

### Patch Changes

- Stop unbounded remote websocket reconnect loops by classifying terminal handshake failures,
  backing off retry timing, halting after repeated failures, and preserving the registered
  device across reconnect attempts. Keep the CLI release group aligned with version-only
  companion releases for `@nextclaw/mcp` and `@nextclaw/server`.
- Updated dependencies
  - @nextclaw/remote@0.1.27
  - @nextclaw/mcp@0.1.29
  - @nextclaw/server@0.10.33
  - @nextclaw/ncp-mcp@0.1.29

## 0.13.36

### Patch Changes

- Republish the verified Weixin QR auth UI flow above already occupied npm versions so the published CLI and UI packages match the code that passed real smoke validation.
- Updated dependencies
  - @nextclaw/server@0.10.32
  - @nextclaw/remote@0.1.26

## 0.13.35

### Patch Changes

- Publish the transparent app transport boundary fix so local and remote streaming remain a true transport-only replacement.
  - keep SSE and multiplex adapters transport-only instead of interpreting upper-layer terminal events
  - preserve `final` as a normal streamed event while keeping `openStream().finished` stable
  - ship the repaired local chat UX and remote request-multiplex behavior in the released CLI/UI/runtime chain

- Updated dependencies
  - @nextclaw/mcp@0.1.26
  - @nextclaw/remote@0.1.22
  - @nextclaw/server@0.10.31
  - @nextclaw/ncp-mcp@0.1.26

## 0.13.34

### Patch Changes

- Republish NextClaw with the fixed UI server wiring so the Weixin channel appears in the Channels page in real service startup flows.

- Updated dependencies
  - @nextclaw/server@0.10.30

## 0.13.33

### Patch Changes

- Ship the frontend Weixin channel config entry in the bundled UI so installed NextClaw users can configure the personal Weixin plugin from the Channels page.

- Updated dependencies
  - @nextclaw/openclaw-compat@0.3.15
  - @nextclaw/server@0.10.29
  - @nextclaw/ui@0.9.14

## 0.13.32

### Patch Changes

- Republish the verified Weixin channel plugin release above already occupied npm versions so the published packages match the repository state that passed real QR login and real reply validation.
- Updated dependencies
  - @nextclaw/core@0.9.11
  - @nextclaw/openclaw-compat@0.3.14
  - @nextclaw/mcp@0.1.28
  - @nextclaw/server@0.10.28
  - @nextclaw/remote@0.1.24
  - @nextclaw/runtime@0.2.11
  - @nextclaw/ncp-mcp@0.1.28

## 0.13.31

### Patch Changes

- Add the Weixin channel plugin with QR login, long-poll inbound handling, `context_token`-based reply delivery, and `accountId` routing across the shared host contracts.

  Expose plugin-aware `nextclaw channels login --channel weixin`, bundle the new Weixin plugin into the OpenClaw compatibility loader, and pass channel `accountId` through the message tool, cron, and service runtime so verified Weixin reply flows work end to end.

- Updated dependencies
  - @nextclaw/core@0.9.10
  - @nextclaw/openclaw-compat@0.3.13
  - @nextclaw/mcp@0.1.27
  - @nextclaw/server@0.10.27
  - @nextclaw/remote@0.1.23
  - @nextclaw/runtime@0.2.10
  - @nextclaw/ncp-mcp@0.1.27

## 0.13.30

### Patch Changes

- Fix local UI runtime probe fallback so local NextClaw instances keep using local transport
  instead of breaking on `/_remote/runtime` HTML responses.
- Add the Weixin channel plugin with QR login, long-poll inbound handling, `context_token`-based reply delivery, and `accountId` routing across the shared host contracts.

  Expose plugin-aware `nextclaw channels login --channel weixin`, bundle the new Weixin plugin into the OpenClaw compatibility loader, and pass channel `accountId` through the message tool, cron, and service runtime so verified Weixin reply flows work end to end.

- Updated dependencies
- Updated dependencies
  - @nextclaw/mcp@0.1.26
  - @nextclaw/server@0.10.26
  - @nextclaw/core@0.9.9
  - @nextclaw/openclaw-compat@0.3.12
  - @nextclaw/ncp-mcp@0.1.26
  - @nextclaw/remote@0.1.22
  - @nextclaw/runtime@0.2.9

## 0.13.29

### Patch Changes

- Unify controlled UI requests under appClient, ship the updated built-in UI bundle,
  and keep the CLI release group aligned.
- Updated dependencies
  - @nextclaw/mcp@0.1.25
  - @nextclaw/server@0.10.25
  - @nextclaw/ncp-mcp@0.1.25
  - @nextclaw/remote@0.1.21

## 0.13.28

### Patch Changes

- Republish the finalized remote app transport multiplex implementation after maintainability refactors so the published packages match the verified runtime code.
- Updated dependencies
  - @nextclaw/remote@0.1.20
  - @nextclaw/mcp@0.1.24
  - @nextclaw/server@0.10.24
  - @nextclaw/ncp-mcp@0.1.24

## 0.13.27

### Patch Changes

- Add remote app transport multiplexing so the UI can switch from direct local transport to remote runtime transport, including browser-side remote requests, realtime event bridging, and streamed chat turns over the remote relay.
- Updated dependencies
  - @nextclaw/remote@0.1.19
  - @nextclaw/mcp@0.1.23
  - @nextclaw/server@0.10.23
  - @nextclaw/ncp-mcp@0.1.23

## 0.13.26

### Patch Changes

- Publish the remote instance registration compatibility fix so released CLI builds understand the new platform `instance` payload and registration route.
- Updated dependencies
  - @nextclaw/mcp@0.1.22
  - @nextclaw/remote@0.1.18
  - @nextclaw/server@0.10.22
  - @nextclaw/ncp-mcp@0.1.22

## 0.13.25

### Patch Changes

- 7795d61: Replace the UI API CORS middleware with an explicit implementation that avoids both `hono/cors` and the `HonoRequest.header()` hot path on long-running Node servers, while also preventing stale remote runtime state from reporting dead services as connected.
- Updated dependencies [7795d61]
  - @nextclaw/mcp@0.1.21
  - @nextclaw/server@0.10.21
  - @nextclaw/ncp-mcp@0.1.21
  - @nextclaw/remote@0.1.17

## 0.13.24

### Patch Changes

- Fix remote access token-expiry handling so expired platform sessions are no longer treated as logged in.

  The local remote runtime now fails fast on expired or malformed platform tokens, and remote doctor/status surfaces the real token state instead of only checking the `nca.` prefix.
  Republish the CLI release group packages for version alignment.

- Updated dependencies
  - @nextclaw/remote@0.1.16
  - @nextclaw/mcp@0.1.20
  - @nextclaw/server@0.10.20
  - @nextclaw/ncp-mcp@0.1.20

## 0.13.23

### Patch Changes

- Align the default NextClaw UI port to 55667 across core config, remote access, CLI runtime, UI fallbacks, Docker defaults, smoke scripts, and user-facing docs.
- Updated dependencies
  - @nextclaw/core@0.9.8
  - @nextclaw/remote@0.1.15
  - @nextclaw/mcp@0.1.19
  - @nextclaw/server@0.10.19
  - @nextclaw/openclaw-compat@0.3.11
  - @nextclaw/runtime@0.2.8
  - @nextclaw/ncp-mcp@0.1.19

## 0.13.22

### Patch Changes

- Fix the first-run CLI init path so the built-in NextClaw provider stays disabled by default for fresh installs.
- Updated dependencies
  - @nextclaw/server@0.10.18
  - @nextclaw/mcp@0.1.18
  - @nextclaw/remote@0.1.14
  - @nextclaw/ncp-mcp@0.1.18

## 0.13.21

### Patch Changes

- Disable the built-in NextClaw provider by default on fresh installs so the seeded provider remains present but no longer starts in an enabled state before it is ready.
- Updated dependencies
  - @nextclaw/core@0.9.7
  - @nextclaw/mcp@0.1.17
  - @nextclaw/server@0.10.17
  - @nextclaw/openclaw-compat@0.3.10
  - @nextclaw/remote@0.1.13
  - @nextclaw/runtime@0.2.7
  - @nextclaw/ncp-mcp@0.1.17

## 0.13.20

### Patch Changes

- Add an `enabled` switch for providers so disabled providers stay configured but are excluded from routing, model selection, and runtime diagnostics.

  Expose the provider enabled state through the server and UI config views, and show disabled providers clearly in the Providers page.

- Updated dependencies
  - @nextclaw/core@0.9.6
  - @nextclaw/mcp@0.1.16
  - @nextclaw/server@0.10.16
  - @nextclaw/openclaw-compat@0.3.9
  - @nextclaw/remote@0.1.12
  - @nextclaw/runtime@0.2.6
  - @nextclaw/ncp-mcp@0.1.16

## 0.13.19

### Patch Changes

- Fix remote access to bind status and repair actions to the current UI process runtime instead of a stale managed service snapshot.

  Ensure `serve` and dev UI sessions start the remote runtime whenever the current process actually has UI enabled, even if `config.ui.enabled` is false.

- Updated dependencies
  - @nextclaw/remote@0.1.11
  - @nextclaw/mcp@0.1.15
  - @nextclaw/server@0.10.15
  - @nextclaw/ncp-mcp@0.1.15

## 0.13.18

### Patch Changes

- Align the remote access UI with the existing product style, remove leftover advanced controls from the main flow, expose the device list entry directly, and surface clearer disconnected hints.
- Updated dependencies
  - @nextclaw/mcp@0.1.14
  - @nextclaw/server@0.10.14
  - @nextclaw/ncp-mcp@0.1.14
  - @nextclaw/remote@0.1.10

## 0.13.17

### Patch Changes

- Refine remote access into a user-first NextClaw account flow, simplify the remote access page, and align the web console device copy with the new product path.
- Updated dependencies
  - @nextclaw/mcp@0.1.13
  - @nextclaw/server@0.10.13
  - @nextclaw/ncp-mcp@0.1.13
  - @nextclaw/remote@0.1.9

## 0.13.16

### Patch Changes

- Optimize remote relay cost behavior by removing connector heartbeat traffic and aligning the platform relay flow with hibernation-friendly online/session state semantics.
- Updated dependencies
  - @nextclaw/mcp@0.1.12
  - @nextclaw/remote@0.1.8
  - @nextclaw/server@0.10.12
  - @nextclaw/ncp-mcp@0.1.12

## 0.13.15

### Patch Changes

- Keep the `@nextclaw/mcp` / `@nextclaw/server` / `nextclaw` release group aligned while shipping the `nextclaw` UI static directory contract tightening.
  - `nextclaw`: remove implicit UI static directory fallbacks so the published CLI only serves the bundled `ui-dist` or an explicit `NEXTCLAW_UI_STATIC_DIR` override. Invalid overrides now fail fast with a non-zero exit instead of silently borrowing repo-local frontend artifacts from `cwd`.
  - `@nextclaw/mcp`: version-only companion release for release-group alignment.
  - `@nextclaw/server`: version-only companion release for release-group alignment.

- Updated dependencies
  - @nextclaw/mcp@0.1.11
  - @nextclaw/server@0.10.11
  - @nextclaw/ncp-mcp@0.1.11
  - @nextclaw/remote@0.1.7

## 0.13.14

### Patch Changes

- Fix npm packaging for the built-in UI so published tarballs always include `ui-dist/index.html` and the generated `ui-dist/assets/*` bundle instead of silently shipping a partial frontend that renders `404 not found` after `nextclaw start`.
- Fail fast when the installed package does not contain the built-in UI bundle, so `nextclaw start` prints a clear recovery hint instead of starting a service that can only return a frontend 404.

## 0.13.10

### Patch Changes

- Add browser-based remote access platform authorization so users can log out and re-authorize from the UI without falling back to CLI password entry.
- Updated dependencies
  - @nextclaw/mcp@0.1.10
  - @nextclaw/server@0.10.10
  - @nextclaw/ncp-mcp@0.1.10
  - @nextclaw/remote@0.1.6

## 0.13.9

### Patch Changes

- Productize remote access in the built-in UI by shipping a dedicated Remote Access page, exposing the supporting server APIs, routing in-page managed-service restart through the shared self-restart coordinator so restart reliably relaunches the service instead of only stopping it, and keeping the required `@nextclaw/mcp` release group aligned with the updated server and CLI packages.
- Updated dependencies
  - @nextclaw/mcp@0.1.9
  - @nextclaw/server@0.10.9
  - @nextclaw/ncp-mcp@0.1.9
  - @nextclaw/remote@0.1.5

## 0.13.8

### Patch Changes

- Fix Claude readiness probing so working Anthropic-compatible routes are not marked unavailable by a probe-only USD budget cap, and improve local first-party plugin loading when running NextClaw from source.
- Updated dependencies
  - @nextclaw/mcp@0.1.8
  - @nextclaw/server@0.10.8
  - @nextclaw/ncp-mcp@0.1.8
  - @nextclaw/remote@0.1.4

## 0.13.7

### Patch Changes

- Publish the final host-adapter cleanup for the remote package split so the released nextclaw version matches the finalized repository state.
- Updated dependencies
  - @nextclaw/mcp@0.1.7
  - @nextclaw/server@0.10.7
  - @nextclaw/ncp-mcp@0.1.7
  - @nextclaw/remote@0.1.3

## 0.13.6

### Patch Changes

- Publish the remote runtime package split through fresh npm versions after the previously generated versions were already occupied on npm.
- Updated dependencies
  - @nextclaw/mcp@0.1.6
  - @nextclaw/server@0.10.6
  - @nextclaw/ncp-mcp@0.1.6
  - @nextclaw/remote@0.1.2

## 0.13.5

### Patch Changes

- Split the remote access runtime into a standalone `@nextclaw/remote` package and make `nextclaw` consume it through a thin host adapter.
- Updated dependencies
  - @nextclaw/mcp@0.1.5
  - @nextclaw/server@0.10.5
  - @nextclaw/ncp-mcp@0.1.5
  - @nextclaw/remote@0.1.1

## 0.13.4

### Patch Changes

- Fix Codex chat startup and plugin resolution when running NextClaw from source in dev mode.
  - prefer repo-local first-party plugins from `packages/extensions` when `NEXTCLAW_DEV_FIRST_PARTY_PLUGIN_DIR` is unset
  - avoid loading stale installed Codex runtime plugins from `~/.nextclaw/extensions` during source-mode smoke tests
  - keep the release group for `@nextclaw/mcp`, `@nextclaw/server`, and `nextclaw` in sync while shipping the Codex chat fix

- Add service-managed remote access configuration and CLI commands for NextClaw.
  - add `remote.enabled`, `remote.deviceName`, `remote.platformApiBase`, and `remote.autoReconnect` to the shared config schema
  - add `nextclaw remote enable|disable|status|doctor` and keep `remote connect` as foreground debug mode
  - run the remote connector inside the managed service lifecycle and surface remote state in `nextclaw status`
  - redact websocket relay tokens from service logs

- Updated dependencies
- Updated dependencies
  - @nextclaw/openclaw-compat@0.3.8
  - @nextclaw/mcp@0.1.4
  - @nextclaw/server@0.10.4
  - @nextclaw/core@0.9.5
  - @nextclaw/ncp-mcp@0.1.4
  - @nextclaw/runtime@0.2.5

## 0.13.3

### Patch Changes

- Fix npm packaging so publish tarballs always include built `dist` output, and republish the remote access dependency chain above the broken 0.13.2 release.
- Updated dependencies
  - @nextclaw/core@0.9.4
  - @nextclaw/runtime@0.2.4
  - @nextclaw/openclaw-compat@0.3.7
  - @nextclaw/server@0.10.3
  - @nextclaw/mcp@0.1.3
  - @nextclaw/ncp-mcp@0.1.3

## 0.13.2

### Patch Changes

- Republish the remote access CLI and local auth bridge above the broken 0.13.1 / 0.10.1 npm versions so global installs regain the `remote` command.
- Updated dependencies
  - @nextclaw/server@0.10.2

## 0.13.1

### Patch Changes

- d1162f2: Recover the linked MCP/server/nextclaw release chain so marketplace MCP APIs ship together with their consumers.
- Ship the remote access CLI and local auth bridge in a repaired npm release, and make platform api base parsing tolerate `/v` vs `/v1`.
- 7e3aa0d: Guard OpenAI-compatible automatic `responses` fallback so DashScope models such as `qwen3-coder-next` stay on `chat/completions` instead of being misrouted to an unsupported API.
- Updated dependencies [d1162f2]
- Updated dependencies
- Updated dependencies [7e3aa0d]
  - @nextclaw/mcp@0.1.2
  - @nextclaw/server@0.10.1
  - @nextclaw/core@0.9.3
  - @nextclaw/runtime@0.2.3
  - @nextclaw/ncp-mcp@0.1.2
  - @nextclaw/openclaw-compat@0.3.6

## 0.13.0

### Minor Changes

- Add lightweight remote access support with platform device registration, remote session relay, and trusted local UI auth bridging.

### Patch Changes

- Updated dependencies
  - @nextclaw/server@0.10.0

## 0.12.6

### Patch Changes

- Fix Codex chat model selection being overwritten by stale session hydration after the first send.

## 0.12.5

### Patch Changes

- Fix plugin hot-reload cache invalidation so upgraded Codex runtime plugins take effect without requiring a service restart.
- Updated dependencies
  - @nextclaw/openclaw-compat@0.3.5
  - @nextclaw/server@0.9.4

## 0.12.4

### Patch Changes

- Release the tokenized chat composer, IME fixes, and inline skill chip UI improvements.

## 0.12.3

### Patch Changes

- Deliver live MCP hotplug updates for add, remove, enable, disable, and doctor flows without restart, and improve duplicate add feedback to avoid stack traces.
- Updated dependencies
  - @nextclaw/core@0.9.2
  - @nextclaw/mcp@0.1.1
  - @nextclaw/openclaw-compat@0.3.4
  - @nextclaw/runtime@0.2.2
  - @nextclaw/server@0.9.3
  - @nextclaw/ncp-mcp@0.1.1

## 0.12.2

### Patch Changes

- Republish the NCP-linked package set so published consumers resolve the
  latest NCP protocol/runtime exports used by the current NextClaw CLI build.
- Updated dependencies
  - @nextclaw/ncp@0.3.1
  - @nextclaw/ncp-agent-runtime@0.2.1
  - @nextclaw/ncp-toolkit@0.4.1
  - @nextclaw/openclaw-compat@0.3.3
  - @nextclaw/server@0.9.2

## 0.12.1

### Patch Changes

- Republish the core-linked package set so published consumers resolve the
  DisposableStore export from the updated @nextclaw/core release.
- Updated dependencies
  - @nextclaw/core@0.9.1
  - @nextclaw/server@0.9.1
  - @nextclaw/openclaw-compat@0.3.2
  - @nextclaw/runtime@0.2.1

## 0.12.0

### Minor Changes

- Unify the latest NCP native chat chain improvements into a single release batch:
  - fix NCP streaming/state-manager promotion so tool-first assistant streams do not lose parts
  - align session type handling to stay generic outside the built-in native type
  - remove runtime-specific default-model branching and use a generic session-scoped fallback strategy
  - ship the latest NextClaw UI, server, and CLI cutover fixes together
  - republish direct dependents of `@nextclaw/ncp-toolkit` for version alignment

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp-toolkit@0.4.0
  - @nextclaw/server@0.9.0
  - @nextclaw/openclaw-compat@0.3.1

## 0.11.0

### Minor Changes

- Unify the latest NCP native chat chain, runtime capability assembly, chat UI alignment, stream/reasoning/tool fixes, and marketplace metadata publishing into a single minor release.

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.0
  - @nextclaw/ncp@0.3.0
  - @nextclaw/ncp-agent-runtime@0.2.0
  - @nextclaw/ncp-toolkit@0.3.0
  - @nextclaw/openclaw-compat@0.3.0
  - @nextclaw/runtime@0.2.0
  - @nextclaw/server@0.8.0

## 0.10.0

### Minor Changes

- eb9562b: Add lightweight built-in UI authentication for NextClaw UI with a single-admin setup flow, HttpOnly cookie sessions, protected API/WebSocket access, and a runtime Security panel.

### Patch Changes

- Updated dependencies [eb9562b]
  - @nextclaw/core@0.8.0
  - @nextclaw/server@0.7.0
  - @nextclaw/openclaw-compat@0.2.7
  - @nextclaw/runtime@0.1.7

## 0.9.28

### Patch Changes

- Fix marketplace skill install when a previous failed attempt leaves an empty or partial skill directory behind.

## 0.9.27

### Patch Changes

- Fix marketplace skill installation against the latest marketplace API by supporting inline `contentBase64` file payloads and keeping legacy blob download fallback.

## 0.9.26

### Patch Changes

- 63c7ab3: Refactor UI router into centralized route binding with modular controllers to improve maintainability and module role clarity.
- Updated dependencies [63c7ab3]
  - @nextclaw/server@0.6.13

## 0.9.25

### Patch Changes

- Updated dependencies
  - @nextclaw/server@0.6.12

## 0.9.24

### Patch Changes

- Add model-level thinking capability configuration and session thinking selector with backend fallback alignment.
- Updated dependencies
  - @nextclaw/core@0.7.7
  - @nextclaw/server@0.6.11
  - @nextclaw/runtime@0.1.6
  - @nextclaw/openclaw-compat@0.2.6

## 0.9.23

### Patch Changes

- fix tool-loop empty final response handling and improve error surfacing with bounded user-visible diagnostics.
- Updated dependencies
  - @nextclaw/core@0.7.6
  - @nextclaw/server@0.6.10
  - @nextclaw/openclaw-compat@0.2.5
  - @nextclaw/runtime@0.1.5

## 0.9.22

### Patch Changes

- Publish merged PR changes and synchronize the runtime dependency chain for npm consumption.
  This release includes configurable search provider support and workspace development export alignment.
- Updated dependencies
  - @nextclaw/core@0.7.5
  - @nextclaw/runtime@0.1.4
  - @nextclaw/openclaw-compat@0.2.4
  - @nextclaw/server@0.6.9

## 0.9.21

### Patch Changes

- Unified ecosystem release for accumulated chat runtime alignment, stop behavior hardening,
  frontend sticky autoscroll fixes, and package dependency consistency.
- Updated dependencies
  - @nextclaw/core@0.7.4
  - @nextclaw/openclaw-compat@0.2.3
  - @nextclaw/runtime@0.1.3
  - @nextclaw/server@0.6.8

## 0.9.20

### Patch Changes

- @nextclaw/openclaw-compat@0.2.2
- @nextclaw/server@0.6.7

## 0.9.19

### Patch Changes

- Improve CLI start diagnostics by surfacing startup failure context and richer health probe error details.

## 0.9.18

### Patch Changes

- Release core/runtime/server/CLI linkage updates for telegram streaming and subagent behavior fixes.
- Updated dependencies
  - @nextclaw/core@0.7.3
  - @nextclaw/runtime@0.1.2
  - @nextclaw/openclaw-compat@0.2.1
  - @nextclaw/server@0.6.6

## 0.9.17

### Patch Changes

- Release frontend UI changes only.

## 0.9.16

### Patch Changes

- Fix marketplace skill install status sync when installing via running service API.

  This patch fixes the packaged CLI subcommand entry resolution so service-driven installs execute the real CLI entry,
  avoiding false-success responses where UI showed "installed" message but state/file were unchanged.

## 0.9.15

### Patch Changes

- Switch skill distribution to marketplace-first flow and remove GitHub-based skill install paths.

  This release includes:
  - skill/plugin model clean split (skill: `builtin` + `marketplace` only)
  - marketplace API migration from bundled JSON to D1-backed source
  - CLI support for marketplace skill upload/update/install
  - UI and server integration updates for marketplace data, install behavior, and user-facing error messaging

- Updated dependencies
  - @nextclaw/core@0.7.2
  - @nextclaw/server@0.6.5

## 0.9.14

### Patch Changes

- Release frontend UI changes only.

## 0.9.13

### Patch Changes

- Publish marketplace skill install reliability improvements:
  - Add GitHub HTTP fallback when `git` is unavailable (e.g. Windows without Git in PATH).
  - Keep marketplace git-skill install target under NextClaw workspace `skills/` only.
  - Align diagnostics/status guidance with explicit `nextclaw --version` usage.

## 0.9.12

### Patch Changes

- Add a GitHub HTTP fallback for marketplace git skill installs when git is unavailable.

## 0.9.11

### Patch Changes

- Replace marketplace git skill installation with a native NextClaw installer that writes only to the NextClaw skills directory.

## 0.9.10

### Patch Changes

- Expose the NextClaw product version via app metadata and display it in the UI sidebar brand header.
- Updated dependencies
  - @nextclaw/server@0.6.4

## 0.9.9

### Patch Changes

- Refactor provider and channel architecture with core registry mechanism and runtime assembly.
  - Move builtin provider catalog and builtin channel IDs out of core into `@nextclaw/runtime`.
  - Keep provider registry mechanisms in `@nextclaw/core` with injectable catalog support.
  - Update server/CLI to consume runtime-provided builtin provider/channel metadata.
  - Preserve out-of-box behavior for NextClaw provider bootstrap key generation.

- Updated dependencies
  - @nextclaw/core@0.7.1
  - @nextclaw/runtime@0.1.1
  - @nextclaw/server@0.6.3

## 0.9.8

### Patch Changes

- Release frontend UI changes only.

## 0.9.7

### Patch Changes

- Release frontend UI changes only.

## 0.9.6

### Patch Changes

- Polish chat UI loading and conversation interaction behaviors, and ship updated built-in UI assets.

## 0.9.5

### Patch Changes

- Retry publish with fresh patch versions after reserved-version conflict on npm.
- Updated dependencies
  - @nextclaw/server@0.6.2

## 0.9.4

### Patch Changes

- Introduce backend-managed chat run source of truth with reconnectable run streams, and restore in-progress run state when reopening chat sessions.
- Updated dependencies
  - @nextclaw/server@0.6.1

## 0.9.3

### Patch Changes

- chore(release): republish service-start readiness timeout fix with a new patch version

## 0.9.2

### Patch Changes

- fix(start): avoid premature background service failure on slow startup by extending readiness wait across platforms

## 0.9.1

### Patch Changes

- Release frontend UI changes only.

## 0.9.0

### Minor Changes

- Unified minor release for accumulated architecture, engine, and chat UX updates.

  Includes:
  - New pluggable engine runtime support (Codex SDK / Claude Agent SDK)
  - Skill-context propagation and chat interaction stability improvements
  - Main workspace routing and conversation UX refinements
  - Core/server/openclaw compatibility and release alignment updates

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.7.0
  - @nextclaw/openclaw-compat@0.2.0
  - @nextclaw/server@0.6.0

## 0.8.62

### Patch Changes

- Release frontend UI changes only.

## 0.8.61

### Patch Changes

- Release frontend UI changes only.

## 0.8.60

### Patch Changes

- Release frontend UI changes only.

## 0.8.59

### Patch Changes

- Release frontend UI changes only.

## 0.8.58

### Patch Changes

- Release runtime/session fixes and frontend configuration improvements together.
  - fix session persistence across non-streaming/runtime paths
  - stabilize Feishu conversation routing
  - include frontend max-token optimization and related config UX updates
  - republish dependent channel/plugin packages for version consistency

- Updated dependencies
  - @nextclaw/core@0.6.45
  - @nextclaw/openclaw-compat@0.1.34
  - @nextclaw/server@0.5.30

## 0.8.57

### Patch Changes

- - fix provider connection test probe to use `maxTokens >= 16`, avoiding OpenAI-compatible gateway errors that reject values below 16.
  - add regression coverage for provider test route to assert probe maxTokens lower bound.
  - include latest UI updates in this release batch.
- Updated dependencies
  - @nextclaw/server@0.5.29

## 0.8.56

### Patch Changes

- - ui: refine provider config form layout (display name in primary section, Wire API Mode in advanced settings), plus related input rendering polish.
  - cli: fix Windows self-update strategy detection by supporting PATH/PATHEXT executable resolution and platform-aware update command shell execution.
  - docs: add iteration logs for provider advanced layout and Windows update strategy fix.

## 0.8.55

### Patch Changes

- release all pending changes including dynamic custom provider management, custom provider model prefix stripping before upstream calls, and marketplace source link wrapping fix in detail cards.
- Updated dependencies
  - @nextclaw/core@0.6.44
  - @nextclaw/server@0.5.28
  - @nextclaw/openclaw-compat@0.1.33

## 0.8.54

### Patch Changes

- support dynamic custom providers with add/edit/delete workflow, ensure custom provider test model selection is provider-scoped, and strip only the provider routing prefix before upstream OpenAI-compatible API calls.
- Updated dependencies
  - @nextclaw/core@0.6.43
  - @nextclaw/server@0.5.27
  - @nextclaw/openclaw-compat@0.1.32

## 0.8.53

### Patch Changes

- Align MiniMax default API base to the CN endpoint and add clear region-specific guidance in provider settings.
- Updated dependencies
  - @nextclaw/core@0.6.42
  - @nextclaw/server@0.5.26
  - @nextclaw/openclaw-compat@0.1.31

## 0.8.52

### Patch Changes

- Release frontend UI changes only.

## 0.8.51

### Patch Changes

- e196f45: Align Telegram ack reaction behavior with OpenClaw by adding `channels.telegram.ackReactionScope` and `channels.telegram.ackReaction`, defaulting to `all` and `👀`. Telegram inbound processing now sends an acknowledgment reaction before dispatch when scope rules match.
- Updated dependencies [e196f45]
  - @nextclaw/core@0.6.40

## 0.8.50

### Patch Changes

- Release frontend UI changes only.

## 0.8.49

### Patch Changes

- Align channel configuration UX with provider page paradigm and fix logo badge consistency.
  - Switch Channels page to a provider-style two-pane workflow with list/filter on the left and persistent form on the right.
  - Fix hook ordering in `ChannelsList` to avoid render-time hook count mismatch.
  - Enforce stable logo badge sizing (`shrink-0`, overflow handling) so provider/channel icons keep consistent frame size.
  - Restrict channel tutorial links to dedicated docs only (currently Feishu).

- Updated dependencies
  - @nextclaw/server@0.5.25

## 0.8.48

### Patch Changes

- Add channel tutorial metadata and expose in the UI with localized links.
  - Add a Tutorials module to docs (EN/ZH) and include a dedicated Feishu setup page.
  - Extend config meta channel spec with `tutorialUrls` (`default/en/zh`) while keeping `tutorialUrl` for compatibility.
  - Resolve localized tutorial URLs in UI and show guide entry points on channel cards and channel config modal headers.

- Updated dependencies
  - @nextclaw/server@0.5.24

## 0.8.47

### Patch Changes

- Refresh provider default model catalogs to latest-generation options, improve provider/model selection UX, and align config model list behaviors.
- Updated dependencies
  - @nextclaw/core@0.6.39
  - @nextclaw/openclaw-compat@0.1.30
  - @nextclaw/server@0.5.23

## 0.8.46

### Patch Changes

- Release frontend UI changes only.

## 0.8.45

### Patch Changes

- Hotfix publish to ensure provider test route is available in npm runtime.
- Updated dependencies
  - @nextclaw/server@0.5.22

## 0.8.44

### Patch Changes

- Release frontend UI changes only.

## 0.8.43

### Patch Changes

- eb6446f: Fix provider list icon consistency by enforcing a fixed logo size in the UI.

## 0.8.42

### Patch Changes

- Fix provider API base routing for non-gateway providers and upgrade providers configuration UX in UI.
- Updated dependencies
  - @nextclaw/core@0.6.38
  - @nextclaw/openclaw-compat@0.1.29
  - @nextclaw/server@0.5.21

## 0.8.41

### Patch Changes

- fix chat stream terminal handling and remove end-of-stream typing flicker.

## 0.8.40

### Patch Changes

- Introduce event-backed chat storage and event-sequence rendering for UI chat:
  - persist session events (single-write) and project legacy messages from events
  - stream `session_event` frames alongside text deltas in chat SSE
  - render chat by ordered event timeline, merging tool call/result/follow-up in one assistant flow card
  - keep true streaming text while preserving event-order semantics

- Updated dependencies
  - @nextclaw/core@0.6.37
  - @nextclaw/server@0.5.20

## 0.8.39

### Patch Changes

- Release frontend UI changes only.

## 0.8.38

### Patch Changes

- Release frontend UI changes only.

## 0.8.37

### Patch Changes

- Release frontend UI changes only.

## 0.8.36

### Patch Changes

- Add real chat streaming pipeline from provider to UI via SSE and remove simulated frontend streaming.
- Updated dependencies
  - @nextclaw/core@0.6.36
  - @nextclaw/server@0.5.19

## 0.8.35

### Patch Changes

- Release frontend UI changes only.

## 0.8.34

### Patch Changes

- feat: add secrets command suite and ui management panel
  - add `nextclaw secrets audit/configure/apply/reload` with config-aware validation and reload planning
  - add ui secrets panel for editing `secrets.enabled/defaults/providers/refs`
  - add ui api endpoint `PUT /api/config/secrets` and full client hook/types integration
  - document secrets commands in en/zh command guides

- Updated dependencies
  - @nextclaw/core@0.6.35
  - @nextclaw/server@0.5.18

## 0.8.33

### Patch Changes

- Upgrade UI chat experience with markdown rendering, structured tool cards, and grouped message display.
- Updated dependencies
  - @nextclaw/server@0.5.17

## 0.8.32

### Patch Changes

- Add built-in Agent chat support in UI with a new chat page, session management, and a backend chat turn API wired to runtime pool.
- Updated dependencies
  - @nextclaw/server@0.5.16

## 0.8.31

### Patch Changes

- Add a built-in `nextclaw-skill-resource-hub` skill to curate NextClaw-first skill ecosystem resources, including OpenClaw and community sources.
- Updated dependencies
  - @nextclaw/core@0.6.34
  - @nextclaw/openclaw-compat@0.1.28
  - @nextclaw/server@0.5.15

## 0.8.30

### Patch Changes

- Raise the default `agents.defaults.maxToolIterations` from 20 to 1000 to reduce premature tool-loop fallback responses in long tool chains.
- Updated dependencies
  - @nextclaw/core@0.6.33
  - @nextclaw/openclaw-compat@0.1.27
  - @nextclaw/server@0.5.14

## 0.8.29

### Patch Changes

- fix marketplace skill reinstall flow when skild --json returns null after prior local install state; add force retry and uninstall cleanup for .agents mirror.

## 0.8.28

### Patch Changes

- feat(marketplace): support git skill install via skild with explicit skill/path parameters
  - route marketplace git skills through `npx skild install`
  - pass `skill` and `installPath` from UI -> server -> installer
  - allow git-type skills in marketplace skills list

- Updated dependencies
  - @nextclaw/server@0.5.13

## 0.8.27

### Patch Changes

- Fix embedded docs browser locale routing so docs open under the current UI language locale.

## 0.8.26

### Patch Changes

- Split marketplace plugins and skills across all layers, including typed worker routes, typed server proxy routes, and typed UI API clients.
- Updated dependencies
  - @nextclaw/server@0.5.12

## 0.8.25

### Patch Changes

- refine marketplace module separation and module-specific copy for plugins and skills

## 0.8.24

### Patch Changes

- split marketplace data and routes by type, separating plugins and skills endpoints end-to-end
- Updated dependencies
  - @nextclaw/server@0.5.11

## 0.8.23

### Patch Changes

- refactor marketplace tabs to use top-level plugins/skills routing with scope sub-tabs

## 0.8.22

### Patch Changes

- Enable gzip compression for built-in UI static assets and improve slow-network loading behavior.
- Updated dependencies
  - @nextclaw/server@0.5.10

## 0.8.21

### Patch Changes

- Release frontend UI changes only.

## 0.8.20

### Patch Changes

- Release frontend UI changes only.

## 0.8.19

### Patch Changes

- Release frontend UI changes only.

## 0.8.18

### Patch Changes

- Release frontend UI changes only.

## 0.8.17

### Patch Changes

- Release frontend UI changes only.

## 0.8.16

### Patch Changes

- Release frontend UI changes only.

## 0.8.15

### Patch Changes

- Refresh UI layout, components, and styling for the config pages.

## 0.8.14

### Patch Changes

- fix: defer Discord slash command replies to avoid interaction timeouts
- Updated dependencies
  - @nextclaw/openclaw-compat@0.1.26
  - @nextclaw/server@0.5.9

## 0.8.13

### Patch Changes

- Sync NextClaw packages with updated core and channel runtime versions.
- Updated dependencies
  - @nextclaw/openclaw-compat@0.1.25
  - @nextclaw/server@0.5.8

## 0.8.12

### Patch Changes

- Add Discord preview streaming config and runtime support while keeping channel plugin compatibility.
- Updated dependencies
  - @nextclaw/core@0.6.31
  - @nextclaw/openclaw-compat@0.1.24
  - @nextclaw/server@0.5.7

## 0.8.11

### Patch Changes

- Add cron management UI with list/enable/disable/run/delete actions and corresponding server API endpoints.
- Add Discord preview streaming config and runtime support while keeping channel plugin compatibility.
- Updated dependencies
- Updated dependencies
  - @nextclaw/server@0.5.6
  - @nextclaw/core@0.6.30
  - @nextclaw/openclaw-compat@0.1.23

## 0.8.10

### Patch Changes

- Fix agent tool-loop stalls by emitting a fallback reply after the max tool-iteration limit.
- UI: add cron management page with view/enable/disable/run/delete actions.
- Updated dependencies
  - @nextclaw/core@0.6.29
  - @nextclaw/server@0.5.5
  - @nextclaw/openclaw-compat@0.1.22

## 0.8.9

### Patch Changes

- UI: add confirm dialog flow for destructive actions; Server: allow marketplace manage to resolve plugin id from spec fallback.
- Updated dependencies
  - @nextclaw/server@0.5.4

## 0.8.8

### Patch Changes

- fix: sync marketplace toggle state and refresh list data after manage actions

## 0.8.7

### Patch Changes

- Limit config reload watcher to the config file to avoid exhausting file watchers.

## 0.8.6

### Patch Changes

- - refresh bundled ui-dist for tooltip portal and marketplace card polish

## 0.8.5

### Patch Changes

- Fix plugin hot-plug behavior so disabling bundled channel plugins (like Discord) takes effect immediately and enabling restores runtime behavior.

  Also normalize marketplace manage targets from canonical npm specs to real plugin IDs and harden config reload watching for first-time config file creation.

- Updated dependencies
  - @nextclaw/openclaw-compat@0.1.21
  - @nextclaw/server@0.5.3

## 0.8.4

### Patch Changes

- fix SkillsLoader import crash during update/restart startup.
  - avoid static named import of `SkillsLoader` in runtime-critical paths
  - gracefully handle missing runtime export to prevent ESM load-time crash
  - make core export of `SkillsLoader` explicit for release safety

- Updated dependencies
  - @nextclaw/core@0.6.28
  - @nextclaw/server@0.5.2

## 0.8.3

### Patch Changes

- unify marketplace plugin identity to canonical channel npm specs and switch default marketplace api base to marketplace-api.nextclaw.io
- Updated dependencies
  - @nextclaw/server@0.5.1

## 0.8.2

### Patch Changes

- switch DocBrowser docs domain to docs.nextclaw.io and remove legacy pages.dev fallback

## 0.8.1

### Patch Changes

- fix(ui): refine floating doc browser resize axis handling
  - support axis-aware floating resize behavior
  - keep width unchanged when dragging vertical-only handle
  - keep height unchanged when dragging horizontal-only handle

## 0.8.0

### Minor Changes

- feat(ui): improve embedded docs browser route sync and link handling
  - sync DocBrowser URL with in-iframe docs route changes
  - avoid intercepting explicitly external doc links
  - refine doc browser URL input UX and labels
  - refresh bundled `nextclaw` ui-dist with latest UI behavior

## 0.7.0

### Minor Changes

- feat(release): promote marketplace milestone to minor version bump
  - reclassify the recent marketplace integration as feature-level release
  - align package versions with semver minor progression
  - keep release coverage across cli, server and ui packages

### Patch Changes

- Updated dependencies
  - @nextclaw/server@0.5.0

## 0.6.36

### Patch Changes

- feat(marketplace): add VSCode-style marketplace with installed state and install integration
  - add marketplace query/install API on UI server
  - connect install actions to existing CLI plugin/skill install commands
  - add marketplace frontend page with search, filters, recommendations, and installed tab
  - add installed-status API and UI badges/button states for installed items

- Updated dependencies
  - @nextclaw/server@0.4.17

## 0.6.35

### Patch Changes

- fix: bridge plugin runtime config in CLI agent path so channel-owned tools read plugin config correctly

## 0.6.34

### Patch Changes

- feat: hot-apply plugin config changes without restarting the gateway process.
  - treat `plugins.*` as reloadable config paths
  - hot-reload plugin registry / plugin channel gateways / channel manager in-place
  - apply plugin extension registry updates to agent runtime pool
  - make `plugins` CLI install/enable/disable/uninstall default to hot-apply messaging
  - update usage docs with plugin hot-reload behavior

- Updated dependencies
  - @nextclaw/core@0.6.27
  - @nextclaw/openclaw-compat@0.1.20
  - @nextclaw/server@0.4.16

## 0.6.33

### Patch Changes

- fix: prevent broken historical tool-call chains from causing provider 400 in long-running Discord multi-agent sessions.
  - sanitize stale `assistant(tool_calls)` + `tool` history pairs before provider requests
  - preserve active trailing tool-call chain semantics
  - reduce INVALID_ARGUMENT failures after context-budget pruning

- Updated dependencies
  - @nextclaw/core@0.6.26
  - @nextclaw/openclaw-compat@0.1.19
  - @nextclaw/server@0.4.15

## 0.6.32

### Patch Changes

- Add strict dmScope enum guardrails in docs and runtime context prompts, and align AI config-write flow with schema-first patching.
- Updated dependencies
  - @nextclaw/core@0.6.25
  - @nextclaw/server@0.4.14
  - @nextclaw/openclaw-compat@0.1.18

## 0.6.31

### Patch Changes

- Fix Model page maxTokens persistence by wiring maxTokens through UI save API and server config update.
- Updated dependencies
  - @nextclaw/server@0.4.13

## 0.6.30

### Patch Changes

- Add session channel grouping modes (all/by-channel) and complete Sessions i18n labels.

## 0.6.29

### Patch Changes

- Add full session management in NextClaw UI with OpenClaw-aligned capabilities.
  - add Sessions tab with filtering, history inspection, metadata patching, clear, and delete
  - add UI API endpoints for sessions list/history/patch/delete
  - sync frontend/server types and hooks for session operations
  - update usage guide for session management UI

- Updated dependencies
  - @nextclaw/server@0.4.12

## 0.6.28

### Patch Changes

- Add full UI/runtime API support for configuring input context token budgets.
  - Runtime page supports `agents.defaults.contextTokens`
  - Runtime page supports per-agent `agents.list[*].contextTokens`
  - Runtime API persists default context token budget updates
  - Usage docs updated for UI configuration path

- Updated dependencies
  - @nextclaw/server@0.4.11

## 0.6.27

### Patch Changes

- Align input-context handling with an OpenClaw-style token-budget pruner.
  - add unified input budget pruning in agent and subagent loops
  - support `agents.defaults.contextTokens` and per-agent `contextTokens` overrides
  - hot-reload context token budget updates
  - document configuration and multi-agent usage updates

- Updated dependencies
  - @nextclaw/core@0.6.24
  - @nextclaw/openclaw-compat@0.1.17
  - @nextclaw/server@0.4.10

## 0.6.26

### Patch Changes

- Align Discord/Telegram typing lifecycle with OpenClaw-style run completion cleanup.
  - Add typing-stop control message in core bus for no-reply paths.
  - Route control messages through ChannelManager without normal outbound delivery.
  - Keep typing active during agent processing and stop via outbound/control events.
  - Improve typing heartbeat/TTL defaults for long-running replies.

- Updated dependencies
  - @nextclaw/core@0.6.23
  - @nextclaw/openclaw-compat@0.1.16
  - @nextclaw/server@0.4.9

## 0.6.25

### Patch Changes

- Improve `nextclaw update` UX by showing explicit version progress.
  - Print current version before running update.
  - Print either `Version updated: <from> -> <to>` or `Version unchanged: <version>` after update.
  - Include `version.before/after/changed` in gateway `update.run` results.

## 0.6.24

### Patch Changes

- Align UI routing/runtime configuration with OpenClaw capabilities.
  - Add runtime config API and editor for `agents.list`, `bindings`, and `session` controls.
  - Add ChannelForm fields for Discord/Telegram routing and mention policy settings.
  - Expose runtime settings safely in public config view and wire UI navigation for runtime management.

- Updated dependencies
  - @nextclaw/server@0.4.8

## 0.6.23

### Patch Changes

- Align multi-agent gateway capabilities with OpenClaw:
  - add bindings-based route resolver and agent runtime pool
  - add agents.list multi-runtime support in gateway service
  - add session.dmScope based session key isolation (including per-account-channel-peer)
  - add agentToAgent.maxPingPongTurns enforcement in sessions_send
  - complete Discord and Telegram policy parity (dmPolicy/groupPolicy/mention gates/account metadata)

- Updated dependencies
  - @nextclaw/core@0.6.22
  - @nextclaw/openclaw-compat@0.1.15
  - @nextclaw/server@0.4.7

## 0.6.22

### Patch Changes

- release: add WeCom channel support and harden dev runner port fallback.
  - add built-in WeCom channel runtime, plugin package, schema, UI fields and docs
  - add robust dev-runner port fallback to avoid API misrouting under port conflicts
  - publish linked package updates for runtime/plugin compatibility alignment

- Updated dependencies
  - @nextclaw/core@0.6.21
  - @nextclaw/openclaw-compat@0.1.14
  - @nextclaw/server@0.4.6

## 0.6.21

### Patch Changes

- Stop channel typing indicators immediately after inbound processing completes (including no-reply paths like <noreply/>), instead of waiting for auto-stop timeout.
- Updated dependencies
  - @nextclaw/openclaw-compat@0.1.13

## 0.6.20

### Patch Changes

- Follow-up linkage release after @nextclaw/channel-runtime@0.1.5 so downstream installs consume the Discord outbound chunking fix consistently.
- Updated dependencies
  - @nextclaw/openclaw-compat@0.1.12

## 0.6.19

### Patch Changes

- Adopt `<noreply/>` as the silent marker and stop reply/output processing when the marker appears. Cascade release all direct dependents of `@nextclaw/core` to keep internal versions aligned.
- Updated dependencies
  - @nextclaw/core@0.6.20
  - @nextclaw/openclaw-compat@0.1.11
  - @nextclaw/server@0.4.5

## 0.6.18

### Patch Changes

- Remove configurable temperature and stop forwarding temperature in runtime provider requests.
  - Remove `agents.defaults.temperature` from config schema and reload rules.
  - Remove temperature propagation across agent loop, subagent manager, and provider manager.
  - Stop sending `temperature` to OpenAI-compatible provider payloads.
  - Remove temperature field/control from UI model configuration and API types.

- Updated dependencies
  - @nextclaw/core@0.6.19
  - @nextclaw/server@0.4.4

## 0.6.17

### Patch Changes

- Align internal dependency on `@nextclaw/core@^0.6.18` and publish dependent packages together.
- Updated dependencies
  - @nextclaw/openclaw-compat@0.1.10
  - @nextclaw/server@0.4.3

## 0.6.16

### Patch Changes

- Align built-in channel loading with OpenClaw-style plugin registration by splitting bundled channel definitions, routing bundled channels through register(api), and keeping channel runtime purely plugin-registry driven.
- Updated dependencies
  - @nextclaw/core@0.6.16
  - @nextclaw/openclaw-compat@0.1.6

## 0.6.15

### Patch Changes

- Harden OpenRouter/Qwen tool call parsing compatibility in OpenAI-compatible provider while keeping wireApi behavior unchanged.
- Updated dependencies
  - @nextclaw/core@0.6.15

## 0.6.14

### Patch Changes

- Improve OpenAI-compatible provider reliability for intermittent gateway failures without changing `wireApi` strategy semantics.
- Updated dependencies
  - @nextclaw/core@0.6.14

## 0.6.13

### Patch Changes

- Switch restart completion notice from fixed text to AI-generated reply:
  - on startup, consume restart sentinel and publish a system inbound message to wake the agent;
  - keep routing via sentinel/session delivery context and let the model generate the final user-facing confirmation;
  - remove direct fixed-message delivery path for restart wake.
- Updated dependencies
  - @nextclaw/core@0.6.11

## 0.6.12

### Patch Changes

- Fix restart self-reply reliability when the assistant restarts itself:
  - forward runtime session context into `gateway.restart` and persist restart sentinel for restart action;
  - propagate session/channel/chat context through `exec` tool environment;
  - write restart sentinel in CLI restart path when invoked from agent exec context.
- Updated dependencies
  - @nextclaw/core@0.6.10

## 0.6.11

### Patch Changes

- Harden restart sentinel delivery for Discord and long-running sessions:
  - trim oversized restart reason/note/system message to avoid channel hard-limit failures;
  - fallback to the most recent routable non-CLI session when `sessionKey` is missing;
  - keep deterministic post-restart notice behavior with the existing pending-system-event fallback.

## 0.6.10

### Patch Changes

- Align restart-sentinel notification delivery with the unified channel dispatch path.
  - add `ChannelManager.deliver()` for observable one-shot outbound delivery
  - make restart wake notification use `channels.deliver()` instead of queue-only enqueue
  - keep retry + reply fallback (drop reply target when platform rejects it)
  - preserve `pending_system_events` fallback when delivery remains unavailable

- Updated dependencies
  - @nextclaw/core@0.6.9

## 0.6.9

### Patch Changes

- Add OpenClaw-parity restart sentinel flow for gateway-triggered restarts:
  - persist restart sentinel before `config.apply`, `config.patch`, and `update.run`
  - auto-ping the last active session after restart using captured delivery context
  - fallback to queued session system events when immediate delivery is unavailable
  - auto-infer `sessionKey` in gateway tool context and document updated behavior

- Updated dependencies
  - @nextclaw/core@0.6.8

## 0.6.8

### Patch Changes

- Align media ingress protocol with OpenClaw-style structured attachments while keeping NextClaw internals decoupled.
  - Replace inbound `media: string[]` with structured `attachments[]` contract.
  - Upgrade Discord attachment ingestion to local-first with remote URL fallback, typed ingress error codes, and no user-facing `download failed` noise.
  - Add Discord config semantics: `channels.discord.mediaMaxMb` and `channels.discord.proxy`.
  - Map multimodal content to Responses API blocks (`image_url -> input_image`, `text -> input_text`) so image context works in responses mode.
  - Update usage docs and architecture checklist for protocol-isomorphic/kernel-heterogeneous alignment.

- Updated dependencies
  - @nextclaw/core@0.6.7

## 0.6.7

### Patch Changes

- Align no-reply behavior with OpenClaw: treat `NO_REPLY` and empty final replies as silent (no outbound message), and document the behavior in USAGE templates.
- Updated dependencies
  - @nextclaw/core@0.6.6

## 0.6.6

### Patch Changes

- Fix local development startup by removing deprecated `--ui-host` usage from workspace dev orchestration scripts.

## 0.6.5

### Patch Changes

- Introduce Action Schema v1 end-to-end:
  - add schema-driven `actions` metadata in config schema response
  - add unified action execute API (`POST /api/config/actions/:actionId/execute`)
  - migrate Feishu verify flow to generic action runner in UI
  - expose Discord/Slack `allowBots` fields in channel config form

- Updated dependencies
  - @nextclaw/core@0.6.5
  - @nextclaw/server@0.4.2

## 0.6.4

### Patch Changes

- Refactor provider runtime to support dynamic provider routing per request model with pooled provider instances.

  Add session-level model override support (via inbound metadata and CLI `nextclaw agent --model`), enabling different sessions to run different model/provider routes without restarting.

  Keep config reload hot behavior by refreshing provider routing config on runtime reload.

- Updated dependencies
  - @nextclaw/core@0.6.4

## 0.6.3

### Patch Changes

- Fix OpenAI-compatible `responses` parsing when upstream returns valid JSON followed by trailing event-stream text (for example `event: error`).

  This keeps `wireApi=responses` compatible with gateways that mix JSON and SSE-style fragments in one payload.

- Updated dependencies
  - @nextclaw/core@0.6.3

## 0.6.2

### Patch Changes

- Restore OpenClaw-compatible plugin support in NextClaw with a NextClaw-only discovery policy.
  - Restore plugin CLI and runtime integration (`plugins *`, `channels add`, runtime loading bridge).
  - Restore `plugins.*` config schema and reload semantics.
  - Keep OpenClaw plugin compatibility while only scanning NextClaw plugin directories.
  - Do not scan legacy `.openclaw/extensions` directories by default.

- Updated dependencies
  - @nextclaw/core@0.6.2
  - @nextclaw/openclaw-compat@0.1.5

## 0.6.1

### Patch Changes

- Align channel inbound behavior with OpenClaw for bot-aware flows and improve release docs consistency.
  - add `channels.discord.allowBots` and `channels.slack.allowBots` (default `false`) to safely allow bot-authored inbound messages when explicitly enabled
  - process Telegram `channel_post` updates and normalize `sender_chat` metadata for channel bot-to-bot scenarios
  - refresh user guides/templates and channel command surfaces to match current runtime behavior

- Updated dependencies
  - @nextclaw/core@0.6.1
  - @nextclaw/server@0.4.1

## 0.6.0

### Minor Changes

- Remove the OpenClaw plugin compatibility system from runtime/CLI/config flows,
  and harden UI config API responses by redacting sensitive fields
  (token/secret/password/apiKey and authorization-like headers).

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.6.0
  - @nextclaw/server@0.4.0

## 0.5.6

### Patch Changes

- Refactor CLI runtime by splitting the previous God-class `runtime.ts` into focused modules (`commands/*`, `config-path`, `config-reloader`, `workspace`, and shared `types`) while preserving command behavior.

## 0.5.5

### Patch Changes

- - Improve gateway self-restart behavior after in-process update flow.
  - Refine self-management prompts/docs for update and runtime guidance.
  - Disable OpenClaw plugin loading by default unless `NEXTCLAW_ENABLE_OPENCLAW_PLUGINS=1` is explicitly set.
- Updated dependencies
  - @nextclaw/core@0.5.3
  - @nextclaw/openclaw-compat@0.1.4

## 0.5.4

### Patch Changes

- Close the self-management loop around USAGE-based operations:
  - Add always-on built-in skill `nextclaw-self-manage` to guide runtime self-management flows.
  - Inject self-management guidance into core system prompt, anchored on workspace `USAGE.md`.
  - Treat `docs/USAGE.md` as single source of truth and sync it into `nextclaw` workspace templates.
  - Seed `USAGE.md` into newly initialized workspaces and backfill missing built-in skills even when `skills/` is non-empty.

- Updated dependencies
  - @nextclaw/core@0.5.2

## 0.5.3

### Patch Changes

- Upgrade `nextclaw status` to runtime-aware diagnostics:
  - process/runtime health/state coherence checks
  - `--json`, `--verbose`, `--fix` support
  - meaningful exit codes for automation (`0/1/2`)

  Add top-level `nextclaw doctor` command for operational diagnostics:
  - config/workspace/service-state/service-health checks
  - UI port availability checks
  - provider readiness checks

## 0.5.2

### Patch Changes

- Fix background `start` reliability on servers:
  - Remove deprecated `--ui-host` argument from spawned `serve` command.
  - Add startup readiness guard before writing `service.json`.
  - Prevent stale service state when startup fails (including port conflict cases).

## 0.5.1

### Patch Changes

- Align UI host semantics with always-public runtime behavior.
  - Treat `ui.host` as read-only in config metadata/hints.
  - Set UI host schema default/placeholder to `0.0.0.0`.
  - Add `readOnly` field to UI hint typings in core/server/ui packages.
  - Clarify docs that CLI start paths enforce public UI host.

- Updated dependencies
  - @nextclaw/core@0.5.1
  - @nextclaw/server@0.3.7

## 0.5.0

### Minor Changes

- Add live apply support for `agents.defaults.maxTokens`, `agents.defaults.temperature`, and `tools.*` without gateway restart.

  Improve runtime restart boundaries:
  - `config set/unset` now triggers restart only for `restart-required` paths.
  - Keep `plugins.*` as restart-required for maintainability.

  Refine CLI/UI startup behavior and docs:
  - Default UI host behavior is public (`0.0.0.0`) on start/restart/serve/ui/gateway UI mode.
  - Remove redundant `--public`/`--ui-host` options from relevant commands and update usage docs.

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.5.0
  - @nextclaw/openclaw-compat@0.1.3
  - @nextclaw/server@0.3.6

## 0.4.17

### Patch Changes

- Decouple dev orchestration from CLI runtime by moving `pnpm dev start` into a dedicated repo-level dev runner and Vite config, while keeping production CLI startup paths free of dev-only port/frontend handling.

  Also remove `--frontend` and `--frontend-port` from `start`/`restart`/`serve` command options.

## 0.4.16

### Patch Changes

- Apply running config changes without manual restart for provider/channel/agent defaults, add missing-provider runtime fallback for smoother first-time setup, and document the new live-apply behavior.
- Updated dependencies
  - @nextclaw/core@0.4.14

## 0.4.15

### Patch Changes

- Add `--public` support for `start`, `restart`, `serve`, `gateway`, and `ui` commands so NextClaw can bind UI on `0.0.0.0` and print detected public URLs at startup.

## 0.4.14

### Patch Changes

- Add a `nextclaw restart` command to restart the background service without manual stop/start, and document the new command in README and USAGE.

## 0.4.13

### Patch Changes

- Align CLI config management with OpenClaw style by adding `config get|set|unset` commands and removing plugin config output options from `plugins info`.

## 0.4.12

### Patch Changes

- Fix packaged version resolution so `nextclaw --version` and runtime version APIs no longer fall back to `0.0.0`.
  - Resolve package versions by walking up to the correct package root at runtime.
  - Prioritize the `nextclaw` package version in CLI utilities with safe fallback to core version resolution.

- Updated dependencies
  - @nextclaw/core@0.4.10

## 0.4.11

### Patch Changes

- Align OpenClaw plugin compatibility for channel runtime behavior.
  - Add channel messageToolHints resolution and inject hints into agent system prompt messaging guidance.
  - Forward plugin AccountId context through runtime bridge so channel/account-specific hints can resolve.
  - Improve OpenClaw channel integration path for ClawBay-compatible plugins and update docs/logs.

- Updated dependencies
  - @nextclaw/core@0.4.9
  - @nextclaw/openclaw-compat@0.1.2
  - @nextclaw/server@0.3.5

## 0.4.10

### Patch Changes

- Unify internal package names under the `@nextclaw` scope while keeping the CLI package name as `nextclaw`.
  - Rename packages to `@nextclaw/core`, `@nextclaw/server`, and `@nextclaw/openclaw-compat`.
  - Update all workspace imports, dependency declarations, and TypeScript path aliases.
  - Keep plugin compatibility behavior and CLI user experience unchanged.

- Updated dependencies
  - @nextclaw/core@0.4.8
  - @nextclaw/server@0.3.4
  - @nextclaw/openclaw-compat@0.1.1

## 0.4.9

### Patch Changes

- Show MiniMax API base hints in UI and extend config schema hints/help.
- Updated dependencies
  - nextclaw-core@0.4.7

## 0.4.8

### Patch Changes

- Align provider/channel list descriptions with config UI hints and extend schema help entries.
- Updated dependencies
  - nextclaw-core@0.4.6

## 0.4.7

### Patch Changes

- Align config schema + uiHints pipeline with OpenClaw-style mechanism, add schema API, and unify config redaction.
- Updated dependencies
  - nextclaw-core@0.4.5
  - nextclaw-server@0.3.3

## 0.4.6

### Patch Changes

- Remove source-install docs and simplify self-update to npm-only.

## 0.4.5

### Patch Changes

- Add built-in ClawHub CLI install command for skills.

## 0.4.4

### Patch Changes

- fix: avoid exec guard blocking curl format query
- Updated dependencies
  - nextclaw-core@0.4.4

## 0.4.3

### Patch Changes

- fix: persist tool call history in sessions
- Updated dependencies
  - nextclaw-core@0.4.3

## 0.4.2

### Patch Changes

- chore: seed built-in skills during init
- Updated dependencies
  - nextclaw-core@0.4.2

## 0.4.1

### Patch Changes

- chore: tighten eslint line limits
- Updated dependencies
  - nextclaw-core@0.4.1
  - nextclaw-server@0.3.2

## 0.4.0

### Minor Changes

- Align core tools (gateway/sessions/subagents/memory) with openclaw semantics and add gateway update flow.

### Patch Changes

- Updated dependencies
  - nextclaw-core@0.4.0
  - nextclaw-server@0.3.1

## 0.3.3

### Patch Changes

- Add `nextclaw init` and run init automatically on start to prepare workspace templates.

## 0.3.2

### Patch Changes

- Fix dev UI API base/WS derivation and correct port availability checks to avoid conflicts.

## 0.3.1

### Patch Changes

- Refactor CLI runtime into dedicated runtime and utils modules.

## 0.3.0

### Minor Changes

- Add provider hot-reload support and wire_api configuration updates.

### Patch Changes

- Updated dependencies
  - nextclaw-core@0.3.0
  - nextclaw-server@0.3.0

## 0.2.9

### Patch Changes

- Update provider/channel logos and UI assets.

## 0.2.6

### Patch Changes

- Add Feishu verify/connect flow, probe API, and channel reload handling.

## 0.2.5

### Patch Changes

- Improve dev start port handling and remove guide links

## 0.2.4

### Patch Changes

- Republish UI updates and refresh bundled UI assets.

## 0.2.3

### Patch Changes

- Add background service management with `nextclaw start` and `nextclaw stop`.

## 0.2.2

### Patch Changes

- Make `nextclaw start` avoid auto-starting the frontend dev server by default.

## 0.2.1

### Patch Changes

- Add `start` command and serve bundled UI assets from the UI backend.

## 0.2.0

### Minor Changes

- Remove legacy nextbot compatibility and centralize brand configuration.

## 0.1.0

### Minor Changes

- Rename the project to nextclaw, update CLI/config defaults, and refresh docs.
