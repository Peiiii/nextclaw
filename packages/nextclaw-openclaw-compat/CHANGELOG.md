# @nextclaw/openclaw-compat

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
