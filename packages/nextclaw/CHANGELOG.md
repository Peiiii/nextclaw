# nextclaw

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
