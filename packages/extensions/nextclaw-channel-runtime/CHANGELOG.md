# @nextclaw/channel-runtime

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
