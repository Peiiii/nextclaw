# @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk

## 0.1.48

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
  - @nextclaw/ncp-toolkit@0.5.3

## 0.1.47

### Patch Changes

- f718589: Make Codex prompts include uploaded file and image parts as asset reference blocks instead of silently dropping them from the final runtime input.

## 0.1.46

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
  - @nextclaw/ncp-toolkit@0.5.2

## 0.1.45

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp-toolkit@0.5.1

## 0.1.44

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.5.0
  - @nextclaw/ncp-toolkit@0.5.0
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.15

## 0.1.43

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp-toolkit@0.4.17

## 0.1.42

### Patch Changes

- Publish the full April 2 to April 3 public package drift as one aligned patch batch.

  This release includes the session-scoped project context chain, project-aware skill loading, chat header project interactions, server path picker improvements, file operation card rendering refinements, and the aligned runtime or engine updates behind them.

  It also republishes the affected direct dependents so workspace dependency versions stay aligned for downstream installs.

- Updated dependencies
  - @nextclaw/ncp-toolkit@0.4.16

## 0.1.41

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.4.6
  - @nextclaw/ncp-toolkit@0.4.15
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.14

## 0.1.40

### Patch Changes

- Updated dependencies [f65c1f5]
  - @nextclaw/ncp@0.4.5
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.13
  - @nextclaw/ncp-toolkit@0.4.14

## 0.1.39

### Patch Changes

- Publish the remaining unpublished drift from today's commits as one unified patch batch.

  This batch includes the chat skill token rendering and recent-skill ordering updates, the enter-to-send guard while a chat run is active, and the tightened tool argument validation across the NCP/runtime bridge. It also republishes the dependent public package chain so workspace dependency versions stay aligned for downstream installs.

- Updated dependencies
  - @nextclaw/ncp@0.4.4
  - @nextclaw/ncp-toolkit@0.4.13
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.12

## 0.1.38

### Patch Changes

- 9a336f2: Publish the remaining public-package drift from today's commits as one unified patch batch, including the channel enable/disable fixes, declarative channel form layout, subagent follow-up/runtime fixes, and the landing asset updates that landed after the last tagged release.
- Updated dependencies [9a336f2]
  - @nextclaw/ncp@0.4.3
  - @nextclaw/ncp-toolkit@0.4.12
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.11

## 0.1.37

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp-toolkit@0.4.11

## 0.1.36

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp-toolkit@0.4.10

## 0.1.35

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.4.2
  - @nextclaw/ncp-toolkit@0.4.9
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.10

## 0.1.34

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp-toolkit@0.4.8

## 0.1.33

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.4.1
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.9
  - @nextclaw/ncp-toolkit@0.4.7

## 0.1.32

### Patch Changes

- f15df6a: Publish the pending NCP realtime sync batch together with the new built-in cross-channel messaging skill and Weixin self-notify route hints.

  This release keeps the product lightweight: the AI reuses the existing reply, `sessions_send`, and `message` primitives, and a fresh UI or NCP session can proactively notify the saved Weixin route without adding a separate notification abstraction.

- Updated dependencies [f15df6a]
  - @nextclaw/ncp-toolkit@0.4.6
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.8

## 0.1.31

### Patch Changes

- Updated dependencies [1ce3d58]
  - @nextclaw/ncp-toolkit@0.4.5

## 0.1.30

### Patch Changes

- Release the accumulated public workspace drift together with the Codex Responses contract fix. This batch includes the new stream-completion probe, the Codex runtime bundle entry alignment, and the already-unpublished package changes that the release guard requires to be versioned before publish.
- Updated dependencies
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.7

## 0.1.29

### Patch Changes

- Fix Codex CLI environment inheritance so the runtime keeps the host `PATH` and other base process variables when spawning command execution, and publish the plugin/runtime pair together for version alignment.
- Updated dependencies
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.6

## 0.1.28

### Patch Changes

- Normalize Codex reasoning output so thought content is emitted as structured reasoning instead of leaking into assistant text.

## 0.1.27

### Patch Changes

- Fix Codex OpenAI-compatible bridge system prompt normalization for MiniMax routing.

## 0.1.26

### Patch Changes

- Publish the current committed runtime and UI startup fixes as one aligned patch batch. This release moves the Codex runtime plugin onto host-injected agent runtime APIs, splits UI session reads from the deferred NCP runtime so `/api/ncp/sessions` is available before the runtime agent is ready, and republishes the linked public packages above the currently published tags so the shipped dependency chain stays version-consistent.

## 0.1.25

### Patch Changes

- Align the Codex NCP runtime plugin with host runtime injection instead of relying on a forced `@nextclaw/core` singleton alias. The plugin now resolves provider runtime, workspace, and bootstrap-aware prompts through the host plugin runtime API, and no longer ships a direct runtime dependency on `@nextclaw/core`.

## 0.1.24

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.4.0
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.5
  - @nextclaw/ncp-toolkit@0.4.4

## 0.1.23

### Patch Changes

- Ship the full set of current unreleased workspace package changes in one release batch, including the server/CLI updates already sitting in the working tree and the previously committed public package drift that has not been published yet. Republish the NCP agent runtime export surface so NextClaw can resolve `LocalAttachmentStore` after update, and add a release guard that blocks shipping public workspace dependents when a package has drifted past its published tag without a pending changeset.
- Updated dependencies
  - @nextclaw/ncp@0.3.3
  - @nextclaw/core@0.11.2
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.4
  - @nextclaw/ncp-toolkit@0.4.3

## 0.1.22

### Patch Changes

- Publish the latest Codex runtime plugin changes from HEAD, including the new access-mode mapping, bundled packaging alignment, and prompt/input cleanup.

## 0.1.21

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.11.1

## 0.1.20

### Patch Changes

- Bundle the published Codex runtime plugin entry so internal helper modules are always shipped with the installable package.

## 0.1.19

### Patch Changes

- Collapse the Codex runtime permission model into a single `accessMode` field, default it to `full-access`, and keep legacy `sandboxMode` only as a migration fallback.

## 0.1.18

### Patch Changes

- Updated dependencies [bb891c2]
  - @nextclaw/core@0.11.0

## 0.1.17

### Patch Changes

- 004b779: Stop surfacing Codex SDK non-fatal model metadata warnings as user-visible tool/error messages in codex sessions for OpenAI-compatible models such as DashScope `qwen3-coder-next`.
- Updated dependencies [004b779]
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.3

## 0.1.16

### Patch Changes

- Release the codex bridge fix so codex sessions can keep using the codex-sdk runtime with OpenAI-compatible models that only expose chat completions, including DashScope `qwen3-coder-next`.

## 0.1.15

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.10.0

## 0.1.14

### Patch Changes

- Republish all public workspace packages with pnpm publish guards so released manifests no longer retain workspace:\* dependencies and future npm publish misuse is blocked before release.
- Updated dependencies
  - @nextclaw/core@0.9.12
  - @nextclaw/ncp@0.3.2
  - @nextclaw/ncp-toolkit@0.4.2
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.2

## 0.1.13

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.11

## 0.1.12

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.10

## 0.1.11

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.9

## 0.1.10

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.8

## 0.1.9

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.7

## 0.1.8

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.6

## 0.1.7

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.5

## 0.1.6

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.4

## 0.1.5

### Patch Changes

- Updated dependencies [7e3aa0d]
  - @nextclaw/core@0.9.3

## 0.1.4

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.2

## 0.1.3

### Patch Changes

- Republish the NCP-linked package set so published consumers resolve the
  latest NCP protocol/runtime exports used by the current NextClaw CLI build.
- Updated dependencies
  - @nextclaw/ncp@0.3.1
  - @nextclaw/ncp-toolkit@0.4.1
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.1

## 0.1.2

### Patch Changes

- Republish the core-linked package set so published consumers resolve the
  DisposableStore export from the updated @nextclaw/core release.
- Updated dependencies
  - @nextclaw/core@0.9.1

## 0.1.1

### Patch Changes

- Unify the latest NCP native chat chain improvements into a single release batch:
  - fix NCP streaming/state-manager promotion so tool-first assistant streams do not lose parts
  - align session type handling to stay generic outside the built-in native type
  - remove runtime-specific default-model branching and use a generic session-scoped fallback strategy
  - ship the latest NextClaw UI, server, and CLI cutover fixes together
  - republish direct dependents of `@nextclaw/ncp-toolkit` for version alignment

- Updated dependencies
  - @nextclaw/ncp-toolkit@0.4.0
