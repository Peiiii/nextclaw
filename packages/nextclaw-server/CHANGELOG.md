# nextclaw-server

## 0.10.39

### Patch Changes

- Release the codex bridge fix so codex sessions can keep using the codex-sdk runtime with OpenAI-compatible models that only expose chat completions, including DashScope `qwen3-coder-next`.
- Updated dependencies
  - @nextclaw/mcp@0.1.35

## 0.10.38

### Patch Changes

- Align bundled Feishu support with the official OpenClaw plugin by vendoring the upstream Feishu plugin into NextClaw, teaching the compat loader to prefer plugin-local OpenClaw SDK resolution, and adding the minimal loader shims needed for the official Feishu tools to register inside NextClaw.
- Updated dependencies
  - @nextclaw/openclaw-compat@0.3.20
  - @nextclaw/mcp@0.1.34

## 0.10.37

### Patch Changes

- Add the Phase 1 Feishu platform foundation for NextClaw, including shared Feishu core primitives, richer message conversion, multi-account routing, and the aligned config UI/runtime release chain.
- Updated dependencies
  - @nextclaw/core@0.10.0
  - @nextclaw/openclaw-compat@0.3.19
  - @nextclaw/mcp@0.1.33
  - @nextclaw/runtime@0.2.13

## 0.10.36

### Patch Changes

- Raise remote connector exponential backoff to a 30 minute cap for non-terminal websocket failures so long outages generate fewer reconnect requests while terminal auth and configuration errors still stop immediately.
- Updated dependencies
  - @nextclaw/mcp@0.1.32

## 0.10.35

### Patch Changes

- Republish all public workspace packages with pnpm publish guards so released manifests no longer retain workspace:\* dependencies and future npm publish misuse is blocked before release.
- Updated dependencies
  - @nextclaw/core@0.9.12
  - @nextclaw/mcp@0.1.31
  - @nextclaw/ncp@0.3.2
  - @nextclaw/ncp-http-agent-server@0.3.2
  - @nextclaw/openclaw-compat@0.3.18
  - @nextclaw/runtime@0.2.12

## 0.10.34

### Patch Changes

- @nextclaw/mcp@0.1.30
- @nextclaw/openclaw-compat@0.3.17

## 0.10.33

### Patch Changes

- Stop unbounded remote websocket reconnect loops by classifying terminal handshake failures,
  backing off retry timing, halting after repeated failures, and preserving the registered
  device across reconnect attempts. Keep the CLI release group aligned with version-only
  companion releases for `@nextclaw/mcp` and `@nextclaw/server`.
- Updated dependencies
  - @nextclaw/mcp@0.1.29

## 0.10.32

### Patch Changes

- Republish the verified Weixin QR auth UI flow above already occupied npm versions so the published CLI and UI packages match the code that passed real smoke validation.

## 0.10.31

### Patch Changes

- Publish the transparent app transport boundary fix so local and remote streaming remain a true transport-only replacement.
  - keep SSE and multiplex adapters transport-only instead of interpreting upper-layer terminal events
  - preserve `final` as a normal streamed event while keeping `openStream().finished` stable
  - ship the repaired local chat UX and remote request-multiplex behavior in the released CLI/UI/runtime chain

- Updated dependencies
  - @nextclaw/mcp@0.1.26

## 0.10.30

### Patch Changes

- Fix the real UI server startup path so plugin channel bindings and UI metadata are passed through to the router, making the Weixin channel appear in frontend config instead of disappearing outside controller-only tests.

## 0.10.29

### Patch Changes

- Expose the Weixin plugin channel in UI config APIs, including `meta.channels`, schema hints, config projection, and save-back to plugin config.

- Updated dependencies
  - @nextclaw/openclaw-compat@0.3.15

## 0.10.28

### Patch Changes

- Republish the verified Weixin channel plugin release above already occupied npm versions so the published packages match the repository state that passed real QR login and real reply validation.
- Updated dependencies
  - @nextclaw/core@0.9.11
  - @nextclaw/openclaw-compat@0.3.14
  - @nextclaw/mcp@0.1.28
  - @nextclaw/runtime@0.2.11

## 0.10.27

### Patch Changes

- Add the Weixin channel plugin with QR login, long-poll inbound handling, `context_token`-based reply delivery, and `accountId` routing across the shared host contracts.

  Expose plugin-aware `nextclaw channels login --channel weixin`, bundle the new Weixin plugin into the OpenClaw compatibility loader, and pass channel `accountId` through the message tool, cron, and service runtime so verified Weixin reply flows work end to end.

- Updated dependencies
  - @nextclaw/core@0.9.10
  - @nextclaw/openclaw-compat@0.3.13
  - @nextclaw/mcp@0.1.27
  - @nextclaw/runtime@0.2.10

## 0.10.26

### Patch Changes

- Fix local UI runtime probe fallback so local NextClaw instances keep using local transport
  instead of breaking on `/_remote/runtime` HTML responses.
- Add the Weixin channel plugin with QR login, long-poll inbound handling, `context_token`-based reply delivery, and `accountId` routing across the shared host contracts.

  Expose plugin-aware `nextclaw channels login --channel weixin`, bundle the new Weixin plugin into the OpenClaw compatibility loader, and pass channel `accountId` through the message tool, cron, and service runtime so verified Weixin reply flows work end to end.

- Updated dependencies
- Updated dependencies
  - @nextclaw/mcp@0.1.26
  - @nextclaw/core@0.9.9
  - @nextclaw/openclaw-compat@0.3.12
  - @nextclaw/runtime@0.2.9

## 0.10.25

### Patch Changes

- Unify controlled UI requests under appClient, ship the updated built-in UI bundle,
  and keep the CLI release group aligned.
- Updated dependencies
  - @nextclaw/mcp@0.1.25

## 0.10.24

### Patch Changes

- Republish the finalized remote app transport multiplex implementation after maintainability refactors so the published packages match the verified runtime code.
- Updated dependencies
  - @nextclaw/mcp@0.1.24

## 0.10.23

### Patch Changes

- Add remote app transport multiplexing so the UI can switch from direct local transport to remote runtime transport, including browser-side remote requests, realtime event bridging, and streamed chat turns over the remote relay.
- Updated dependencies
  - @nextclaw/mcp@0.1.23

## 0.10.22

### Patch Changes

- Publish the remote instance registration compatibility fix so released CLI builds understand the new platform `instance` payload and registration route.
- Updated dependencies
  - @nextclaw/mcp@0.1.22

## 0.10.21

### Patch Changes

- 7795d61: Replace the UI API CORS middleware with an explicit implementation that avoids both `hono/cors` and the `HonoRequest.header()` hot path on long-running Node servers, while also preventing stale remote runtime state from reporting dead services as connected.
- Updated dependencies [7795d61]
  - @nextclaw/mcp@0.1.21

## 0.10.20

### Patch Changes

- Fix remote access token-expiry handling so expired platform sessions are no longer treated as logged in.

  The local remote runtime now fails fast on expired or malformed platform tokens, and remote doctor/status surfaces the real token state instead of only checking the `nca.` prefix.
  Republish the CLI release group packages for version alignment.

- Updated dependencies
  - @nextclaw/mcp@0.1.20

## 0.10.19

### Patch Changes

- Align the default NextClaw UI port to 55667 across core config, remote access, CLI runtime, UI fallbacks, Docker defaults, smoke scripts, and user-facing docs.
- Updated dependencies
  - @nextclaw/core@0.9.8
  - @nextclaw/mcp@0.1.19
  - @nextclaw/openclaw-compat@0.3.11
  - @nextclaw/runtime@0.2.8

## 0.10.18

### Patch Changes

- Fix the first-run CLI init path so the built-in NextClaw provider stays disabled by default for fresh installs.
- Updated dependencies
  - @nextclaw/mcp@0.1.18

## 0.10.17

### Patch Changes

- Disable the built-in NextClaw provider by default on fresh installs so the seeded provider remains present but no longer starts in an enabled state before it is ready.
- Updated dependencies
  - @nextclaw/core@0.9.7
  - @nextclaw/mcp@0.1.17
  - @nextclaw/openclaw-compat@0.3.10
  - @nextclaw/runtime@0.2.7

## 0.10.16

### Patch Changes

- Add an `enabled` switch for providers so disabled providers stay configured but are excluded from routing, model selection, and runtime diagnostics.

  Expose the provider enabled state through the server and UI config views, and show disabled providers clearly in the Providers page.

- Updated dependencies
  - @nextclaw/core@0.9.6
  - @nextclaw/mcp@0.1.16
  - @nextclaw/openclaw-compat@0.3.9
  - @nextclaw/runtime@0.2.6

## 0.10.15

### Patch Changes

- Fix remote access to bind status and repair actions to the current UI process runtime instead of a stale managed service snapshot.

  Ensure `serve` and dev UI sessions start the remote runtime whenever the current process actually has UI enabled, even if `config.ui.enabled` is false.

- Updated dependencies
  - @nextclaw/mcp@0.1.15

## 0.10.14

### Patch Changes

- Align the remote access UI with the existing product style, remove leftover advanced controls from the main flow, expose the device list entry directly, and surface clearer disconnected hints.
- Updated dependencies
  - @nextclaw/mcp@0.1.14

## 0.10.13

### Patch Changes

- Refine remote access into a user-first NextClaw account flow, simplify the remote access page, and align the web console device copy with the new product path.
- Updated dependencies
  - @nextclaw/mcp@0.1.13

## 0.10.12

### Patch Changes

- Optimize remote relay cost behavior by removing connector heartbeat traffic and aligning the platform relay flow with hibernation-friendly online/session state semantics.
- Updated dependencies
  - @nextclaw/mcp@0.1.12

## 0.10.11

### Patch Changes

- Keep the `@nextclaw/mcp` / `@nextclaw/server` / `nextclaw` release group aligned while shipping the `nextclaw` UI static directory contract tightening.
  - `nextclaw`: remove implicit UI static directory fallbacks so the published CLI only serves the bundled `ui-dist` or an explicit `NEXTCLAW_UI_STATIC_DIR` override. Invalid overrides now fail fast with a non-zero exit instead of silently borrowing repo-local frontend artifacts from `cwd`.
  - `@nextclaw/mcp`: version-only companion release for release-group alignment.
  - `@nextclaw/server`: version-only companion release for release-group alignment.

- Updated dependencies
  - @nextclaw/mcp@0.1.11

## 0.10.10

### Patch Changes

- Add browser-based remote access platform authorization so users can log out and re-authorize from the UI without falling back to CLI password entry.
- Updated dependencies
  - @nextclaw/mcp@0.1.10

## 0.10.9

### Patch Changes

- Productize remote access in the built-in UI by shipping a dedicated Remote Access page, exposing the supporting server APIs, routing in-page managed-service restart through the shared self-restart coordinator so restart reliably relaunches the service instead of only stopping it, and keeping the required `@nextclaw/mcp` release group aligned with the updated server and CLI packages.
- Updated dependencies
  - @nextclaw/mcp@0.1.9

## 0.10.8

### Patch Changes

- Fix Claude readiness probing so working Anthropic-compatible routes are not marked unavailable by a probe-only USD budget cap, and improve local first-party plugin loading when running NextClaw from source.
- Updated dependencies
  - @nextclaw/mcp@0.1.8

## 0.10.7

### Patch Changes

- Publish the final host-adapter cleanup for the remote package split so the released nextclaw version matches the finalized repository state.
- Updated dependencies
  - @nextclaw/mcp@0.1.7

## 0.10.6

### Patch Changes

- Publish the remote runtime package split through fresh npm versions after the previously generated versions were already occupied on npm.
- Updated dependencies
  - @nextclaw/mcp@0.1.6

## 0.10.5

### Patch Changes

- Split the remote access runtime into a standalone `@nextclaw/remote` package and make `nextclaw` consume it through a thin host adapter.
- Updated dependencies
  - @nextclaw/mcp@0.1.5

## 0.10.4

### Patch Changes

- Fix Codex chat startup and plugin resolution when running NextClaw from source in dev mode.
  - prefer repo-local first-party plugins from `packages/extensions` when `NEXTCLAW_DEV_FIRST_PARTY_PLUGIN_DIR` is unset
  - avoid loading stale installed Codex runtime plugins from `~/.nextclaw/extensions` during source-mode smoke tests
  - keep the release group for `@nextclaw/mcp`, `@nextclaw/server`, and `nextclaw` in sync while shipping the Codex chat fix

- Updated dependencies
- Updated dependencies
  - @nextclaw/openclaw-compat@0.3.8
  - @nextclaw/mcp@0.1.4
  - @nextclaw/core@0.9.5
  - @nextclaw/runtime@0.2.5

## 0.10.3

### Patch Changes

- Fix npm packaging so publish tarballs always include built `dist` output, and republish the remote access dependency chain above the broken 0.13.2 release.
- Updated dependencies
  - @nextclaw/core@0.9.4
  - @nextclaw/runtime@0.2.4
  - @nextclaw/openclaw-compat@0.3.7
  - @nextclaw/mcp@0.1.3

## 0.10.2

### Patch Changes

- Republish the remote access CLI and local auth bridge above the broken 0.13.1 / 0.10.1 npm versions so global installs regain the `remote` command.

## 0.10.1

### Patch Changes

- d1162f2: Recover the linked MCP/server/nextclaw release chain so marketplace MCP APIs ship together with their consumers.
- Ship the remote access CLI and local auth bridge in a repaired npm release, and make platform api base parsing tolerate `/v` vs `/v1`.
- Updated dependencies [d1162f2]
- Updated dependencies [7e3aa0d]
  - @nextclaw/mcp@0.1.2
  - @nextclaw/core@0.9.3
  - @nextclaw/runtime@0.2.3
  - @nextclaw/openclaw-compat@0.3.6

## 0.10.0

### Minor Changes

- Add lightweight remote access support with platform device registration, remote session relay, and trusted local UI auth bridging.

## 0.9.4

### Patch Changes

- Fix plugin hot-reload cache invalidation so upgraded Codex runtime plugins take effect without requiring a service restart.
- Updated dependencies
  - @nextclaw/openclaw-compat@0.3.5

## 0.9.3

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.2
  - @nextclaw/openclaw-compat@0.3.4
  - @nextclaw/runtime@0.2.2

## 0.9.2

### Patch Changes

- Republish the NCP-linked package set so published consumers resolve the
  latest NCP protocol/runtime exports used by the current NextClaw CLI build.
- Updated dependencies
  - @nextclaw/ncp@0.3.1
  - @nextclaw/ncp-http-agent-server@0.3.1
  - @nextclaw/openclaw-compat@0.3.3

## 0.9.1

### Patch Changes

- Republish the core-linked package set so published consumers resolve the
  DisposableStore export from the updated @nextclaw/core release.
- Updated dependencies
  - @nextclaw/core@0.9.1
  - @nextclaw/openclaw-compat@0.3.2
  - @nextclaw/runtime@0.2.1

## 0.9.0

### Minor Changes

- Unify the latest NCP native chat chain improvements into a single release batch:
  - fix NCP streaming/state-manager promotion so tool-first assistant streams do not lose parts
  - align session type handling to stay generic outside the built-in native type
  - remove runtime-specific default-model branching and use a generic session-scoped fallback strategy
  - ship the latest NextClaw UI, server, and CLI cutover fixes together
  - republish direct dependents of `@nextclaw/ncp-toolkit` for version alignment

### Patch Changes

- Updated dependencies
  - @nextclaw/openclaw-compat@0.3.1

## 0.8.0

### Minor Changes

- Unify the latest NCP native chat chain, runtime capability assembly, chat UI alignment, stream/reasoning/tool fixes, and marketplace metadata publishing into a single minor release.

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.0
  - @nextclaw/ncp@0.3.0
  - @nextclaw/ncp-http-agent-server@0.3.0
  - @nextclaw/openclaw-compat@0.3.0
  - @nextclaw/runtime@0.2.0

## 0.7.0

### Minor Changes

- eb9562b: Add lightweight built-in UI authentication for NextClaw UI with a single-admin setup flow, HttpOnly cookie sessions, protected API/WebSocket access, and a runtime Security panel.

### Patch Changes

- Updated dependencies [eb9562b]
  - @nextclaw/core@0.8.0
  - @nextclaw/openclaw-compat@0.2.7
  - @nextclaw/runtime@0.1.7

## 0.6.13

### Patch Changes

- 63c7ab3: Refactor UI router into centralized route binding with modular controllers to improve maintainability and module role clarity.

## 0.6.12

### Patch Changes

- Improve sidebar service status UX with lightweight indicator + shadcn tooltip, and tighten initial health status judgment based on `/api/health` payload status.

## 0.6.11

### Patch Changes

- Add model-level thinking capability configuration and session thinking selector with backend fallback alignment.
- Updated dependencies
  - @nextclaw/core@0.7.7
  - @nextclaw/runtime@0.1.6
  - @nextclaw/openclaw-compat@0.2.6

## 0.6.10

### Patch Changes

- fix tool-loop empty final response handling and improve error surfacing with bounded user-visible diagnostics.
- Updated dependencies
  - @nextclaw/core@0.7.6
  - @nextclaw/openclaw-compat@0.2.5
  - @nextclaw/runtime@0.1.5

## 0.6.9

### Patch Changes

- Publish merged PR changes and synchronize the runtime dependency chain for npm consumption.
  This release includes configurable search provider support and workspace development export alignment.
- Updated dependencies
  - @nextclaw/core@0.7.5
  - @nextclaw/runtime@0.1.4
  - @nextclaw/openclaw-compat@0.2.4

## 0.6.8

### Patch Changes

- Unified ecosystem release for accumulated chat runtime alignment, stop behavior hardening,
  frontend sticky autoscroll fixes, and package dependency consistency.
- Updated dependencies
  - @nextclaw/core@0.7.4
  - @nextclaw/openclaw-compat@0.2.3
  - @nextclaw/runtime@0.1.3

## 0.6.7

### Patch Changes

- @nextclaw/openclaw-compat@0.2.2

## 0.6.6

### Patch Changes

- Release core/runtime/server/CLI linkage updates for telegram streaming and subagent behavior fixes.
- Updated dependencies
  - @nextclaw/core@0.7.3
  - @nextclaw/runtime@0.1.2
  - @nextclaw/openclaw-compat@0.2.1

## 0.6.5

### Patch Changes

- Switch skill distribution to marketplace-first flow and remove GitHub-based skill install paths.

  This release includes:
  - skill/plugin model clean split (skill: `builtin` + `marketplace` only)
  - marketplace API migration from bundled JSON to D1-backed source
  - CLI support for marketplace skill upload/update/install
  - UI and server integration updates for marketplace data, install behavior, and user-facing error messaging

- Updated dependencies
  - @nextclaw/core@0.7.2

## 0.6.4

### Patch Changes

- Expose the NextClaw product version via app metadata and display it in the UI sidebar brand header.

## 0.6.3

### Patch Changes

- Refactor provider and channel architecture with core registry mechanism and runtime assembly.
  - Move builtin provider catalog and builtin channel IDs out of core into `@nextclaw/runtime`.
  - Keep provider registry mechanisms in `@nextclaw/core` with injectable catalog support.
  - Update server/CLI to consume runtime-provided builtin provider/channel metadata.
  - Preserve out-of-box behavior for NextClaw provider bootstrap key generation.

- Updated dependencies
  - @nextclaw/core@0.7.1
  - @nextclaw/runtime@0.1.1

## 0.6.2

### Patch Changes

- Retry publish with fresh patch versions after reserved-version conflict on npm.

## 0.6.1

### Patch Changes

- Introduce backend-managed chat run source of truth with reconnectable run streams, and restore in-progress run state when reopening chat sessions.

## 0.6.0

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

## 0.5.30

### Patch Changes

- Release runtime/session fixes and frontend configuration improvements together.
  - fix session persistence across non-streaming/runtime paths
  - stabilize Feishu conversation routing
  - include frontend max-token optimization and related config UX updates
  - republish dependent channel/plugin packages for version consistency

- Updated dependencies
  - @nextclaw/core@0.6.45
  - @nextclaw/openclaw-compat@0.1.34

## 0.5.29

### Patch Changes

- - fix provider connection test probe to use `maxTokens >= 16`, avoiding OpenAI-compatible gateway errors that reject values below 16.
  - add regression coverage for provider test route to assert probe maxTokens lower bound.
  - include latest UI updates in this release batch.

## 0.5.28

### Patch Changes

- release all pending changes including dynamic custom provider management, custom provider model prefix stripping before upstream calls, and marketplace source link wrapping fix in detail cards.
- Updated dependencies
  - @nextclaw/core@0.6.44
  - @nextclaw/openclaw-compat@0.1.33

## 0.5.27

### Patch Changes

- support dynamic custom providers with add/edit/delete workflow, ensure custom provider test model selection is provider-scoped, and strip only the provider routing prefix before upstream OpenAI-compatible API calls.
- Updated dependencies
  - @nextclaw/core@0.6.43
  - @nextclaw/openclaw-compat@0.1.32

## 0.5.26

### Patch Changes

- Align MiniMax default API base to the CN endpoint and add clear region-specific guidance in provider settings.
- Updated dependencies
  - @nextclaw/core@0.6.42
  - @nextclaw/openclaw-compat@0.1.31

## 0.5.25

### Patch Changes

- Align channel configuration UX with provider page paradigm and fix logo badge consistency.
  - Switch Channels page to a provider-style two-pane workflow with list/filter on the left and persistent form on the right.
  - Fix hook ordering in `ChannelsList` to avoid render-time hook count mismatch.
  - Enforce stable logo badge sizing (`shrink-0`, overflow handling) so provider/channel icons keep consistent frame size.
  - Restrict channel tutorial links to dedicated docs only (currently Feishu).

## 0.5.24

### Patch Changes

- Add channel tutorial metadata and expose in the UI with localized links.
  - Add a Tutorials module to docs (EN/ZH) and include a dedicated Feishu setup page.
  - Extend config meta channel spec with `tutorialUrls` (`default/en/zh`) while keeping `tutorialUrl` for compatibility.
  - Resolve localized tutorial URLs in UI and show guide entry points on channel cards and channel config modal headers.

## 0.5.23

### Patch Changes

- Refresh provider default model catalogs to latest-generation options, improve provider/model selection UX, and align config model list behaviors.
- Updated dependencies
  - @nextclaw/core@0.6.39
  - @nextclaw/openclaw-compat@0.1.30

## 0.5.22

### Patch Changes

- Hotfix publish to ensure provider test route is available in npm runtime.

## 0.5.21

### Patch Changes

- Fix provider API base routing for non-gateway providers and upgrade providers configuration UX in UI.
- Updated dependencies
  - @nextclaw/core@0.6.38
  - @nextclaw/openclaw-compat@0.1.29

## 0.5.20

### Patch Changes

- Introduce event-backed chat storage and event-sequence rendering for UI chat:
  - persist session events (single-write) and project legacy messages from events
  - stream `session_event` frames alongside text deltas in chat SSE
  - render chat by ordered event timeline, merging tool call/result/follow-up in one assistant flow card
  - keep true streaming text while preserving event-order semantics

- Updated dependencies
  - @nextclaw/core@0.6.37

## 0.5.19

### Patch Changes

- Add real chat streaming pipeline from provider to UI via SSE and remove simulated frontend streaming.
- Updated dependencies
  - @nextclaw/core@0.6.36

## 0.5.18

### Patch Changes

- feat: add secrets command suite and ui management panel
  - add `nextclaw secrets audit/configure/apply/reload` with config-aware validation and reload planning
  - add ui secrets panel for editing `secrets.enabled/defaults/providers/refs`
  - add ui api endpoint `PUT /api/config/secrets` and full client hook/types integration
  - document secrets commands in en/zh command guides

- Updated dependencies
  - @nextclaw/core@0.6.35

## 0.5.17

### Patch Changes

- Upgrade UI chat experience with markdown rendering, structured tool cards, and grouped message display.

## 0.5.16

### Patch Changes

- Add built-in Agent chat support in UI with a new chat page, session management, and a backend chat turn API wired to runtime pool.

## 0.5.15

### Patch Changes

- Add a built-in `nextclaw-skill-resource-hub` skill to curate NextClaw-first skill ecosystem resources, including OpenClaw and community sources.
- Updated dependencies
  - @nextclaw/core@0.6.34
  - @nextclaw/openclaw-compat@0.1.28

## 0.5.14

### Patch Changes

- Raise the default `agents.defaults.maxToolIterations` from 20 to 1000 to reduce premature tool-loop fallback responses in long tool chains.
- Updated dependencies
  - @nextclaw/core@0.6.33
  - @nextclaw/openclaw-compat@0.1.27

## 0.5.13

### Patch Changes

- feat(marketplace): support git skill install via skild with explicit skill/path parameters
  - route marketplace git skills through `npx skild install`
  - pass `skill` and `installPath` from UI -> server -> installer
  - allow git-type skills in marketplace skills list

## 0.5.12

### Patch Changes

- Split marketplace plugins and skills across all layers, including typed worker routes, typed server proxy routes, and typed UI API clients.

## 0.5.11

### Patch Changes

- split marketplace data and routes by type, separating plugins and skills endpoints end-to-end

## 0.5.10

### Patch Changes

- Enable gzip compression for built-in UI static assets and improve slow-network loading behavior.

## 0.5.9

### Patch Changes

- fix: defer Discord slash command replies to avoid interaction timeouts
- Updated dependencies
  - @nextclaw/openclaw-compat@0.1.26

## 0.5.8

### Patch Changes

- Sync NextClaw packages with updated core and channel runtime versions.
- Updated dependencies
  - @nextclaw/openclaw-compat@0.1.25

## 0.5.7

### Patch Changes

- Add Discord preview streaming config and runtime support while keeping channel plugin compatibility.
- Updated dependencies
  - @nextclaw/core@0.6.31
  - @nextclaw/openclaw-compat@0.1.24

## 0.5.6

### Patch Changes

- Add cron management UI with list/enable/disable/run/delete actions and corresponding server API endpoints.
- Add Discord preview streaming config and runtime support while keeping channel plugin compatibility.
- Updated dependencies
  - @nextclaw/core@0.6.30
  - @nextclaw/openclaw-compat@0.1.23

## 0.5.5

### Patch Changes

- Fix agent tool-loop stalls by emitting a fallback reply after the max tool-iteration limit.
- Add cron management API endpoints for list/remove/enable/run to support the UI.
- Updated dependencies
  - @nextclaw/core@0.6.29
  - @nextclaw/openclaw-compat@0.1.22

## 0.5.4

### Patch Changes

- UI: add confirm dialog flow for destructive actions; Server: allow marketplace manage to resolve plugin id from spec fallback.

## 0.5.3

### Patch Changes

- Fix plugin hot-plug behavior so disabling bundled channel plugins (like Discord) takes effect immediately and enabling restores runtime behavior.

  Also normalize marketplace manage targets from canonical npm specs to real plugin IDs and harden config reload watching for first-time config file creation.

- Updated dependencies
  - @nextclaw/openclaw-compat@0.1.21

## 0.5.2

### Patch Changes

- fix SkillsLoader import crash during update/restart startup.
  - avoid static named import of `SkillsLoader` in runtime-critical paths
  - gracefully handle missing runtime export to prevent ESM load-time crash
  - make core export of `SkillsLoader` explicit for release safety

- Updated dependencies
  - @nextclaw/core@0.6.28

## 0.5.1

### Patch Changes

- unify marketplace plugin identity to canonical channel npm specs and switch default marketplace api base to marketplace-api.nextclaw.io

## 0.5.0

### Minor Changes

- feat(release): promote marketplace milestone to minor version bump
  - reclassify the recent marketplace integration as feature-level release
  - align package versions with semver minor progression
  - keep release coverage across cli, server and ui packages

## 0.4.17

### Patch Changes

- feat(marketplace): add VSCode-style marketplace with installed state and install integration
  - add marketplace query/install API on UI server
  - connect install actions to existing CLI plugin/skill install commands
  - add marketplace frontend page with search, filters, recommendations, and installed tab
  - add installed-status API and UI badges/button states for installed items

## 0.4.16

### Patch Changes

- feat: hot-apply plugin config changes without restarting the gateway process.
  - treat `plugins.*` as reloadable config paths
  - hot-reload plugin registry / plugin channel gateways / channel manager in-place
  - apply plugin extension registry updates to agent runtime pool
  - make `plugins` CLI install/enable/disable/uninstall default to hot-apply messaging
  - update usage docs with plugin hot-reload behavior

- Updated dependencies
  - @nextclaw/core@0.6.27

## 0.4.15

### Patch Changes

- fix: prevent broken historical tool-call chains from causing provider 400 in long-running Discord multi-agent sessions.
  - sanitize stale `assistant(tool_calls)` + `tool` history pairs before provider requests
  - preserve active trailing tool-call chain semantics
  - reduce INVALID_ARGUMENT failures after context-budget pruning

- Updated dependencies
  - @nextclaw/core@0.6.26

## 0.4.14

### Patch Changes

- Add strict dmScope enum guardrails in docs and runtime context prompts, and align AI config-write flow with schema-first patching.
- Updated dependencies
  - @nextclaw/core@0.6.25

## 0.4.13

### Patch Changes

- Fix Model page maxTokens persistence by wiring maxTokens through UI save API and server config update.

## 0.4.12

### Patch Changes

- Add full session management in NextClaw UI with OpenClaw-aligned capabilities.
  - add Sessions tab with filtering, history inspection, metadata patching, clear, and delete
  - add UI API endpoints for sessions list/history/patch/delete
  - sync frontend/server types and hooks for session operations
  - update usage guide for session management UI

## 0.4.11

### Patch Changes

- Add full UI/runtime API support for configuring input context token budgets.
  - Runtime page supports `agents.defaults.contextTokens`
  - Runtime page supports per-agent `agents.list[*].contextTokens`
  - Runtime API persists default context token budget updates
  - Usage docs updated for UI configuration path

## 0.4.10

### Patch Changes

- Align input-context handling with an OpenClaw-style token-budget pruner.
  - add unified input budget pruning in agent and subagent loops
  - support `agents.defaults.contextTokens` and per-agent `contextTokens` overrides
  - hot-reload context token budget updates
  - document configuration and multi-agent usage updates

- Updated dependencies
  - @nextclaw/core@0.6.24

## 0.4.9

### Patch Changes

- Align Discord/Telegram typing lifecycle with OpenClaw-style run completion cleanup.
  - Add typing-stop control message in core bus for no-reply paths.
  - Route control messages through ChannelManager without normal outbound delivery.
  - Keep typing active during agent processing and stop via outbound/control events.
  - Improve typing heartbeat/TTL defaults for long-running replies.

- Updated dependencies
  - @nextclaw/core@0.6.23

## 0.4.8

### Patch Changes

- Align UI routing/runtime configuration with OpenClaw capabilities.
  - Add runtime config API and editor for `agents.list`, `bindings`, and `session` controls.
  - Add ChannelForm fields for Discord/Telegram routing and mention policy settings.
  - Expose runtime settings safely in public config view and wire UI navigation for runtime management.

## 0.4.7

### Patch Changes

- Align multi-agent gateway capabilities with OpenClaw:
  - add bindings-based route resolver and agent runtime pool
  - add agents.list multi-runtime support in gateway service
  - add session.dmScope based session key isolation (including per-account-channel-peer)
  - add agentToAgent.maxPingPongTurns enforcement in sessions_send
  - complete Discord and Telegram policy parity (dmPolicy/groupPolicy/mention gates/account metadata)

- Updated dependencies
  - @nextclaw/core@0.6.22

## 0.4.6

### Patch Changes

- release: add WeCom channel support and harden dev runner port fallback.
  - add built-in WeCom channel runtime, plugin package, schema, UI fields and docs
  - add robust dev-runner port fallback to avoid API misrouting under port conflicts
  - publish linked package updates for runtime/plugin compatibility alignment

- Updated dependencies
  - @nextclaw/core@0.6.21

## 0.4.5

### Patch Changes

- Adopt `<noreply/>` as the silent marker and stop reply/output processing when the marker appears. Cascade release all direct dependents of `@nextclaw/core` to keep internal versions aligned.
- Updated dependencies
  - @nextclaw/core@0.6.20

## 0.4.4

### Patch Changes

- Remove configurable temperature and stop forwarding temperature in runtime provider requests.
  - Remove `agents.defaults.temperature` from config schema and reload rules.
  - Remove temperature propagation across agent loop, subagent manager, and provider manager.
  - Stop sending `temperature` to OpenAI-compatible provider payloads.
  - Remove temperature field/control from UI model configuration and API types.

- Updated dependencies
  - @nextclaw/core@0.6.19

## 0.4.3

### Patch Changes

- Align internal dependency on `@nextclaw/core@^0.6.18` and publish dependent packages together.

## 0.4.2

### Patch Changes

- Introduce Action Schema v1 end-to-end:
  - add schema-driven `actions` metadata in config schema response
  - add unified action execute API (`POST /api/config/actions/:actionId/execute`)
  - migrate Feishu verify flow to generic action runner in UI
  - expose Discord/Slack `allowBots` fields in channel config form

- Updated dependencies
  - @nextclaw/core@0.6.5

## 0.4.1

### Patch Changes

- Align channel inbound behavior with OpenClaw for bot-aware flows and improve release docs consistency.
  - add `channels.discord.allowBots` and `channels.slack.allowBots` (default `false`) to safely allow bot-authored inbound messages when explicitly enabled
  - process Telegram `channel_post` updates and normalize `sender_chat` metadata for channel bot-to-bot scenarios
  - refresh user guides/templates and channel command surfaces to match current runtime behavior

- Updated dependencies
  - @nextclaw/core@0.6.1

## 0.4.0

### Minor Changes

- Remove the OpenClaw plugin compatibility system from runtime/CLI/config flows,
  and harden UI config API responses by redacting sensitive fields
  (token/secret/password/apiKey and authorization-like headers).

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.6.0

## 0.3.7

### Patch Changes

- Align UI host semantics with always-public runtime behavior.
  - Treat `ui.host` as read-only in config metadata/hints.
  - Set UI host schema default/placeholder to `0.0.0.0`.
  - Add `readOnly` field to UI hint typings in core/server/ui packages.
  - Clarify docs that CLI start paths enforce public UI host.

- Updated dependencies
  - @nextclaw/core@0.5.1

## 0.3.6

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.5.0
  - @nextclaw/openclaw-compat@0.1.3

## 0.3.5

### Patch Changes

- Align OpenClaw plugin compatibility for channel runtime behavior.
  - Add channel messageToolHints resolution and inject hints into agent system prompt messaging guidance.
  - Forward plugin AccountId context through runtime bridge so channel/account-specific hints can resolve.
  - Improve OpenClaw channel integration path for ClawBay-compatible plugins and update docs/logs.

- Updated dependencies
  - @nextclaw/core@0.4.9
  - @nextclaw/openclaw-compat@0.1.2

## 0.3.4

### Patch Changes

- Unify internal package names under the `@nextclaw` scope while keeping the CLI package name as `nextclaw`.
  - Rename packages to `@nextclaw/core`, `@nextclaw/server`, and `@nextclaw/openclaw-compat`.
  - Update all workspace imports, dependency declarations, and TypeScript path aliases.
  - Keep plugin compatibility behavior and CLI user experience unchanged.

- Updated dependencies
  - @nextclaw/core@0.4.8
  - @nextclaw/openclaw-compat@0.1.1

## 0.3.3

### Patch Changes

- Align config schema + uiHints pipeline with OpenClaw-style mechanism, add schema API, and unify config redaction.
- Updated dependencies
  - nextclaw-core@0.4.5

## 0.3.2

### Patch Changes

- chore: tighten eslint line limits
- Updated dependencies
  - nextclaw-core@0.4.1

## 0.3.1

### Patch Changes

- Updated dependencies
  - nextclaw-core@0.4.0

## 0.3.0

### Minor Changes

- Add provider hot-reload support and wire_api configuration updates.

### Patch Changes

- Updated dependencies
  - nextclaw-core@0.3.0
