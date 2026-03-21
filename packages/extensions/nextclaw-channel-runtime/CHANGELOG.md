# @nextclaw/channel-runtime

## 0.2.7

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.7

## 0.2.6

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.6

## 0.2.5

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.5

## 0.2.4

### Patch Changes

- Fix npm packaging so publish tarballs always include built `dist` output, and republish the remote access dependency chain above the broken 0.13.2 release.
- Updated dependencies
  - @nextclaw/core@0.9.4

## 0.2.3

### Patch Changes

- Updated dependencies [7e3aa0d]
  - @nextclaw/core@0.9.3

## 0.2.2

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.2

## 0.2.1

### Patch Changes

- Republish the core-linked package set so published consumers resolve the
  DisposableStore export from the updated @nextclaw/core release.
- Updated dependencies
  - @nextclaw/core@0.9.1

## 0.2.0

### Minor Changes

- Unify the latest NCP native chat chain, runtime capability assembly, chat UI alignment, stream/reasoning/tool fixes, and marketplace metadata publishing into a single minor release.

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.0

## 0.1.36

### Patch Changes

- Updated dependencies [eb9562b]
  - @nextclaw/core@0.8.0

## 0.1.35

### Patch Changes

- Add model-level thinking capability configuration and session thinking selector with backend fallback alignment.
- Updated dependencies
  - @nextclaw/core@0.7.7

## 0.1.34

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.7.6

## 0.1.33

### Patch Changes

- Publish merged PR changes and synchronize the runtime dependency chain for npm consumption.
  This release includes configurable search provider support and workspace development export alignment.
- Updated dependencies
  - @nextclaw/core@0.7.5

## 0.1.32

### Patch Changes

- Unified ecosystem release for accumulated chat runtime alignment, stop behavior hardening,
  frontend sticky autoscroll fixes, and package dependency consistency.
- Updated dependencies
  - @nextclaw/core@0.7.4

## 0.1.31

### Patch Changes

- Guard Telegram runtime creation when `providers.groq` is not configured to prevent startup crash.

## 0.1.30

### Patch Changes

- Release core/runtime/server/CLI linkage updates for telegram streaming and subagent behavior fixes.
- Updated dependencies
  - @nextclaw/core@0.7.3

## 0.1.29

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.7.0

## 0.1.28

### Patch Changes

- Release runtime/session fixes and frontend configuration improvements together.
  - fix session persistence across non-streaming/runtime paths
  - stabilize Feishu conversation routing
  - include frontend max-token optimization and related config UX updates
  - republish dependent channel/plugin packages for version consistency

- Updated dependencies
  - @nextclaw/core@0.6.45

## 0.1.27

### Patch Changes

- release all pending changes including dynamic custom provider management, custom provider model prefix stripping before upstream calls, and marketplace source link wrapping fix in detail cards.
- Updated dependencies
  - @nextclaw/core@0.6.44

## 0.1.26

### Patch Changes

- support dynamic custom providers with add/edit/delete workflow, ensure custom provider test model selection is provider-scoped, and strip only the provider routing prefix before upstream OpenAI-compatible API calls.
- Updated dependencies
  - @nextclaw/core@0.6.43

## 0.1.25

### Patch Changes

- Align MiniMax default API base to the CN endpoint and add clear region-specific guidance in provider settings.
- Updated dependencies
  - @nextclaw/core@0.6.42

## 0.1.24

### Patch Changes

- Fix QQ group speaker distinction by injecting stable per-message speaker tags while keeping group-shared sessions.
  Add a built-in skill that clarifies the group-shared-session plus speaker-distinction strategy.
- Updated dependencies
  - @nextclaw/core@0.6.41

## 0.1.23

### Patch Changes

- e196f45: Align Telegram ack reaction behavior with OpenClaw by adding `channels.telegram.ackReactionScope` and `channels.telegram.ackReaction`, defaulting to `all` and `👀`. Telegram inbound processing now sends an acknowledgment reaction before dispatch when scope rules match.
- Updated dependencies [e196f45]
  - @nextclaw/core@0.6.40

## 0.1.22

### Patch Changes

- Refresh provider default model catalogs to latest-generation options, improve provider/model selection UX, and align config model list behaviors.
- Updated dependencies
  - @nextclaw/core@0.6.39

## 0.1.21

### Patch Changes

- Fix provider API base routing for non-gateway providers and upgrade providers configuration UX in UI.
- Updated dependencies
  - @nextclaw/core@0.6.38

## 0.1.20

### Patch Changes

- Add a built-in `nextclaw-skill-resource-hub` skill to curate NextClaw-first skill ecosystem resources, including OpenClaw and community sources.
- Updated dependencies
  - @nextclaw/core@0.6.34

## 0.1.19

### Patch Changes

- Raise the default `agents.defaults.maxToolIterations` from 20 to 1000 to reduce premature tool-loop fallback responses in long tool chains.
- Updated dependencies
  - @nextclaw/core@0.6.33

## 0.1.18

### Patch Changes

- fix: defer Discord slash command replies to avoid interaction timeouts

## 0.1.17

### Patch Changes

- Add Discord native slash commands backed by a shared command registry.
- Updated dependencies
  - @nextclaw/core@0.6.32

## 0.1.16

### Patch Changes

- Add Discord preview streaming config and runtime support while keeping channel plugin compatibility.
- Updated dependencies
  - @nextclaw/core@0.6.31

## 0.1.15

### Patch Changes

- Add Discord preview streaming config and runtime support while keeping channel plugin compatibility.
- Updated dependencies
  - @nextclaw/core@0.6.30

## 0.1.14

### Patch Changes

- Fix agent tool-loop stalls by emitting a fallback reply after the max tool-iteration limit.
- Updated dependencies
  - @nextclaw/core@0.6.29

## 0.1.13

### Patch Changes

- feat: hot-apply plugin config changes without restarting the gateway process.
  - treat `plugins.*` as reloadable config paths
  - hot-reload plugin registry / plugin channel gateways / channel manager in-place
  - apply plugin extension registry updates to agent runtime pool
  - make `plugins` CLI install/enable/disable/uninstall default to hot-apply messaging
  - update usage docs with plugin hot-reload behavior

- Updated dependencies
  - @nextclaw/core@0.6.27

## 0.1.12

### Patch Changes

- fix: prevent broken historical tool-call chains from causing provider 400 in long-running Discord multi-agent sessions.
  - sanitize stale `assistant(tool_calls)` + `tool` history pairs before provider requests
  - preserve active trailing tool-call chain semantics
  - reduce INVALID_ARGUMENT failures after context-budget pruning

- Updated dependencies
  - @nextclaw/core@0.6.26

## 0.1.11

### Patch Changes

- Add strict dmScope enum guardrails in docs and runtime context prompts, and align AI config-write flow with schema-first patching.
- Updated dependencies
  - @nextclaw/core@0.6.25

## 0.1.10

### Patch Changes

- Align input-context handling with an OpenClaw-style token-budget pruner.
  - add unified input budget pruning in agent and subagent loops
  - support `agents.defaults.contextTokens` and per-agent `contextTokens` overrides
  - hot-reload context token budget updates
  - document configuration and multi-agent usage updates

- Updated dependencies
  - @nextclaw/core@0.6.24

## 0.1.9

### Patch Changes

- Align Discord/Telegram typing lifecycle with OpenClaw-style run completion cleanup.
  - Add typing-stop control message in core bus for no-reply paths.
  - Route control messages through ChannelManager without normal outbound delivery.
  - Keep typing active during agent processing and stop via outbound/control events.
  - Improve typing heartbeat/TTL defaults for long-running replies.

- Updated dependencies
  - @nextclaw/core@0.6.23

## 0.1.8

### Patch Changes

- Align multi-agent gateway capabilities with OpenClaw:
  - add bindings-based route resolver and agent runtime pool
  - add agents.list multi-runtime support in gateway service
  - add session.dmScope based session key isolation (including per-account-channel-peer)
  - add agentToAgent.maxPingPongTurns enforcement in sessions_send
  - complete Discord and Telegram policy parity (dmPolicy/groupPolicy/mention gates/account metadata)

- Updated dependencies
  - @nextclaw/core@0.6.22

## 0.1.7

### Patch Changes

- release: add WeCom channel support and harden dev runner port fallback.
  - add built-in WeCom channel runtime, plugin package, schema, UI fields and docs
  - add robust dev-runner port fallback to avoid API misrouting under port conflicts
  - publish linked package updates for runtime/plugin compatibility alignment

- Updated dependencies
  - @nextclaw/core@0.6.21

## 0.1.6

### Patch Changes

- Stop channel typing indicators immediately after inbound processing completes (including no-reply paths like <noreply/>), instead of waiting for auto-stop timeout.

## 0.1.5

### Patch Changes

- Align Discord outbound sending with OpenClaw-style chunking so long replies are split safely and no longer fail with Invalid Form Body.

## 0.1.4

### Patch Changes

- Adopt `<noreply/>` as the silent marker and stop reply/output processing when the marker appears. Cascade release all direct dependents of `@nextclaw/core` to keep internal versions aligned.
- Updated dependencies
  - @nextclaw/core@0.6.20

## 0.1.3

### Patch Changes

- Align internal dependency on `@nextclaw/core@^0.6.18` and publish dependent packages together.

## 0.1.2

### Patch Changes

- Fix channel typing lifecycle by introducing a class-based controller and auto-stop safeguards to prevent stale typing indicators when the AI does not reply.

## 0.1.1

### Patch Changes

- Complete final OpenClaw alignment by fully externalizing builtin channel runtime from core, moving extension packages into a dedicated extensions workspace path, and wiring channel plugins directly to runtime package.
- Updated dependencies
  - @nextclaw/core@0.6.17
