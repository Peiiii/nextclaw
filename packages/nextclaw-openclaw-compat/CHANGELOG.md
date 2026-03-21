# @nextclaw/openclaw-compat

## 0.3.10

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.7
  - @nextclaw/channel-runtime@0.2.7
  - @nextclaw/channel-plugin-dingtalk@0.2.7
  - @nextclaw/channel-plugin-discord@0.2.7
  - @nextclaw/channel-plugin-email@0.2.7
  - @nextclaw/channel-plugin-feishu@0.2.7
  - @nextclaw/channel-plugin-mochat@0.2.7
  - @nextclaw/channel-plugin-qq@0.2.7
  - @nextclaw/channel-plugin-slack@0.2.7
  - @nextclaw/channel-plugin-telegram@0.2.7
  - @nextclaw/channel-plugin-wecom@0.2.7
  - @nextclaw/channel-plugin-whatsapp@0.2.7

## 0.3.9

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.6
  - @nextclaw/channel-runtime@0.2.6
  - @nextclaw/channel-plugin-dingtalk@0.2.6
  - @nextclaw/channel-plugin-discord@0.2.6
  - @nextclaw/channel-plugin-email@0.2.6
  - @nextclaw/channel-plugin-feishu@0.2.6
  - @nextclaw/channel-plugin-mochat@0.2.6
  - @nextclaw/channel-plugin-qq@0.2.6
  - @nextclaw/channel-plugin-slack@0.2.6
  - @nextclaw/channel-plugin-telegram@0.2.6
  - @nextclaw/channel-plugin-wecom@0.2.6
  - @nextclaw/channel-plugin-whatsapp@0.2.6

## 0.3.8

### Patch Changes

- Fix Codex chat startup and plugin resolution when running NextClaw from source in dev mode.
  - prefer repo-local first-party plugins from `packages/extensions` when `NEXTCLAW_DEV_FIRST_PARTY_PLUGIN_DIR` is unset
  - avoid loading stale installed Codex runtime plugins from `~/.nextclaw/extensions` during source-mode smoke tests
  - keep the release group for `@nextclaw/mcp`, `@nextclaw/server`, and `nextclaw` in sync while shipping the Codex chat fix

- Updated dependencies
  - @nextclaw/core@0.9.5
  - @nextclaw/channel-runtime@0.2.5
  - @nextclaw/channel-plugin-dingtalk@0.2.5
  - @nextclaw/channel-plugin-discord@0.2.5
  - @nextclaw/channel-plugin-email@0.2.5
  - @nextclaw/channel-plugin-feishu@0.2.5
  - @nextclaw/channel-plugin-mochat@0.2.5
  - @nextclaw/channel-plugin-qq@0.2.5
  - @nextclaw/channel-plugin-slack@0.2.5
  - @nextclaw/channel-plugin-telegram@0.2.5
  - @nextclaw/channel-plugin-wecom@0.2.5
  - @nextclaw/channel-plugin-whatsapp@0.2.5

## 0.3.7

### Patch Changes

- Fix npm packaging so publish tarballs always include built `dist` output, and republish the remote access dependency chain above the broken 0.13.2 release.
- Updated dependencies
  - @nextclaw/channel-runtime@0.2.4
  - @nextclaw/core@0.9.4
  - @nextclaw/channel-plugin-dingtalk@0.2.4
  - @nextclaw/channel-plugin-discord@0.2.4
  - @nextclaw/channel-plugin-email@0.2.4
  - @nextclaw/channel-plugin-feishu@0.2.4
  - @nextclaw/channel-plugin-mochat@0.2.4
  - @nextclaw/channel-plugin-qq@0.2.4
  - @nextclaw/channel-plugin-slack@0.2.4
  - @nextclaw/channel-plugin-telegram@0.2.4
  - @nextclaw/channel-plugin-wecom@0.2.4
  - @nextclaw/channel-plugin-whatsapp@0.2.4

## 0.3.6

### Patch Changes

- Updated dependencies [7e3aa0d]
  - @nextclaw/core@0.9.3
  - @nextclaw/channel-runtime@0.2.3
  - @nextclaw/channel-plugin-dingtalk@0.2.3
  - @nextclaw/channel-plugin-discord@0.2.3
  - @nextclaw/channel-plugin-email@0.2.3
  - @nextclaw/channel-plugin-feishu@0.2.3
  - @nextclaw/channel-plugin-mochat@0.2.3
  - @nextclaw/channel-plugin-qq@0.2.3
  - @nextclaw/channel-plugin-slack@0.2.3
  - @nextclaw/channel-plugin-telegram@0.2.3
  - @nextclaw/channel-plugin-wecom@0.2.3
  - @nextclaw/channel-plugin-whatsapp@0.2.3

## 0.3.5

### Patch Changes

- Fix plugin hot-reload cache invalidation so upgraded Codex runtime plugins take effect without requiring a service restart.

## 0.3.4

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.2
  - @nextclaw/channel-runtime@0.2.2
  - @nextclaw/channel-plugin-dingtalk@0.2.2
  - @nextclaw/channel-plugin-discord@0.2.2
  - @nextclaw/channel-plugin-email@0.2.2
  - @nextclaw/channel-plugin-feishu@0.2.2
  - @nextclaw/channel-plugin-mochat@0.2.2
  - @nextclaw/channel-plugin-qq@0.2.2
  - @nextclaw/channel-plugin-slack@0.2.2
  - @nextclaw/channel-plugin-telegram@0.2.2
  - @nextclaw/channel-plugin-wecom@0.2.2
  - @nextclaw/channel-plugin-whatsapp@0.2.2

## 0.3.3

### Patch Changes

- Republish the NCP-linked package set so published consumers resolve the
  latest NCP protocol/runtime exports used by the current NextClaw CLI build.
- Updated dependencies
  - @nextclaw/ncp@0.3.1
  - @nextclaw/ncp-toolkit@0.4.1

## 0.3.2

### Patch Changes

- Republish the core-linked package set so published consumers resolve the
  DisposableStore export from the updated @nextclaw/core release.
- Updated dependencies
  - @nextclaw/core@0.9.1
  - @nextclaw/channel-runtime@0.2.1
  - @nextclaw/channel-plugin-dingtalk@0.2.1
  - @nextclaw/channel-plugin-discord@0.2.1
  - @nextclaw/channel-plugin-email@0.2.1
  - @nextclaw/channel-plugin-feishu@0.2.1
  - @nextclaw/channel-plugin-mochat@0.2.1
  - @nextclaw/channel-plugin-qq@0.2.1
  - @nextclaw/channel-plugin-slack@0.2.1
  - @nextclaw/channel-plugin-telegram@0.2.1
  - @nextclaw/channel-plugin-wecom@0.2.1
  - @nextclaw/channel-plugin-whatsapp@0.2.1

## 0.3.1

### Patch Changes

- Unify the latest NCP native chat chain improvements into a single release batch:
  - fix NCP streaming/state-manager promotion so tool-first assistant streams do not lose parts
  - align session type handling to stay generic outside the built-in native type
  - remove runtime-specific default-model branching and use a generic session-scoped fallback strategy
  - ship the latest NextClaw UI, server, and CLI cutover fixes together
  - republish direct dependents of `@nextclaw/ncp-toolkit` for version alignment

- Updated dependencies
  - @nextclaw/ncp-toolkit@0.4.0

## 0.3.0

### Minor Changes

- Unify the latest NCP native chat chain, runtime capability assembly, chat UI alignment, stream/reasoning/tool fixes, and marketplace metadata publishing into a single minor release.

### Patch Changes

- Updated dependencies
  - @nextclaw/channel-plugin-dingtalk@0.2.0
  - @nextclaw/channel-plugin-discord@0.2.0
  - @nextclaw/channel-plugin-email@0.2.0
  - @nextclaw/channel-plugin-feishu@0.2.0
  - @nextclaw/channel-plugin-mochat@0.2.0
  - @nextclaw/channel-plugin-qq@0.2.0
  - @nextclaw/channel-plugin-slack@0.2.0
  - @nextclaw/channel-plugin-telegram@0.2.0
  - @nextclaw/channel-plugin-wecom@0.2.0
  - @nextclaw/channel-plugin-whatsapp@0.2.0
  - @nextclaw/channel-runtime@0.2.0
  - @nextclaw/core@0.9.0

## 0.2.7

### Patch Changes

- Updated dependencies [eb9562b]
  - @nextclaw/core@0.8.0
  - @nextclaw/channel-runtime@0.1.36
  - @nextclaw/channel-plugin-dingtalk@0.1.12
  - @nextclaw/channel-plugin-discord@0.1.13
  - @nextclaw/channel-plugin-email@0.1.12
  - @nextclaw/channel-plugin-feishu@0.1.12
  - @nextclaw/channel-plugin-mochat@0.1.12
  - @nextclaw/channel-plugin-qq@0.1.12
  - @nextclaw/channel-plugin-slack@0.1.12
  - @nextclaw/channel-plugin-telegram@0.1.12
  - @nextclaw/channel-plugin-wecom@0.1.12
  - @nextclaw/channel-plugin-whatsapp@0.1.12

## 0.2.6

### Patch Changes

- Add model-level thinking capability configuration and session thinking selector with backend fallback alignment.
- Updated dependencies
  - @nextclaw/core@0.7.7
  - @nextclaw/channel-runtime@0.1.35
  - @nextclaw/channel-plugin-dingtalk@0.1.11
  - @nextclaw/channel-plugin-discord@0.1.12
  - @nextclaw/channel-plugin-email@0.1.11
  - @nextclaw/channel-plugin-feishu@0.1.11
  - @nextclaw/channel-plugin-mochat@0.1.11
  - @nextclaw/channel-plugin-qq@0.1.11
  - @nextclaw/channel-plugin-slack@0.1.11
  - @nextclaw/channel-plugin-telegram@0.1.11
  - @nextclaw/channel-plugin-wecom@0.1.11
  - @nextclaw/channel-plugin-whatsapp@0.1.11

## 0.2.5

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.7.6
  - @nextclaw/channel-runtime@0.1.34
  - @nextclaw/channel-plugin-dingtalk@0.1.10
  - @nextclaw/channel-plugin-discord@0.1.11
  - @nextclaw/channel-plugin-email@0.1.10
  - @nextclaw/channel-plugin-feishu@0.1.10
  - @nextclaw/channel-plugin-mochat@0.1.10
  - @nextclaw/channel-plugin-qq@0.1.10
  - @nextclaw/channel-plugin-slack@0.1.10
  - @nextclaw/channel-plugin-telegram@0.1.10
  - @nextclaw/channel-plugin-wecom@0.1.10
  - @nextclaw/channel-plugin-whatsapp@0.1.10

## 0.2.4

### Patch Changes

- Publish merged PR changes and synchronize the runtime dependency chain for npm consumption.
  This release includes configurable search provider support and workspace development export alignment.
- Updated dependencies
  - @nextclaw/core@0.7.5
  - @nextclaw/channel-runtime@0.1.33
  - @nextclaw/channel-plugin-dingtalk@0.1.9
  - @nextclaw/channel-plugin-discord@0.1.10
  - @nextclaw/channel-plugin-email@0.1.9
  - @nextclaw/channel-plugin-feishu@0.1.9
  - @nextclaw/channel-plugin-mochat@0.1.9
  - @nextclaw/channel-plugin-qq@0.1.9
  - @nextclaw/channel-plugin-slack@0.1.9
  - @nextclaw/channel-plugin-telegram@0.1.9
  - @nextclaw/channel-plugin-wecom@0.1.9
  - @nextclaw/channel-plugin-whatsapp@0.1.9

## 0.2.3

### Patch Changes

- Unified ecosystem release for accumulated chat runtime alignment, stop behavior hardening,
  frontend sticky autoscroll fixes, and package dependency consistency.
- Updated dependencies
  - @nextclaw/channel-plugin-dingtalk@0.1.8
  - @nextclaw/channel-plugin-discord@0.1.9
  - @nextclaw/channel-plugin-email@0.1.8
  - @nextclaw/channel-plugin-feishu@0.1.8
  - @nextclaw/channel-plugin-mochat@0.1.8
  - @nextclaw/channel-plugin-qq@0.1.8
  - @nextclaw/channel-plugin-slack@0.1.8
  - @nextclaw/channel-plugin-telegram@0.1.8
  - @nextclaw/channel-plugin-wecom@0.1.8
  - @nextclaw/channel-plugin-whatsapp@0.1.8
  - @nextclaw/channel-runtime@0.1.32
  - @nextclaw/core@0.7.4

## 0.2.2

### Patch Changes

- Updated dependencies
  - @nextclaw/channel-runtime@0.1.31
  - @nextclaw/channel-plugin-dingtalk@0.1.7
  - @nextclaw/channel-plugin-discord@0.1.8
  - @nextclaw/channel-plugin-email@0.1.7
  - @nextclaw/channel-plugin-feishu@0.1.7
  - @nextclaw/channel-plugin-mochat@0.1.7
  - @nextclaw/channel-plugin-qq@0.1.7
  - @nextclaw/channel-plugin-slack@0.1.7
  - @nextclaw/channel-plugin-telegram@0.1.7
  - @nextclaw/channel-plugin-wecom@0.1.7
  - @nextclaw/channel-plugin-whatsapp@0.1.7

## 0.2.1

### Patch Changes

- Release core/runtime/server/CLI linkage updates for telegram streaming and subagent behavior fixes.
- Updated dependencies
  - @nextclaw/core@0.7.3
  - @nextclaw/channel-runtime@0.1.30

## 0.2.0

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
  - @nextclaw/nextclaw-engine-codex-sdk@0.2.0
  - @nextclaw/nextclaw-engine-claude-agent-sdk@0.2.0
  - @nextclaw/channel-runtime@0.1.29

## 0.1.34

### Patch Changes

- Release runtime/session fixes and frontend configuration improvements together.
  - fix session persistence across non-streaming/runtime paths
  - stabilize Feishu conversation routing
  - include frontend max-token optimization and related config UX updates
  - republish dependent channel/plugin packages for version consistency

- Updated dependencies
  - @nextclaw/core@0.6.45
  - @nextclaw/channel-runtime@0.1.28
  - @nextclaw/channel-plugin-telegram@0.1.6
  - @nextclaw/channel-plugin-whatsapp@0.1.6
  - @nextclaw/channel-plugin-discord@0.1.7
  - @nextclaw/channel-plugin-feishu@0.1.6
  - @nextclaw/channel-plugin-mochat@0.1.6
  - @nextclaw/channel-plugin-dingtalk@0.1.6
  - @nextclaw/channel-plugin-wecom@0.1.6
  - @nextclaw/channel-plugin-email@0.1.6
  - @nextclaw/channel-plugin-slack@0.1.6
  - @nextclaw/channel-plugin-qq@0.1.6

## 0.1.33

### Patch Changes

- release all pending changes including dynamic custom provider management, custom provider model prefix stripping before upstream calls, and marketplace source link wrapping fix in detail cards.
- Updated dependencies
  - @nextclaw/core@0.6.44
  - @nextclaw/channel-runtime@0.1.27

## 0.1.32

### Patch Changes

- support dynamic custom providers with add/edit/delete workflow, ensure custom provider test model selection is provider-scoped, and strip only the provider routing prefix before upstream OpenAI-compatible API calls.
- Updated dependencies
  - @nextclaw/core@0.6.43
  - @nextclaw/channel-runtime@0.1.26

## 0.1.31

### Patch Changes

- Align MiniMax default API base to the CN endpoint and add clear region-specific guidance in provider settings.
- Updated dependencies
  - @nextclaw/core@0.6.42
  - @nextclaw/channel-runtime@0.1.25

## 0.1.30

### Patch Changes

- Refresh provider default model catalogs to latest-generation options, improve provider/model selection UX, and align config model list behaviors.
- Updated dependencies
  - @nextclaw/core@0.6.39
  - @nextclaw/channel-runtime@0.1.22

## 0.1.29

### Patch Changes

- Fix provider API base routing for non-gateway providers and upgrade providers configuration UX in UI.
- Updated dependencies
  - @nextclaw/core@0.6.38
  - @nextclaw/channel-runtime@0.1.21

## 0.1.28

### Patch Changes

- Add a built-in `nextclaw-skill-resource-hub` skill to curate NextClaw-first skill ecosystem resources, including OpenClaw and community sources.
- Updated dependencies
  - @nextclaw/core@0.6.34
  - @nextclaw/channel-runtime@0.1.20

## 0.1.27

### Patch Changes

- Raise the default `agents.defaults.maxToolIterations` from 20 to 1000 to reduce premature tool-loop fallback responses in long tool chains.
- Updated dependencies
  - @nextclaw/core@0.6.33
  - @nextclaw/channel-runtime@0.1.19

## 0.1.26

### Patch Changes

- fix: defer Discord slash command replies to avoid interaction timeouts
- Updated dependencies
  - @nextclaw/channel-runtime@0.1.18
  - @nextclaw/channel-plugin-discord@0.1.6

## 0.1.25

### Patch Changes

- Sync NextClaw packages with updated core and channel runtime versions.

## 0.1.24

### Patch Changes

- Add Discord preview streaming config and runtime support while keeping channel plugin compatibility.
- Updated dependencies
  - @nextclaw/core@0.6.31
  - @nextclaw/channel-runtime@0.1.16
  - @nextclaw/channel-plugin-discord@0.1.5
  - @nextclaw/channel-plugin-telegram@0.1.5
  - @nextclaw/channel-plugin-whatsapp@0.1.5
  - @nextclaw/channel-plugin-feishu@0.1.5
  - @nextclaw/channel-plugin-mochat@0.1.5
  - @nextclaw/channel-plugin-dingtalk@0.1.5
  - @nextclaw/channel-plugin-wecom@0.1.5
  - @nextclaw/channel-plugin-email@0.1.5
  - @nextclaw/channel-plugin-slack@0.1.5
  - @nextclaw/channel-plugin-qq@0.1.5

## 0.1.23

### Patch Changes

- Add Discord preview streaming config and runtime support while keeping channel plugin compatibility.
- Updated dependencies
  - @nextclaw/core@0.6.30
  - @nextclaw/channel-runtime@0.1.15
  - @nextclaw/channel-plugin-discord@0.1.4
  - @nextclaw/channel-plugin-telegram@0.1.4
  - @nextclaw/channel-plugin-whatsapp@0.1.4
  - @nextclaw/channel-plugin-feishu@0.1.4
  - @nextclaw/channel-plugin-mochat@0.1.4
  - @nextclaw/channel-plugin-dingtalk@0.1.4
  - @nextclaw/channel-plugin-wecom@0.1.4
  - @nextclaw/channel-plugin-email@0.1.4
  - @nextclaw/channel-plugin-slack@0.1.4
  - @nextclaw/channel-plugin-qq@0.1.4

## 0.1.22

### Patch Changes

- Fix agent tool-loop stalls by emitting a fallback reply after the max tool-iteration limit.
- Updated dependencies
  - @nextclaw/core@0.6.29
  - @nextclaw/channel-runtime@0.1.14
  - @nextclaw/channel-plugin-dingtalk@0.1.3
  - @nextclaw/channel-plugin-discord@0.1.3
  - @nextclaw/channel-plugin-email@0.1.3
  - @nextclaw/channel-plugin-feishu@0.1.3
  - @nextclaw/channel-plugin-mochat@0.1.3
  - @nextclaw/channel-plugin-qq@0.1.3
  - @nextclaw/channel-plugin-slack@0.1.3
  - @nextclaw/channel-plugin-telegram@0.1.3
  - @nextclaw/channel-plugin-wecom@0.1.3
  - @nextclaw/channel-plugin-whatsapp@0.1.3

## 0.1.21

### Patch Changes

- Fix plugin hot-plug behavior so disabling bundled channel plugins (like Discord) takes effect immediately and enabling restores runtime behavior.

  Also normalize marketplace manage targets from canonical npm specs to real plugin IDs and harden config reload watching for first-time config file creation.

## 0.1.20

### Patch Changes

- feat: hot-apply plugin config changes without restarting the gateway process.
  - treat `plugins.*` as reloadable config paths
  - hot-reload plugin registry / plugin channel gateways / channel manager in-place
  - apply plugin extension registry updates to agent runtime pool
  - make `plugins` CLI install/enable/disable/uninstall default to hot-apply messaging
  - update usage docs with plugin hot-reload behavior

- Updated dependencies
  - @nextclaw/core@0.6.27
  - @nextclaw/channel-runtime@0.1.13

## 0.1.19

### Patch Changes

- fix: prevent broken historical tool-call chains from causing provider 400 in long-running Discord multi-agent sessions.
  - sanitize stale `assistant(tool_calls)` + `tool` history pairs before provider requests
  - preserve active trailing tool-call chain semantics
  - reduce INVALID_ARGUMENT failures after context-budget pruning

- Updated dependencies
  - @nextclaw/core@0.6.26
  - @nextclaw/channel-runtime@0.1.12

## 0.1.18

### Patch Changes

- Add strict dmScope enum guardrails in docs and runtime context prompts, and align AI config-write flow with schema-first patching.
- Updated dependencies
  - @nextclaw/core@0.6.25
  - @nextclaw/channel-runtime@0.1.11

## 0.1.17

### Patch Changes

- Align input-context handling with an OpenClaw-style token-budget pruner.
  - add unified input budget pruning in agent and subagent loops
  - support `agents.defaults.contextTokens` and per-agent `contextTokens` overrides
  - hot-reload context token budget updates
  - document configuration and multi-agent usage updates

- Updated dependencies
  - @nextclaw/core@0.6.24
  - @nextclaw/channel-runtime@0.1.10

## 0.1.16

### Patch Changes

- Align Discord/Telegram typing lifecycle with OpenClaw-style run completion cleanup.
  - Add typing-stop control message in core bus for no-reply paths.
  - Route control messages through ChannelManager without normal outbound delivery.
  - Keep typing active during agent processing and stop via outbound/control events.
  - Improve typing heartbeat/TTL defaults for long-running replies.

- Updated dependencies
  - @nextclaw/core@0.6.23
  - @nextclaw/channel-runtime@0.1.9

## 0.1.15

### Patch Changes

- Align multi-agent gateway capabilities with OpenClaw:
  - add bindings-based route resolver and agent runtime pool
  - add agents.list multi-runtime support in gateway service
  - add session.dmScope based session key isolation (including per-account-channel-peer)
  - add agentToAgent.maxPingPongTurns enforcement in sessions_send
  - complete Discord and Telegram policy parity (dmPolicy/groupPolicy/mention gates/account metadata)

- Updated dependencies
  - @nextclaw/core@0.6.22
  - @nextclaw/channel-runtime@0.1.8

## 0.1.14

### Patch Changes

- release: add WeCom channel support and harden dev runner port fallback.
  - add built-in WeCom channel runtime, plugin package, schema, UI fields and docs
  - add robust dev-runner port fallback to avoid API misrouting under port conflicts
  - publish linked package updates for runtime/plugin compatibility alignment

- Updated dependencies
  - @nextclaw/core@0.6.21
  - @nextclaw/channel-runtime@0.1.7
  - @nextclaw/channel-plugin-telegram@0.1.2
  - @nextclaw/channel-plugin-whatsapp@0.1.2
  - @nextclaw/channel-plugin-discord@0.1.2
  - @nextclaw/channel-plugin-feishu@0.1.2
  - @nextclaw/channel-plugin-mochat@0.1.2
  - @nextclaw/channel-plugin-dingtalk@0.1.2
  - @nextclaw/channel-plugin-email@0.1.2
  - @nextclaw/channel-plugin-slack@0.1.2
  - @nextclaw/channel-plugin-qq@0.1.2
  - @nextclaw/channel-plugin-wecom@0.1.2

## 0.1.13

### Patch Changes

- Stop channel typing indicators immediately after inbound processing completes (including no-reply paths like <noreply/>), instead of waiting for auto-stop timeout.
- Updated dependencies
  - @nextclaw/channel-runtime@0.1.6

## 0.1.12

### Patch Changes

- Follow-up linkage release after @nextclaw/channel-runtime@0.1.5 so downstream installs consume the Discord outbound chunking fix consistently.

## 0.1.11

### Patch Changes

- Adopt `<noreply/>` as the silent marker and stop reply/output processing when the marker appears. Cascade release all direct dependents of `@nextclaw/core` to keep internal versions aligned.
- Updated dependencies
  - @nextclaw/core@0.6.20
  - @nextclaw/channel-runtime@0.1.4

## 0.1.10

### Patch Changes

- Align internal dependency on `@nextclaw/core@^0.6.18` and publish dependent packages together.
- Updated dependencies
  - @nextclaw/channel-runtime@0.1.3

## 0.1.9

### Patch Changes

- Complete final OpenClaw alignment by fully externalizing builtin channel runtime from core, moving extension packages into a dedicated extensions workspace path, and wiring channel plugins directly to runtime package.
- Updated dependencies
  - @nextclaw/core@0.6.17
  - @nextclaw/channel-runtime@0.1.1
  - @nextclaw/channel-plugin-telegram@0.1.1
  - @nextclaw/channel-plugin-whatsapp@0.1.1
  - @nextclaw/channel-plugin-discord@0.1.1
  - @nextclaw/channel-plugin-feishu@0.1.1
  - @nextclaw/channel-plugin-mochat@0.1.1
  - @nextclaw/channel-plugin-dingtalk@0.1.1
  - @nextclaw/channel-plugin-email@0.1.1
  - @nextclaw/channel-plugin-slack@0.1.1
  - @nextclaw/channel-plugin-qq@0.1.1

## 0.1.8

### Patch Changes

- Externalize bundled channel implementations into independent installable channel plugin packages and make compat loader resolve bundled channels from those package entries.

## 0.1.7

### Patch Changes

- Align plugin registration architecture with OpenClaw by introducing a dedicated registry module and routing bundled/external plugin registration through a unified API registration path.

## 0.1.6

### Patch Changes

- Align built-in channel loading with OpenClaw-style plugin registration by splitting bundled channel definitions, routing bundled channels through register(api), and keeping channel runtime purely plugin-registry driven.
- Updated dependencies
  - @nextclaw/core@0.6.16

## 0.1.5

### Patch Changes

- Restore OpenClaw-compatible plugin support in NextClaw with a NextClaw-only discovery policy.
  - Restore plugin CLI and runtime integration (`plugins *`, `channels add`, runtime loading bridge).
  - Restore `plugins.*` config schema and reload semantics.
  - Keep OpenClaw plugin compatibility while only scanning NextClaw plugin directories.
  - Do not scan legacy `.openclaw/extensions` directories by default.

- Updated dependencies
  - @nextclaw/core@0.6.2

## 0.1.4

### Patch Changes

- - Improve gateway self-restart behavior after in-process update flow.
  - Refine self-management prompts/docs for update and runtime guidance.
  - Disable OpenClaw plugin loading by default unless `NEXTCLAW_ENABLE_OPENCLAW_PLUGINS=1` is explicitly set.
- Updated dependencies
  - @nextclaw/core@0.5.3

## 0.1.3

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.5.0

## 0.1.2

### Patch Changes

- Align OpenClaw plugin compatibility for channel runtime behavior.
  - Add channel messageToolHints resolution and inject hints into agent system prompt messaging guidance.
  - Forward plugin AccountId context through runtime bridge so channel/account-specific hints can resolve.
  - Improve OpenClaw channel integration path for ClawBay-compatible plugins and update docs/logs.

- Updated dependencies
  - @nextclaw/core@0.4.9

## 0.1.1

### Patch Changes

- Unify internal package names under the `@nextclaw` scope while keeping the CLI package name as `nextclaw`.
  - Rename packages to `@nextclaw/core`, `@nextclaw/server`, and `@nextclaw/openclaw-compat`.
  - Update all workspace imports, dependency declarations, and TypeScript path aliases.
  - Keep plugin compatibility behavior and CLI user experience unchanged.

- Updated dependencies
  - @nextclaw/core@0.4.8
