# @nextclaw/channel-plugin-feishu

## 0.2.25

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat-ui
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/core
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/openclaw-compat
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

## 0.2.24

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/core
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

## 0.2.23

### Patch Changes

- 9a336f2: Publish the remaining public-package drift from today's commits as one unified patch batch, including the channel enable/disable fixes, declarative channel form layout, subagent follow-up/runtime fixes, and the landing asset updates that landed after the last tagged release.

## 0.2.22

### Patch Changes

- Release the current cross-channel routing fixes as one aligned patch batch.
  - expose built-in skill descriptions so the agent can discover `cross-channel-messaging` at the right time
  - let `sessions_list` filter by resolved route fields such as `channel`, `to`, `accountId`, and `sessionKey`
  - fail fast when `message` tries to send to another channel without an explicit target, preventing false-success Feishu sends
  - clarify Feishu and Weixin route lookup guidance so proactive sends reuse saved session routes instead of guessing identifiers
  - include the already-unpublished `@nextclaw/runtime` provider catalog drift in the same release closure so release health returns to clean

## 0.2.21

### Patch Changes

- Fix channel startup so a long-running plugin gateway no longer blocks the rest of the channel runtime from starting.

  This release hardens the host-side gateway startup contract and updates the Feishu gateway to run its long-lived monitor in the background, allowing QQ, Discord, Weixin, and other channels to continue starting normally.

## 0.2.20

### Patch Changes

- Fix Feishu immediate feedback by triggering reply-start acknowledgements through the runtime bridge and using a visible receipt reaction instead of a streaming placeholder.

## 0.2.19

### Patch Changes

- Finalize the Feishu upstream capability sync by splitting the sheets implementation into a shared helper module, keeping the new OAuth, calendar, task, sheets, and identity surface maintainable while preserving the released behavior and release-group alignment.

## 0.2.18

### Patch Changes

- Ship the next Feishu upstream capability sync round by adding user-identity execution for OAuth, calendar, task, and sheets operations, plus the supporting ticket and scope plumbing needed to mirror the high-value upstream tool surface inside NextClaw. Republish the NextClaw release group so the bundled CLI/runtime chain stays version-aligned.

## 0.2.17

### Patch Changes

- bb891c2: Add the Phase 1 Feishu platform foundation for NextClaw, including shared Feishu core primitives, richer message conversion, multi-account routing, and the aligned config UI/runtime release chain.

## 0.2.16

### Patch Changes

- Fix the Feishu plugin startup regression where plugin channel gateways enumerated accounts without receiving runtime config, causing nextclaw service startup to fail after update.

## 0.2.15

### Patch Changes

- Remove the Feishu plugin's runtime dependency on `openclaw/plugin-sdk/*` by switching it to a bundled NextClaw thin compatibility layer. Remove the accidental `openclaw` package dependency and delete the `pi-coding-agent` shim that slipped into the previous release.

## 0.2.14

### Patch Changes

- Align bundled Feishu support with the official OpenClaw plugin by vendoring the upstream Feishu plugin into NextClaw, teaching the compat loader to prefer plugin-local OpenClaw SDK resolution, and adding the minimal loader shims needed for the official Feishu tools to register inside NextClaw.

## 0.2.13

### Patch Changes

- Add the Phase 1 Feishu platform foundation for NextClaw, including shared Feishu core primitives, richer message conversion, multi-account routing, and the aligned config UI/runtime release chain.
- Updated dependencies
  - @nextclaw/channel-runtime@0.3.0

## 0.2.12

### Patch Changes

- Republish all public workspace packages with pnpm publish guards so released manifests no longer retain workspace:\* dependencies and future npm publish misuse is blocked before release.
- Updated dependencies
  - @nextclaw/channel-runtime@0.2.12

## 0.2.11

### Patch Changes

- @nextclaw/channel-runtime@0.2.11

## 0.2.10

### Patch Changes

- @nextclaw/channel-runtime@0.2.10

## 0.2.9

### Patch Changes

- @nextclaw/channel-runtime@0.2.9

## 0.2.8

### Patch Changes

- @nextclaw/channel-runtime@0.2.8

## 0.2.7

### Patch Changes

- @nextclaw/channel-runtime@0.2.7

## 0.2.6

### Patch Changes

- @nextclaw/channel-runtime@0.2.6

## 0.2.5

### Patch Changes

- @nextclaw/channel-runtime@0.2.5

## 0.2.4

### Patch Changes

- Updated dependencies
  - @nextclaw/channel-runtime@0.2.4

## 0.2.3

### Patch Changes

- @nextclaw/channel-runtime@0.2.3

## 0.2.2

### Patch Changes

- @nextclaw/channel-runtime@0.2.2

## 0.2.1

### Patch Changes

- Updated dependencies
  - @nextclaw/channel-runtime@0.2.1

## 0.2.0

### Minor Changes

- Unify the latest NCP native chat chain, runtime capability assembly, chat UI alignment, stream/reasoning/tool fixes, and marketplace metadata publishing into a single minor release.

### Patch Changes

- Updated dependencies
  - @nextclaw/channel-runtime@0.2.0

## 0.1.12

### Patch Changes

- @nextclaw/channel-runtime@0.1.36

## 0.1.11

### Patch Changes

- Updated dependencies
  - @nextclaw/channel-runtime@0.1.35

## 0.1.10

### Patch Changes

- @nextclaw/channel-runtime@0.1.34

## 0.1.9

### Patch Changes

- Publish merged PR changes and synchronize the runtime dependency chain for npm consumption.
  This release includes configurable search provider support and workspace development export alignment.
- Updated dependencies
  - @nextclaw/channel-runtime@0.1.33

## 0.1.8

### Patch Changes

- Unified ecosystem release for accumulated chat runtime alignment, stop behavior hardening,
  frontend sticky autoscroll fixes, and package dependency consistency.
- Updated dependencies
  - @nextclaw/channel-runtime@0.1.32

## 0.1.7

### Patch Changes

- Updated dependencies
  - @nextclaw/channel-runtime@0.1.31

## 0.1.6

### Patch Changes

- Release runtime/session fixes and frontend configuration improvements together.
  - fix session persistence across non-streaming/runtime paths
  - stabilize Feishu conversation routing
  - include frontend max-token optimization and related config UX updates
  - republish dependent channel/plugin packages for version consistency

- Updated dependencies
  - @nextclaw/channel-runtime@0.1.28

## 0.1.5

### Patch Changes

- Add Discord preview streaming config and runtime support while keeping channel plugin compatibility.
- Updated dependencies
  - @nextclaw/channel-runtime@0.1.16

## 0.1.4

### Patch Changes

- Add Discord preview streaming config and runtime support while keeping channel plugin compatibility.
- Updated dependencies
  - @nextclaw/channel-runtime@0.1.15

## 0.1.3

### Patch Changes

- Fix agent tool-loop stalls by emitting a fallback reply after the max tool-iteration limit.
- Updated dependencies
  - @nextclaw/channel-runtime@0.1.14

## 0.1.2

### Patch Changes

- release: add WeCom channel support and harden dev runner port fallback.
  - add built-in WeCom channel runtime, plugin package, schema, UI fields and docs
  - add robust dev-runner port fallback to avoid API misrouting under port conflicts
  - publish linked package updates for runtime/plugin compatibility alignment

- Updated dependencies
  - @nextclaw/channel-runtime@0.1.7

## 0.1.1

### Patch Changes

- Complete final OpenClaw alignment by fully externalizing builtin channel runtime from core, moving extension packages into a dedicated extensions workspace path, and wiring channel plugins directly to runtime package.
- Updated dependencies
  - @nextclaw/channel-runtime@0.1.1
