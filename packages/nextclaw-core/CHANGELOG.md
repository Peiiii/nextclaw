# nextclaw-core

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
