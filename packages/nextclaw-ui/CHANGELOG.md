# @nextclaw/ui

## 0.11.18

### Patch Changes

- 9a336f2: Publish the remaining public-package drift from today's commits as one unified patch batch, including the channel enable/disable fixes, declarative channel form layout, subagent follow-up/runtime fixes, and the landing asset updates that landed after the last tagged release.
- Updated dependencies [9a336f2]
  - @nextclaw/agent-chat@0.1.5
  - @nextclaw/agent-chat-ui@0.2.16
  - @nextclaw/ncp@0.4.3
  - @nextclaw/ncp-http-agent-client@0.3.7
  - @nextclaw/ncp-react@0.4.9

## 0.11.17

### Patch Changes

- Release pending session labeling and session context icon improvements.
- Updated dependencies
  - @nextclaw/agent-chat-ui@0.2.15
  - @nextclaw/ncp-react@0.4.8

## 0.11.16

### Patch Changes

- Align NCP chat session run status with direct realtime events so parent replies, sidebar spinners, and chat completion state settle without refresh after sub-agent runs finish.
  - @nextclaw/ncp-react@0.4.7

## 0.11.15

### Patch Changes

- Publish the NCP subagent live follow-up fixes, including spawn tool result updates, parent-agent realtime continuation, and the aligned frontend chat visibility changes.
- Updated dependencies
  - @nextclaw/ncp@0.4.2
  - @nextclaw/ncp-react@0.4.6
  - @nextclaw/ncp-http-agent-client@0.3.6

## 0.11.14

### Patch Changes

- Release frontend UI changes only.

## 0.11.13

### Patch Changes

- Fix NCP subagent completion so results persist back into the originating session, become visible in chat after realtime refresh, and no longer depend on the legacy system-message relay.
  - @nextclaw/ncp-react@0.4.5

## 0.11.12

### Patch Changes

- Republish Nextclaw UI with upstream frontend dependency chain.
- Updated dependencies
  - @nextclaw/agent-chat@0.1.4
  - @nextclaw/agent-chat-ui@0.2.14
  - @nextclaw/ncp@0.4.1
  - @nextclaw/ncp-http-agent-client@0.3.5
  - @nextclaw/ncp-react@0.4.4

## 0.11.11

### Patch Changes

- Release frontend UI changes only.

## 0.11.10

### Patch Changes

- f15df6a: Publish the pending NCP realtime sync batch together with the new built-in cross-channel messaging skill and Weixin self-notify route hints.

  This release keeps the product lightweight: the AI reuses the existing reply, `sessions_send`, and `message` primitives, and a fresh UI or NCP session can proactively notify the saved Weixin route without adding a separate notification abstraction.

- Updated dependencies [f15df6a]
  - @nextclaw/agent-chat-ui@0.2.13
  - @nextclaw/ncp-react@0.4.3

## 0.11.9

### Patch Changes

- 1ce3d58: Improve chat stream rendering performance by preserving stable message identities for unchanged messages and batching sticky autoscroll work with requestAnimationFrame.
- Updated dependencies [1ce3d58]
  - @nextclaw/agent-chat-ui@0.2.12
  - @nextclaw/ncp-react@0.4.2

## 0.11.8

### Patch Changes

- Release frontend UI changes only.

## 0.11.7

### Patch Changes

- Release the accumulated public workspace drift together with the Codex Responses contract fix. This batch includes the new stream-completion probe, the Codex runtime bundle entry alignment, and the already-unpublished package changes that the release guard requires to be versioned before publish.
- Updated dependencies
  - @nextclaw/agent-chat-ui@0.2.11

## 0.11.6

### Patch Changes

- Updated dependencies
  - @nextclaw/agent-chat-ui@0.2.10

## 0.11.5

### Patch Changes

- Publish the pending frontend UI batch together with the already-drifted public packages required by release guards.
- Updated dependencies
  - @nextclaw/agent-chat-ui@0.2.9

## 0.11.4

### Patch Changes

- Updated dependencies
  - @nextclaw/agent-chat-ui@0.2.8

## 0.11.3

### Patch Changes

- Publish the current committed runtime and UI startup fixes as one aligned patch batch. This release moves the Codex runtime plugin onto host-injected agent runtime APIs, splits UI session reads from the deferred NCP runtime so `/api/ncp/sessions` is available before the runtime agent is ready, and republishes the linked public packages above the currently published tags so the shipped dependency chain stays version-consistent.
- Updated dependencies
  - @nextclaw/agent-chat-ui@0.2.7

## 0.11.2

### Patch Changes

- Publish the pending branch changes for Claude NCP event visibility and chat tool status feedback. Claude runtime now exposes richer reasoning and tool-call events to the NCP layer, and the shared chat UI surfaces clearer tool lifecycle states, call IDs, and output labels.
- Updated dependencies
  - @nextclaw/agent-chat-ui@0.2.6

## 0.11.1

### Patch Changes

- Raise the frontend NCP attachment upload limit from 10MB to 200MB.
- Updated dependencies
  - @nextclaw/ncp-react@0.4.1

## 0.11.0

### Minor Changes

- Unify the NCP file pipeline around an asset store abstraction with `put`, `export`, and `stat`.

  This release removes default prompt-time file content injection, replaces `attachmentUri` with `assetUri`, adds `asset_put` / `asset_export` / `asset_stat`, and updates the UI/server upload flow to return and render managed assets directly.

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.4.0
  - @nextclaw/ncp-react@0.4.0
  - @nextclaw/ncp-http-agent-client@0.3.4

## 0.10.5

### Patch Changes

- Ship the full set of current unreleased workspace package changes in one release batch, including the server/CLI updates already sitting in the working tree and the previously committed public package drift that has not been published yet. Republish the NCP agent runtime export surface so NextClaw can resolve `LocalAttachmentStore` after update, and add a release guard that blocks shipping public workspace dependents when a package has drifted past its published tag without a pending changeset.
- Updated dependencies
  - @nextclaw/ncp@0.3.3
  - @nextclaw/ncp-react@0.3.6
  - @nextclaw/agent-chat@0.1.3
  - @nextclaw/agent-chat-ui@0.2.5
  - @nextclaw/ncp-http-agent-client@0.3.3

## 0.10.4

### Patch Changes

- Release frontend UI changes and aligned CLI/server release group packages.

## 0.10.3

### Patch Changes

- ee69ef6: Keep pasted and uploaded NCP images in composer order end to end: preserve caret placement, retain image visibility across follow-up turns without hidden model switching, and serialize mixed text/image message parts in the same order users authored them.
- Updated dependencies [ee69ef6]
  - @nextclaw/agent-chat-ui@0.2.4
  - @nextclaw/ncp-react@0.3.5

## 0.10.2

### Patch Changes

- Polish remote access failure handling so startup auth bootstrap no longer degrades into a blank screen, keep the remote request path on websocket multiplex with explicit timeouts, and align the bundled NextClaw release group with the updated remote access UX.

## 0.10.1

### Patch Changes

- Add NCP image attachment support across the shared chat composer, NCP runtime, React bindings, and bundled NextClaw UI so pasted or uploaded images are sent as NCP file parts and rendered inline. Also keep the required CLI/server/mcp release group in sync for the bundled NextClaw distribution.
- Updated dependencies
  - @nextclaw/agent-chat-ui@0.2.3
  - @nextclaw/ncp-react@0.3.4

## 0.10.0

### Minor Changes

- bb891c2: Add the Phase 1 Feishu platform foundation for NextClaw, including shared Feishu core primitives, richer message conversion, multi-account routing, and the aligned config UI/runtime release chain.

## 0.9.18

### Patch Changes

- Fix Claude NCP runtime model routing by bridging Anthropic Messages to OpenAI-compatible providers, remove the Claude model whitelist concept, and keep the Claude model selector stable when the previously selected model is missing.

## 0.9.17

### Patch Changes

- Republish all public workspace packages with pnpm publish guards so released manifests no longer retain workspace:\* dependencies and future npm publish misuse is blocked before release.
- Updated dependencies
  - @nextclaw/agent-chat@0.1.2
  - @nextclaw/agent-chat-ui@0.2.2
  - @nextclaw/ncp@0.3.2
  - @nextclaw/ncp-http-agent-client@0.3.2
  - @nextclaw/ncp-react@0.3.3

## 0.9.16

### Patch Changes

- Republish the verified Weixin QR auth UI flow above already occupied npm versions so the published CLI and UI packages match the code that passed real smoke validation.

## 0.9.15

### Patch Changes

- Publish the transparent app transport boundary fix so local and remote streaming remain a true transport-only replacement.
  - keep SSE and multiplex adapters transport-only instead of interpreting upper-layer terminal events
  - preserve `final` as a normal streamed event while keeping `openStream().finished` stable
  - ship the repaired local chat UX and remote request-multiplex behavior in the released CLI/UI/runtime chain

## 0.9.14

### Patch Changes

- Add the Weixin channel entry to the Channels page so users can configure personal Weixin accounts directly from the frontend.

## 0.9.13

### Patch Changes

- Fix local UI runtime probe fallback so local NextClaw instances keep using local transport
  instead of breaking on `/_remote/runtime` HTML responses.

## 0.9.12

### Patch Changes

- Unify controlled UI requests under appClient, ship the updated built-in UI bundle,
  and keep the CLI release group aligned.

## 0.9.11

### Patch Changes

- Republish the finalized remote app transport multiplex implementation after maintainability refactors so the published packages match the verified runtime code.

## 0.9.10

### Patch Changes

- Add remote app transport multiplexing so the UI can switch from direct local transport to remote runtime transport, including browser-side remote requests, realtime event bridging, and streamed chat turns over the remote relay.

## 0.9.9

### Patch Changes

- Align the default NextClaw UI port to 55667 across core config, remote access, CLI runtime, UI fallbacks, Docker defaults, smoke scripts, and user-facing docs.

## 0.9.8

### Patch Changes

- Add an `enabled` switch for providers so disabled providers stay configured but are excluded from routing, model selection, and runtime diagnostics.

  Expose the provider enabled state through the server and UI config views, and show disabled providers clearly in the Providers page.

## 0.9.7

### Patch Changes

- Align the remote access UI with the existing product style, remove leftover advanced controls from the main flow, expose the device list entry directly, and surface clearer disconnected hints.

## 0.9.6

### Patch Changes

- Publish the user-first NextClaw account and remote access UI changes under a fresh npm version so the registry matches the repo state.

## 0.9.5

### Patch Changes

- Refine remote access into a user-first NextClaw account flow, simplify the remote access page, and align the web console device copy with the new product path.

## 0.9.4

### Patch Changes

- Add browser-based remote access platform authorization so users can log out and re-authorize from the UI without falling back to CLI password entry.

## 0.9.3

### Patch Changes

- Productize remote access in the built-in UI by shipping a dedicated Remote Access page, exposing the supporting server APIs, routing in-page managed-service restart through the shared self-restart coordinator so restart reliably relaunches the service instead of only stopping it, and keeping the required `@nextclaw/mcp` release group aligned with the updated server and CLI packages.

## 0.9.2

### Patch Changes

- Fix Codex chat model selection being overwritten by stale session hydration after the first send.

## 0.9.1

### Patch Changes

- Release the tokenized chat composer, IME fixes, and inline skill chip UI improvements.
- Updated dependencies
  - @nextclaw/agent-chat-ui@0.2.1

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
  - @nextclaw/ncp-react@0.3.1

## 0.8.0

### Minor Changes

- Unify the latest NCP native chat chain, runtime capability assembly, chat UI alignment, stream/reasoning/tool fixes, and marketplace metadata publishing into a single minor release.

### Patch Changes

- Updated dependencies
  - @nextclaw/agent-chat-ui@0.2.0
  - @nextclaw/ncp@0.3.0
  - @nextclaw/ncp-http-agent-client@0.3.0
  - @nextclaw/ncp-react@0.3.0

## 0.7.0

### Minor Changes

- eb9562b: Add lightweight built-in UI authentication for NextClaw UI with a single-admin setup flow, HttpOnly cookie sessions, protected API/WebSocket access, and a runtime Security panel.

### Patch Changes

- cfcd97f: Split the reusable chat presentation layer into a standalone `@nextclaw/agent-chat-ui` package and wire `@nextclaw/ui` to consume it.
- Updated dependencies [cfcd97f]
  - @nextclaw/agent-chat-ui@0.1.1

## 0.6.15

### Patch Changes

- Improve sidebar service status UX with lightweight indicator + shadcn tooltip, and tighten initial health status judgment based on `/api/health` payload status.

## 0.6.14

### Patch Changes

- Expose the new NCP agent runtime/backend type exports and session delete API, and add the docs entry under Settings in the main chat sidebar.

## 0.6.13

### Patch Changes

- Add model-level thinking capability configuration and session thinking selector with backend fallback alignment.

## 0.6.12

### Patch Changes

- Publish merged PR changes and synchronize the runtime dependency chain for npm consumption.
  This release includes configurable search provider support and workspace development export alignment.

## 0.6.11

### Patch Changes

- Unified ecosystem release for accumulated chat runtime alignment, stop behavior hardening,
  frontend sticky autoscroll fixes, and package dependency consistency.
- Updated dependencies
  - @nextclaw/agent-chat@0.1.1

## 0.6.10

### Patch Changes

- Release frontend UI changes only.

## 0.6.9

### Patch Changes

- Switch skill distribution to marketplace-first flow and remove GitHub-based skill install paths.

  This release includes:
  - skill/plugin model clean split (skill: `builtin` + `marketplace` only)
  - marketplace API migration from bundled JSON to D1-backed source
  - CLI support for marketplace skill upload/update/install
  - UI and server integration updates for marketplace data, install behavior, and user-facing error messaging

## 0.6.8

### Patch Changes

- Release frontend UI changes only.

## 0.6.7

### Patch Changes

- Expose the NextClaw product version via app metadata and display it in the UI sidebar brand header.

## 0.6.6

### Patch Changes

- Release frontend UI changes only.

## 0.6.5

### Patch Changes

- Release frontend UI changes only.

## 0.6.4

### Patch Changes

- Polish chat UI loading and conversation interaction behaviors, and ship updated built-in UI assets.

## 0.6.3

### Patch Changes

- Retry publish with fresh patch versions after reserved-version conflict on npm.

## 0.6.2

### Patch Changes

- Introduce backend-managed chat run source of truth with reconnectable run streams, and restore in-progress run state when reopening chat sessions.

## 0.6.1

### Patch Changes

- Release frontend UI changes only.

## 0.6.0

### Minor Changes

- Unified minor release for accumulated architecture, engine, and chat UX updates.

  Includes:
  - New pluggable engine runtime support (Codex SDK / Claude Agent SDK)
  - Skill-context propagation and chat interaction stability improvements
  - Main workspace routing and conversation UX refinements
  - Core/server/openclaw compatibility and release alignment updates

## 0.5.48

### Patch Changes

- Release frontend UI changes only.

## 0.5.47

### Patch Changes

- Release frontend UI changes only.

## 0.5.46

### Patch Changes

- Release frontend UI changes only.

## 0.5.45

### Patch Changes

- Release frontend UI changes only.

## 0.5.44

### Patch Changes

- Release runtime/session fixes and frontend configuration improvements together.
  - fix session persistence across non-streaming/runtime paths
  - stabilize Feishu conversation routing
  - include frontend max-token optimization and related config UX updates
  - republish dependent channel/plugin packages for version consistency

## 0.5.43

### Patch Changes

- - fix provider connection test probe to use `maxTokens >= 16`, avoiding OpenAI-compatible gateway errors that reject values below 16.
  - add regression coverage for provider test route to assert probe maxTokens lower bound.
  - include latest UI updates in this release batch.

## 0.5.42

### Patch Changes

- - ui: refine provider config form layout (display name in primary section, Wire API Mode in advanced settings), plus related input rendering polish.
  - cli: fix Windows self-update strategy detection by supporting PATH/PATHEXT executable resolution and platform-aware update command shell execution.
  - docs: add iteration logs for provider advanced layout and Windows update strategy fix.

## 0.5.41

### Patch Changes

- release all pending changes including dynamic custom provider management, custom provider model prefix stripping before upstream calls, and marketplace source link wrapping fix in detail cards.

## 0.5.40

### Patch Changes

- support dynamic custom providers with add/edit/delete workflow, ensure custom provider test model selection is provider-scoped, and strip only the provider routing prefix before upstream OpenAI-compatible API calls.

## 0.5.39

### Patch Changes

- Align MiniMax default API base to the CN endpoint and add clear region-specific guidance in provider settings.

## 0.5.38

### Patch Changes

- Release frontend UI changes only.

## 0.5.37

### Patch Changes

- Release frontend UI changes only.

## 0.5.36

### Patch Changes

- Align channel configuration UX with provider page paradigm and fix logo badge consistency.
  - Switch Channels page to a provider-style two-pane workflow with list/filter on the left and persistent form on the right.
  - Fix hook ordering in `ChannelsList` to avoid render-time hook count mismatch.
  - Enforce stable logo badge sizing (`shrink-0`, overflow handling) so provider/channel icons keep consistent frame size.
  - Restrict channel tutorial links to dedicated docs only (currently Feishu).

## 0.5.35

### Patch Changes

- Add channel tutorial metadata and expose in the UI with localized links.
  - Add a Tutorials module to docs (EN/ZH) and include a dedicated Feishu setup page.
  - Extend config meta channel spec with `tutorialUrls` (`default/en/zh`) while keeping `tutorialUrl` for compatibility.
  - Resolve localized tutorial URLs in UI and show guide entry points on channel cards and channel config modal headers.

## 0.5.34

### Patch Changes

- Refresh provider default model catalogs to latest-generation options, improve provider/model selection UX, and align config model list behaviors.

## 0.5.33

### Patch Changes

- Release frontend UI changes only.

## 0.5.32

### Patch Changes

- Release frontend UI changes only.

## 0.5.31

### Patch Changes

- eb6446f: Fix provider list icon consistency by enforcing a fixed logo size in the UI.

## 0.5.30

### Patch Changes

- Fix provider API base routing for non-gateway providers and upgrade providers configuration UX in UI.

## 0.5.29

### Patch Changes

- fix chat stream terminal handling and remove end-of-stream typing flicker.

## 0.5.28

### Patch Changes

- Introduce event-backed chat storage and event-sequence rendering for UI chat:
  - persist session events (single-write) and project legacy messages from events
  - stream `session_event` frames alongside text deltas in chat SSE
  - render chat by ordered event timeline, merging tool call/result/follow-up in one assistant flow card
  - keep true streaming text while preserving event-order semantics

## 0.5.27

### Patch Changes

- Release frontend UI changes only.

## 0.5.26

### Patch Changes

- Release frontend UI changes only.

## 0.5.25

### Patch Changes

- Release frontend UI changes only.

## 0.5.24

### Patch Changes

- Add real chat streaming pipeline from provider to UI via SSE and remove simulated frontend streaming.

## 0.5.23

### Patch Changes

- Release frontend UI changes only.

## 0.5.22

### Patch Changes

- feat: add secrets command suite and ui management panel
  - add `nextclaw secrets audit/configure/apply/reload` with config-aware validation and reload planning
  - add ui secrets panel for editing `secrets.enabled/defaults/providers/refs`
  - add ui api endpoint `PUT /api/config/secrets` and full client hook/types integration
  - document secrets commands in en/zh command guides

## 0.5.21

### Patch Changes

- Upgrade UI chat experience with markdown rendering, structured tool cards, and grouped message display.

## 0.5.20

### Patch Changes

- Add built-in Agent chat support in UI with a new chat page, session management, and a backend chat turn API wired to runtime pool.

## 0.5.19

### Patch Changes

- feat(marketplace): support git skill install via skild with explicit skill/path parameters
  - route marketplace git skills through `npx skild install`
  - pass `skill` and `installPath` from UI -> server -> installer
  - allow git-type skills in marketplace skills list

## 0.5.18

### Patch Changes

- Fix embedded docs browser locale routing so docs open under the current UI language locale.

## 0.5.17

### Patch Changes

- Split marketplace plugins and skills across all layers, including typed worker routes, typed server proxy routes, and typed UI API clients.

## 0.5.16

### Patch Changes

- refine marketplace module separation and module-specific copy for plugins and skills

## 0.5.15

### Patch Changes

- split marketplace data and routes by type, separating plugins and skills endpoints end-to-end

## 0.5.14

### Patch Changes

- Release frontend UI changes only.

## 0.5.13

### Patch Changes

- Release frontend UI changes only.

## 0.5.12

### Patch Changes

- Release frontend UI changes only.

## 0.5.11

### Patch Changes

- Release frontend UI changes only.

## 0.5.10

### Patch Changes

- Release frontend UI changes only.

## 0.5.9

### Patch Changes

- Release frontend UI changes only.

## 0.5.8

### Patch Changes

- Refresh UI layout, components, and styling for the config pages.

## 0.5.7

### Patch Changes

- Add Discord preview streaming config and runtime support while keeping channel plugin compatibility.

## 0.5.6

### Patch Changes

- Add cron management UI with list/enable/disable/run/delete actions and corresponding server API endpoints.

## 0.5.5

### Patch Changes

- UI: add confirm dialog flow for destructive actions; Server: allow marketplace manage to resolve plugin id from spec fallback.
- UI: add cron management page with view/enable/disable/run/delete actions.

## 0.5.4

### Patch Changes

- fix: sync marketplace toggle state and refresh list data after manage actions

## 0.5.3

### Patch Changes

- - render tooltips in a portal with design-system z-index
  - refresh marketplace cards with avatar + tooltip details

## 0.5.2

### Patch Changes

- switch DocBrowser docs domain to docs.nextclaw.io and remove legacy pages.dev fallback

## 0.5.1

### Patch Changes

- fix(ui): refine floating doc browser resize axis handling
  - support axis-aware floating resize behavior
  - keep width unchanged when dragging vertical-only handle
  - keep height unchanged when dragging horizontal-only handle

## 0.5.0

### Minor Changes

- feat(ui): improve embedded docs browser route sync and link handling
  - sync DocBrowser URL with in-iframe docs route changes
  - avoid intercepting explicitly external doc links
  - refine doc browser URL input UX and labels
  - refresh bundled `nextclaw` ui-dist with latest UI behavior

## 0.4.0

### Minor Changes

- feat(release): promote marketplace milestone to minor version bump
  - reclassify the recent marketplace integration as feature-level release
  - align package versions with semver minor progression
  - keep release coverage across cli, server and ui packages

## 0.3.17

### Patch Changes

- feat(marketplace): add VSCode-style marketplace with installed state and install integration
  - add marketplace query/install API on UI server
  - connect install actions to existing CLI plugin/skill install commands
  - add marketplace frontend page with search, filters, recommendations, and installed tab
  - add installed-status API and UI badges/button states for installed items

## 0.3.16

### Patch Changes

- Fix Model page maxTokens persistence by wiring maxTokens through UI save API and server config update.

## 0.3.15

### Patch Changes

- Add session channel grouping modes (all/by-channel) and complete Sessions i18n labels.

## 0.3.14

### Patch Changes

- Add full session management in NextClaw UI with OpenClaw-aligned capabilities.
  - add Sessions tab with filtering, history inspection, metadata patching, clear, and delete
  - add UI API endpoints for sessions list/history/patch/delete
  - sync frontend/server types and hooks for session operations
  - update usage guide for session management UI

## 0.3.13

### Patch Changes

- Add full UI/runtime API support for configuring input context token budgets.
  - Runtime page supports `agents.defaults.contextTokens`
  - Runtime page supports per-agent `agents.list[*].contextTokens`
  - Runtime API persists default context token budget updates
  - Usage docs updated for UI configuration path

## 0.3.12

### Patch Changes

- Align UI routing/runtime configuration with OpenClaw capabilities.
  - Add runtime config API and editor for `agents.list`, `bindings`, and `session` controls.
  - Add ChannelForm fields for Discord/Telegram routing and mention policy settings.
  - Expose runtime settings safely in public config view and wire UI navigation for runtime management.

## 0.3.11

### Patch Changes

- release: add WeCom channel support and harden dev runner port fallback.
  - add built-in WeCom channel runtime, plugin package, schema, UI fields and docs
  - add robust dev-runner port fallback to avoid API misrouting under port conflicts
  - publish linked package updates for runtime/plugin compatibility alignment

## 0.3.10

### Patch Changes

- Remove configurable temperature and stop forwarding temperature in runtime provider requests.
  - Remove `agents.defaults.temperature` from config schema and reload rules.
  - Remove temperature propagation across agent loop, subagent manager, and provider manager.
  - Stop sending `temperature` to OpenAI-compatible provider payloads.
  - Remove temperature field/control from UI model configuration and API types.

## 0.3.9

### Patch Changes

- Introduce Action Schema v1 end-to-end:
  - add schema-driven `actions` metadata in config schema response
  - add unified action execute API (`POST /api/config/actions/:actionId/execute`)
  - migrate Feishu verify flow to generic action runner in UI
  - expose Discord/Slack `allowBots` fields in channel config form

## 0.3.8

### Patch Changes

- Align UI host semantics with always-public runtime behavior.
  - Treat `ui.host` as read-only in config metadata/hints.
  - Set UI host schema default/placeholder to `0.0.0.0`.
  - Add `readOnly` field to UI hint typings in core/server/ui packages.
  - Clarify docs that CLI start paths enforce public UI host.

## 0.3.7

### Patch Changes

- Decouple dev orchestration from CLI runtime by moving `pnpm dev start` into a dedicated repo-level dev runner and Vite config, while keeping production CLI startup paths free of dev-only port/frontend handling.

  Also remove `--frontend` and `--frontend-port` from `start`/`restart`/`serve` command options.

## 0.3.6

### Patch Changes

- Apply running config changes without manual restart for provider/channel/agent defaults, add missing-provider runtime fallback for smoother first-time setup, and document the new live-apply behavior.

## 0.3.5

### Patch Changes

- Fix session history trimming to keep tool-call / tool-result pairs consistent, reducing intermittent provider tool-call ID errors.

  Improve providers/channels config list rendering in the UI.

## 0.3.4

### Patch Changes

- Show MiniMax API base hints in UI and extend config schema hints/help.

## 0.3.3

### Patch Changes

- Align provider/channel list descriptions with config UI hints and extend schema help entries.

## 0.3.2

### Patch Changes

- chore: tighten eslint line limits

## 0.3.1

### Patch Changes

- Fix dev UI API base/WS derivation and correct port availability checks to avoid conflicts.

## 0.3.0

### Minor Changes

- Add provider hot-reload support and wire_api configuration updates.

## 0.2.5

### Patch Changes

- Update provider/channel logos and UI assets.

## 0.2.4

### Patch Changes

- Add Feishu verify/connect flow, probe API, and channel reload handling.

## 0.2.3

### Patch Changes

- Republish UI updates and refresh bundled UI assets.

## 0.2.2

### Patch Changes

- Make `nextclaw start` avoid auto-starting the frontend dev server by default.

## 0.2.1

### Patch Changes

- Add `start` command and serve bundled UI assets from the UI backend.
