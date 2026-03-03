# @nextclaw/ui

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
