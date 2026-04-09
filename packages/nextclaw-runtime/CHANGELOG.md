# @nextclaw/runtime

## 0.2.35

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
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
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/core@0.12.3

## 0.2.34

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
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
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/core@0.12.2

## 0.2.33

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.12.1

## 0.2.32

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.12.0

## 0.2.31

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.11.17

## 0.2.30

### Patch Changes

- Publish the full April 2 to April 3 public package drift as one aligned patch batch.

  This release includes the session-scoped project context chain, project-aware skill loading, chat header project interactions, server path picker improvements, file operation card rendering refinements, and the aligned runtime or engine updates behind them.

  It also republishes the affected direct dependents so workspace dependency versions stay aligned for downstream installs.

- Updated dependencies
  - @nextclaw/core@0.11.16

## 0.2.29

### Patch Changes

- Publish the remaining unpublished workspace drift from March 31 and April 1 as one aligned patch batch, including the native file preview pipeline updates, structured terminal tool result rendering, and the recent tool card UX refinements.
- Updated dependencies
  - @nextclaw/core@0.11.15

## 0.2.28

### Patch Changes

- Publish the remaining unpublished drift from today's commits as one unified patch batch.

  This batch includes the chat skill token rendering and recent-skill ordering updates, the enter-to-send guard while a chat run is active, and the tightened tool argument validation across the NCP/runtime bridge. It also republishes the dependent public package chain so workspace dependency versions stay aligned for downstream installs.

- Updated dependencies
  - @nextclaw/core@0.11.14

## 0.2.27

### Patch Changes

- 9a336f2: Publish the remaining public-package drift from today's commits as one unified patch batch, including the channel enable/disable fixes, declarative channel form layout, subagent follow-up/runtime fixes, and the landing asset updates that landed after the last tagged release.
- Updated dependencies [9a336f2]
  - @nextclaw/core@0.11.13

## 0.2.26

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.11.12

## 0.2.25

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.11.11

## 0.2.24

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.11.10

## 0.2.23

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.11.9

## 0.2.22

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.11.8

## 0.2.21

### Patch Changes

- Release the current cross-channel routing fixes as one aligned patch batch.
  - expose built-in skill descriptions so the agent can discover `cross-channel-messaging` at the right time
  - let `sessions_list` filter by resolved route fields such as `channel`, `to`, `accountId`, and `sessionKey`
  - fail fast when `message` tries to send to another channel without an explicit target, preventing false-success Feishu sends
  - clarify Feishu and Weixin route lookup guidance so proactive sends reuse saved session routes instead of guessing identifiers
  - include the already-unpublished `@nextclaw/runtime` provider catalog drift in the same release closure so release health returns to clean

- Updated dependencies
  - @nextclaw/core@0.11.7

## 0.2.20

### Patch Changes

- f15df6a: Publish the pending NCP realtime sync batch together with the new built-in cross-channel messaging skill and Weixin self-notify route hints.

  This release keeps the product lightweight: the AI reuses the existing reply, `sessions_send`, and `message` primitives, and a fresh UI or NCP session can proactively notify the saved Weixin route without adding a separate notification abstraction.

- Updated dependencies [f15df6a]
  - @nextclaw/core@0.11.6

## 0.2.19

### Patch Changes

- Promote Weixin to the same builtin channel surface as the other first-party messaging channels. Reserve `channels.weixin` in the default config, include Weixin in the builtin channel list, and expose Weixin in CLI status and product documentation for fresh installs.
- Updated dependencies
  - @nextclaw/core@0.11.5

## 0.2.17

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.11.3

## 0.2.16

### Patch Changes

- Ship the full set of current unreleased workspace package changes in one release batch, including the server/CLI updates already sitting in the working tree and the previously committed public package drift that has not been published yet. Republish the NCP agent runtime export surface so NextClaw can resolve `LocalAttachmentStore` after update, and add a release guard that blocks shipping public workspace dependents when a package has drifted past its published tag without a pending changeset.
- Updated dependencies
  - @nextclaw/core@0.11.2

## 0.2.15

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.11.1

## 0.2.14

### Patch Changes

- Updated dependencies [bb891c2]
  - @nextclaw/core@0.11.0

## 0.2.13

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.10.0

## 0.2.12

### Patch Changes

- Republish all public workspace packages with pnpm publish guards so released manifests no longer retain workspace:\* dependencies and future npm publish misuse is blocked before release.
- Updated dependencies
  - @nextclaw/core@0.9.12

## 0.2.11

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.11

## 0.2.10

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.10

## 0.2.9

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.9

## 0.2.8

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.8

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

- 7e3aa0d: Guard OpenAI-compatible automatic `responses` fallback so DashScope models such as `qwen3-coder-next` stay on `chat/completions` instead of being misrouted to an unsupported API.
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

## 0.1.7

### Patch Changes

- Updated dependencies [eb9562b]
  - @nextclaw/core@0.8.0

## 0.1.6

### Patch Changes

- Add model-level thinking capability configuration and session thinking selector with backend fallback alignment.
- Updated dependencies
  - @nextclaw/core@0.7.7

## 0.1.5

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.7.6

## 0.1.4

### Patch Changes

- Publish merged PR changes and synchronize the runtime dependency chain for npm consumption.
  This release includes configurable search provider support and workspace development export alignment.
- Updated dependencies
  - @nextclaw/core@0.7.5

## 0.1.3

### Patch Changes

- Unified ecosystem release for accumulated chat runtime alignment, stop behavior hardening,
  frontend sticky autoscroll fixes, and package dependency consistency.
- Updated dependencies
  - @nextclaw/core@0.7.4

## 0.1.2

### Patch Changes

- Release core/runtime/server/CLI linkage updates for telegram streaming and subagent behavior fixes.
- Updated dependencies
  - @nextclaw/core@0.7.3

## 0.1.1

### Patch Changes

- Refactor provider and channel architecture with core registry mechanism and runtime assembly.
  - Move builtin provider catalog and builtin channel IDs out of core into `@nextclaw/runtime`.
  - Keep provider registry mechanisms in `@nextclaw/core` with injectable catalog support.
  - Update server/CLI to consume runtime-provided builtin provider/channel metadata.
  - Preserve out-of-box behavior for NextClaw provider bootstrap key generation.

- Updated dependencies
  - @nextclaw/core@0.7.1

## 0.1.0

- Initial runtime assembly package for builtin providers/channels.
