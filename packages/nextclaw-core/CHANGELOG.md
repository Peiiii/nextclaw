# nextclaw-core

## 0.9.7

### Patch Changes

- Disable the built-in NextClaw provider by default on fresh installs so the seeded provider remains present but no longer starts in an enabled state before it is ready.

## 0.9.6

### Patch Changes

- Add an `enabled` switch for providers so disabled providers stay configured but are excluded from routing, model selection, and runtime diagnostics.

  Expose the provider enabled state through the server and UI config views, and show disabled providers clearly in the Providers page.

## 0.9.5

### Patch Changes

- Add service-managed remote access configuration and CLI commands for NextClaw.
  - add `remote.enabled`, `remote.deviceName`, `remote.platformApiBase`, and `remote.autoReconnect` to the shared config schema
  - add `nextclaw remote enable|disable|status|doctor` and keep `remote connect` as foreground debug mode
  - run the remote connector inside the managed service lifecycle and surface remote state in `nextclaw status`
  - redact websocket relay tokens from service logs

## 0.9.4

### Patch Changes

- Fix npm packaging so publish tarballs always include built `dist` output, and republish the remote access dependency chain above the broken 0.13.2 release.

## 0.9.3

### Patch Changes

- 7e3aa0d: Guard OpenAI-compatible automatic `responses` fallback so DashScope models such as `qwen3-coder-next` stay on `chat/completions` instead of being misrouted to an unsupported API.

## 0.9.2

### Patch Changes

- Deliver live MCP hotplug updates for add, remove, enable, disable, and doctor flows without restart, and improve duplicate add feedback to avoid stack traces.

## 0.9.1

### Patch Changes

- Republish the core-linked package set so published consumers resolve the
  DisposableStore export from the updated @nextclaw/core release.

## 0.9.0

### Minor Changes

- Unify the latest NCP native chat chain, runtime capability assembly, chat UI alignment, stream/reasoning/tool fixes, and marketplace metadata publishing into a single minor release.

## 0.8.0

### Minor Changes

- eb9562b: Add lightweight built-in UI authentication for NextClaw UI with a single-admin setup flow, HttpOnly cookie sessions, protected API/WebSocket access, and a runtime Security panel.

## 0.7.7

### Patch Changes

- Add model-level thinking capability configuration and session thinking selector with backend fallback alignment.

## 0.7.6

### Patch Changes

- fix tool-loop empty final response handling and improve error surfacing with bounded user-visible diagnostics.

## 0.7.5

### Patch Changes

- Publish merged PR changes and synchronize the runtime dependency chain for npm consumption.
  This release includes configurable search provider support and workspace development export alignment.

## 0.7.4

### Patch Changes

- Unified ecosystem release for accumulated chat runtime alignment, stop behavior hardening,
  frontend sticky autoscroll fixes, and package dependency consistency.

## 0.7.3

### Patch Changes

- Release core/runtime/server/CLI linkage updates for telegram streaming and subagent behavior fixes.

## 0.7.2

### Patch Changes

- Switch skill distribution to marketplace-first flow and remove GitHub-based skill install paths.

  This release includes:
  - skill/plugin model clean split (skill: `builtin` + `marketplace` only)
  - marketplace API migration from bundled JSON to D1-backed source
  - CLI support for marketplace skill upload/update/install
  - UI and server integration updates for marketplace data, install behavior, and user-facing error messaging

## 0.7.1

### Patch Changes

- Refactor provider and channel architecture with core registry mechanism and runtime assembly.
  - Move builtin provider catalog and builtin channel IDs out of core into `@nextclaw/runtime`.
  - Keep provider registry mechanisms in `@nextclaw/core` with injectable catalog support.
  - Update server/CLI to consume runtime-provided builtin provider/channel metadata.
  - Preserve out-of-box behavior for NextClaw provider bootstrap key generation.

## 0.7.0

### Minor Changes

- Unified minor release for accumulated architecture, engine, and chat UX updates.

  Includes:
  - New pluggable engine runtime support (Codex SDK / Claude Agent SDK)
  - Skill-context propagation and chat interaction stability improvements
  - Main workspace routing and conversation UX refinements
  - Core/server/openclaw compatibility and release alignment updates

## 0.6.45

### Patch Changes

- Release runtime/session fixes and frontend configuration improvements together.
  - fix session persistence across non-streaming/runtime paths
  - stabilize Feishu conversation routing
  - include frontend max-token optimization and related config UX updates
  - republish dependent channel/plugin packages for version consistency

## 0.6.44

### Patch Changes

- release all pending changes including dynamic custom provider management, custom provider model prefix stripping before upstream calls, and marketplace source link wrapping fix in detail cards.

## 0.6.43

### Patch Changes

- support dynamic custom providers with add/edit/delete workflow, ensure custom provider test model selection is provider-scoped, and strip only the provider routing prefix before upstream OpenAI-compatible API calls.

## 0.6.42

### Patch Changes

- Align MiniMax default API base to the CN endpoint and add clear region-specific guidance in provider settings.

## 0.6.41

### Patch Changes

- Fix QQ group speaker distinction by injecting stable per-message speaker tags while keeping group-shared sessions.
  Add a built-in skill that clarifies the group-shared-session plus speaker-distinction strategy.

## 0.6.40

### Patch Changes

- e196f45: Align Telegram ack reaction behavior with OpenClaw by adding `channels.telegram.ackReactionScope` and `channels.telegram.ackReaction`, defaulting to `all` and `👀`. Telegram inbound processing now sends an acknowledgment reaction before dispatch when scope rules match.

## 0.6.39

### Patch Changes

- Refresh provider default model catalogs to latest-generation options, improve provider/model selection UX, and align config model list behaviors.

## 0.6.38

### Patch Changes

- Fix provider API base routing for non-gateway providers and upgrade providers configuration UX in UI.

## 0.6.37

### Patch Changes

- Introduce event-backed chat storage and event-sequence rendering for UI chat:
  - persist session events (single-write) and project legacy messages from events
  - stream `session_event` frames alongside text deltas in chat SSE
  - render chat by ordered event timeline, merging tool call/result/follow-up in one assistant flow card
  - keep true streaming text while preserving event-order semantics

## 0.6.36

### Patch Changes

- Add real chat streaming pipeline from provider to UI via SSE and remove simulated frontend streaming.

## 0.6.35

### Patch Changes

- feat: add secrets command suite and ui management panel
  - add `nextclaw secrets audit/configure/apply/reload` with config-aware validation and reload planning
  - add ui secrets panel for editing `secrets.enabled/defaults/providers/refs`
  - add ui api endpoint `PUT /api/config/secrets` and full client hook/types integration
  - document secrets commands in en/zh command guides

## 0.6.34

### Patch Changes

- Add a built-in `nextclaw-skill-resource-hub` skill to curate NextClaw-first skill ecosystem resources, including OpenClaw and community sources.

## 0.6.33

### Patch Changes

- Raise the default `agents.defaults.maxToolIterations` from 20 to 1000 to reduce premature tool-loop fallback responses in long tool chains.

## 0.6.32

### Patch Changes

- Add Discord native slash commands backed by a shared command registry.

## 0.6.31

### Patch Changes

- Add Discord preview streaming config and runtime support while keeping channel plugin compatibility.

## 0.6.30

### Patch Changes

- Add Discord preview streaming config and runtime support while keeping channel plugin compatibility.

## 0.6.29

### Patch Changes

- Fix agent tool-loop stalls by emitting a fallback reply after the max tool-iteration limit.

## 0.6.28

### Patch Changes

- fix SkillsLoader import crash during update/restart startup.
  - avoid static named import of `SkillsLoader` in runtime-critical paths
  - gracefully handle missing runtime export to prevent ESM load-time crash
  - make core export of `SkillsLoader` explicit for release safety

## 0.6.27

### Patch Changes

- feat: hot-apply plugin config changes without restarting the gateway process.
  - treat `plugins.*` as reloadable config paths
  - hot-reload plugin registry / plugin channel gateways / channel manager in-place
  - apply plugin extension registry updates to agent runtime pool
  - make `plugins` CLI install/enable/disable/uninstall default to hot-apply messaging
  - update usage docs with plugin hot-reload behavior

## 0.6.26

### Patch Changes

- fix: prevent broken historical tool-call chains from causing provider 400 in long-running Discord multi-agent sessions.
  - sanitize stale `assistant(tool_calls)` + `tool` history pairs before provider requests
  - preserve active trailing tool-call chain semantics
  - reduce INVALID_ARGUMENT failures after context-budget pruning

## 0.6.25

### Patch Changes

- Add strict dmScope enum guardrails in docs and runtime context prompts, and align AI config-write flow with schema-first patching.

## 0.6.24

### Patch Changes

- Align input-context handling with an OpenClaw-style token-budget pruner.
  - add unified input budget pruning in agent and subagent loops
  - support `agents.defaults.contextTokens` and per-agent `contextTokens` overrides
  - hot-reload context token budget updates
  - document configuration and multi-agent usage updates

## 0.6.23

### Patch Changes

- Align Discord/Telegram typing lifecycle with OpenClaw-style run completion cleanup.
  - Add typing-stop control message in core bus for no-reply paths.
  - Route control messages through ChannelManager without normal outbound delivery.
  - Keep typing active during agent processing and stop via outbound/control events.
  - Improve typing heartbeat/TTL defaults for long-running replies.

## 0.6.22

### Patch Changes

- Align multi-agent gateway capabilities with OpenClaw:
  - add bindings-based route resolver and agent runtime pool
  - add agents.list multi-runtime support in gateway service
  - add session.dmScope based session key isolation (including per-account-channel-peer)
  - add agentToAgent.maxPingPongTurns enforcement in sessions_send
  - complete Discord and Telegram policy parity (dmPolicy/groupPolicy/mention gates/account metadata)

## 0.6.21

### Patch Changes

- release: add WeCom channel support and harden dev runner port fallback.
  - add built-in WeCom channel runtime, plugin package, schema, UI fields and docs
  - add robust dev-runner port fallback to avoid API misrouting under port conflicts
  - publish linked package updates for runtime/plugin compatibility alignment

## 0.6.20

### Patch Changes

- Adopt `<noreply/>` as the silent marker and stop reply/output processing when the marker appears. Cascade release all direct dependents of `@nextclaw/core` to keep internal versions aligned.

## 0.6.19

### Patch Changes

- Remove configurable temperature and stop forwarding temperature in runtime provider requests.
  - Remove `agents.defaults.temperature` from config schema and reload rules.
  - Remove temperature propagation across agent loop, subagent manager, and provider manager.
  - Stop sending `temperature` to OpenAI-compatible provider payloads.
  - Remove temperature field/control from UI model configuration and API types.

## 0.6.18

### Patch Changes

- Centralize NO_REPLY handling via a unified silent reply policy and reuse it in both agent loop and channel delivery normalization.

## 0.6.17

### Patch Changes

- Complete final OpenClaw alignment by fully externalizing builtin channel runtime from core, moving extension packages into a dedicated extensions workspace path, and wiring channel plugins directly to runtime package.

## 0.6.16

### Patch Changes

- Align built-in channel loading with OpenClaw-style plugin registration by splitting bundled channel definitions, routing bundled channels through register(api), and keeping channel runtime purely plugin-registry driven.

## 0.6.15

### Patch Changes

- Harden OpenRouter/Qwen tool call parsing compatibility in OpenAI-compatible provider while keeping wireApi behavior unchanged.

## 0.6.14

### Patch Changes

- Improve OpenAI-compatible provider reliability for intermittent gateway failures without changing `wireApi` strategy semantics.

## 0.6.13

### Patch Changes

- Restore explicit current-time line in agent system prompt runtime section while keeping OpenClaw-aligned prompt structure.

## 0.6.12

### Patch Changes

- Align agent system prompt structure and wording with OpenClaw baseline while preserving NextClaw-specific runtime/tooling details.

## 0.6.11

### Patch Changes

- Switch restart completion notice from fixed text to AI-generated reply:
  - on startup, consume restart sentinel and publish a system inbound message to wake the agent;
  - keep routing via sentinel/session delivery context and let the model generate the final user-facing confirmation;
  - remove direct fixed-message delivery path for restart wake.

## 0.6.10

### Patch Changes

- Fix restart self-reply reliability when the assistant restarts itself:
  - forward runtime session context into `gateway.restart` and persist restart sentinel for restart action;
  - propagate session/channel/chat context through `exec` tool environment;
  - write restart sentinel in CLI restart path when invoked from agent exec context.

## 0.6.9

### Patch Changes

- Align restart-sentinel notification delivery with the unified channel dispatch path.
  - add `ChannelManager.deliver()` for observable one-shot outbound delivery
  - make restart wake notification use `channels.deliver()` instead of queue-only enqueue
  - keep retry + reply fallback (drop reply target when platform rejects it)
  - preserve `pending_system_events` fallback when delivery remains unavailable

## 0.6.8

### Patch Changes

- Add OpenClaw-parity restart sentinel flow for gateway-triggered restarts:
  - persist restart sentinel before `config.apply`, `config.patch`, and `update.run`
  - auto-ping the last active session after restart using captured delivery context
  - fallback to queued session system events when immediate delivery is unavailable
  - auto-infer `sessionKey` in gateway tool context and document updated behavior

## 0.6.7

### Patch Changes

- Align media ingress protocol with OpenClaw-style structured attachments while keeping NextClaw internals decoupled.
  - Replace inbound `media: string[]` with structured `attachments[]` contract.
  - Upgrade Discord attachment ingestion to local-first with remote URL fallback, typed ingress error codes, and no user-facing `download failed` noise.
  - Add Discord config semantics: `channels.discord.mediaMaxMb` and `channels.discord.proxy`.
  - Map multimodal content to Responses API blocks (`image_url -> input_image`, `text -> input_text`) so image context works in responses mode.
  - Update usage docs and architecture checklist for protocol-isomorphic/kernel-heterogeneous alignment.

## 0.6.6

### Patch Changes

- Align no-reply behavior with OpenClaw: treat `NO_REPLY` and empty final replies as silent (no outbound message), and document the behavior in USAGE templates.

## 0.6.5

### Patch Changes

- Introduce Action Schema v1 end-to-end:
  - add schema-driven `actions` metadata in config schema response
  - add unified action execute API (`POST /api/config/actions/:actionId/execute`)
  - migrate Feishu verify flow to generic action runner in UI
  - expose Discord/Slack `allowBots` fields in channel config form

## 0.6.4

### Patch Changes

- Refactor provider runtime to support dynamic provider routing per request model with pooled provider instances.

  Add session-level model override support (via inbound metadata and CLI `nextclaw agent --model`), enabling different sessions to run different model/provider routes without restarting.

  Keep config reload hot behavior by refreshing provider routing config on runtime reload.

## 0.6.3

### Patch Changes

- Fix OpenAI-compatible `responses` parsing when upstream returns valid JSON followed by trailing event-stream text (for example `event: error`).

  This keeps `wireApi=responses` compatible with gateways that mix JSON and SSE-style fragments in one payload.

## 0.6.2

### Patch Changes

- Restore OpenClaw-compatible plugin support in NextClaw with a NextClaw-only discovery policy.
  - Restore plugin CLI and runtime integration (`plugins *`, `channels add`, runtime loading bridge).
  - Restore `plugins.*` config schema and reload semantics.
  - Keep OpenClaw plugin compatibility while only scanning NextClaw plugin directories.
  - Do not scan legacy `.openclaw/extensions` directories by default.

## 0.6.1

### Patch Changes

- Align channel inbound behavior with OpenClaw for bot-aware flows and improve release docs consistency.
  - add `channels.discord.allowBots` and `channels.slack.allowBots` (default `false`) to safely allow bot-authored inbound messages when explicitly enabled
  - process Telegram `channel_post` updates and normalize `sender_chat` metadata for channel bot-to-bot scenarios
  - refresh user guides/templates and channel command surfaces to match current runtime behavior

## 0.6.0

### Minor Changes

- Remove the OpenClaw plugin compatibility system from runtime/CLI/config flows,
  and harden UI config API responses by redacting sensitive fields
  (token/secret/password/apiKey and authorization-like headers).

## 0.5.3

### Patch Changes

- - Improve gateway self-restart behavior after in-process update flow.
  - Refine self-management prompts/docs for update and runtime guidance.
  - Disable OpenClaw plugin loading by default unless `NEXTCLAW_ENABLE_OPENCLAW_PLUGINS=1` is explicitly set.

## 0.5.2

### Patch Changes

- Close the self-management loop around USAGE-based operations:
  - Add always-on built-in skill `nextclaw-self-manage` to guide runtime self-management flows.
  - Inject self-management guidance into core system prompt, anchored on workspace `USAGE.md`.
  - Treat `docs/USAGE.md` as single source of truth and sync it into `nextclaw` workspace templates.
  - Seed `USAGE.md` into newly initialized workspaces and backfill missing built-in skills even when `skills/` is non-empty.

## 0.5.1

### Patch Changes

- Align UI host semantics with always-public runtime behavior.
  - Treat `ui.host` as read-only in config metadata/hints.
  - Set UI host schema default/placeholder to `0.0.0.0`.
  - Add `readOnly` field to UI hint typings in core/server/ui packages.
  - Clarify docs that CLI start paths enforce public UI host.

## 0.5.0

### Minor Changes

- Add live apply support for `agents.defaults.maxTokens`, `agents.defaults.temperature`, and `tools.*` without gateway restart.

  Improve runtime restart boundaries:
  - `config set/unset` now triggers restart only for `restart-required` paths.
  - Keep `plugins.*` as restart-required for maintainability.

  Refine CLI/UI startup behavior and docs:
  - Default UI host behavior is public (`0.0.0.0`) on start/restart/serve/ui/gateway UI mode.
  - Remove redundant `--public`/`--ui-host` options from relevant commands and update usage docs.

## 0.4.14

### Patch Changes

- Apply running config changes without manual restart for provider/channel/agent defaults, add missing-provider runtime fallback for smoother first-time setup, and document the new live-apply behavior.

## 0.4.13

### Patch Changes

- Fix session history trimming to keep tool-call / tool-result pairs consistent, reducing intermittent provider tool-call ID errors.

  Improve providers/channels config list rendering in the UI.

## 0.4.12

### Patch Changes

- Normalize assistant outbound text through a single dispatch-layer sanitizer to strip reasoning tags (`<think>`/`<final>`) before channel delivery, and remove duplicate channel-specific cleanup logic.

## 0.4.11

### Patch Changes

- Fix LiteLLM gateway model normalization to strip routing prefixes (such as `openrouter/`) before API calls, so OpenRouter receives valid model IDs.

## 0.4.10

### Patch Changes

- Fix packaged version resolution so `nextclaw --version` and runtime version APIs no longer fall back to `0.0.0`.
  - Resolve package versions by walking up to the correct package root at runtime.
  - Prioritize the `nextclaw` package version in CLI utilities with safe fallback to core version resolution.

## 0.4.9

### Patch Changes

- Align OpenClaw plugin compatibility for channel runtime behavior.
  - Add channel messageToolHints resolution and inject hints into agent system prompt messaging guidance.
  - Forward plugin AccountId context through runtime bridge so channel/account-specific hints can resolve.
  - Improve OpenClaw channel integration path for ClawBay-compatible plugins and update docs/logs.

## 0.4.8

### Patch Changes

- Unify internal package names under the `@nextclaw` scope while keeping the CLI package name as `nextclaw`.
  - Rename packages to `@nextclaw/core`, `@nextclaw/server`, and `@nextclaw/openclaw-compat`.
  - Update all workspace imports, dependency declarations, and TypeScript path aliases.
  - Keep plugin compatibility behavior and CLI user experience unchanged.

## 0.4.7

### Patch Changes

- Show MiniMax API base hints in UI and extend config schema hints/help.

## 0.4.6

### Patch Changes

- Align provider/channel list descriptions with config UI hints and extend schema help entries.

## 0.4.5

### Patch Changes

- Align config schema + uiHints pipeline with OpenClaw-style mechanism, add schema API, and unify config redaction.

## 0.4.4

### Patch Changes

- fix: avoid exec guard blocking curl format query

## 0.4.3

### Patch Changes

- fix: persist tool call history in sessions

## 0.4.2

### Patch Changes

- chore: seed built-in skills during init

## 0.4.1

### Patch Changes

- chore: tighten eslint line limits

## 0.4.0

### Minor Changes

- Align core tools (gateway/sessions/subagents/memory) with openclaw semantics and add gateway update flow.

## 0.3.0

### Minor Changes

- Add provider hot-reload support and wire_api configuration updates.
