# @nextclaw/nextclaw-engine-codex-sdk

## 0.3.15

### Patch Changes

- Publish the full April 2 to April 3 public package drift as one aligned patch batch.

  This release includes the session-scoped project context chain, project-aware skill loading, chat header project interactions, server path picker improvements, file operation card rendering refinements, and the aligned runtime or engine updates behind them.

  It also republishes the affected direct dependents so workspace dependency versions stay aligned for downstream installs.

- Updated dependencies
  - @nextclaw/core@0.11.16

## 0.3.14

### Patch Changes

- Publish the remaining unpublished workspace drift from March 31 and April 1 as one aligned patch batch, including the native file preview pipeline updates, structured terminal tool result rendering, and the recent tool card UX refinements.
- Updated dependencies
  - @nextclaw/core@0.11.15

## 0.3.13

### Patch Changes

- Publish the remaining unpublished drift from today's commits as one unified patch batch.

  This batch includes the chat skill token rendering and recent-skill ordering updates, the enter-to-send guard while a chat run is active, and the tightened tool argument validation across the NCP/runtime bridge. It also republishes the dependent public package chain so workspace dependency versions stay aligned for downstream installs.

- Updated dependencies
  - @nextclaw/core@0.11.14

## 0.3.12

### Patch Changes

- 9a336f2: Publish the remaining public-package drift from today's commits as one unified patch batch, including the channel enable/disable fixes, declarative channel form layout, subagent follow-up/runtime fixes, and the landing asset updates that landed after the last tagged release.
- Updated dependencies [9a336f2]
  - @nextclaw/core@0.11.13

## 0.3.11

### Patch Changes

- Release the current cross-channel routing fixes as one aligned patch batch.
  - expose built-in skill descriptions so the agent can discover `cross-channel-messaging` at the right time
  - let `sessions_list` filter by resolved route fields such as `channel`, `to`, `accountId`, and `sessionKey`
  - fail fast when `message` tries to send to another channel without an explicit target, preventing false-success Feishu sends
  - clarify Feishu and Weixin route lookup guidance so proactive sends reuse saved session routes instead of guessing identifiers
  - include the already-unpublished `@nextclaw/runtime` provider catalog drift in the same release closure so release health returns to clean

- Updated dependencies
  - @nextclaw/core@0.11.7

## 0.3.10

### Patch Changes

- f15df6a: Publish the pending NCP realtime sync batch together with the new built-in cross-channel messaging skill and Weixin self-notify route hints.

  This release keeps the product lightweight: the AI reuses the existing reply, `sessions_send`, and `message` primitives, and a fresh UI or NCP session can proactively notify the saved Weixin route without adding a separate notification abstraction.

- Updated dependencies [f15df6a]
  - @nextclaw/core@0.11.6

## 0.3.9

### Patch Changes

- Release the accumulated public workspace drift together with the Codex Responses contract fix. This batch includes the new stream-completion probe, the Codex runtime bundle entry alignment, and the already-unpublished package changes that the release guard requires to be versioned before publish.

## 0.3.8

### Patch Changes

- Fix Codex CLI environment inheritance so the runtime keeps the host `PATH` and other base process variables when spawning command execution, and publish the plugin/runtime pair together for version alignment.

## 0.3.7

### Patch Changes

- Release pending workspace drift from earlier package updates.

## 0.3.6

### Patch Changes

- Publish the pending Codex engine plugin drift required by release guards.

## 0.3.5

### Patch Changes

- Ship the full set of current unreleased workspace package changes in one release batch, including the server/CLI updates already sitting in the working tree and the previously committed public package drift that has not been published yet. Republish the NCP agent runtime export surface so NextClaw can resolve `LocalAttachmentStore` after update, and add a release guard that blocks shipping public workspace dependents when a package has drifted past its published tag without a pending changeset.
- Updated dependencies
  - @nextclaw/core@0.11.2

## 0.3.4

### Patch Changes

- Updated dependencies [bb891c2]
  - @nextclaw/core@0.11.0

## 0.3.3

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.10.0

## 0.3.2

### Patch Changes

- Republish all public workspace packages with pnpm publish guards so released manifests no longer retain workspace:\* dependencies and future npm publish misuse is blocked before release.
- Updated dependencies
  - @nextclaw/core@0.9.12

## 0.3.1

### Patch Changes

- Republish the core-linked package set so published consumers resolve the
  DisposableStore export from the updated @nextclaw/core release.
- Updated dependencies
  - @nextclaw/core@0.9.1

## 0.3.0

### Minor Changes

- Unify the latest NCP native chat chain, runtime capability assembly, chat UI alignment, stream/reasoning/tool fixes, and marketplace metadata publishing into a single minor release.

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.0

## 0.2.3

### Patch Changes

- Updated dependencies [eb9562b]
  - @nextclaw/core@0.8.0

## 0.2.2

### Patch Changes

- Publish merged PR changes and synchronize the runtime dependency chain for npm consumption.
  This release includes configurable search provider support and workspace development export alignment.
- Updated dependencies
  - @nextclaw/core@0.7.5

## 0.2.1

### Patch Changes

- Unified ecosystem release for accumulated chat runtime alignment, stop behavior hardening,
  frontend sticky autoscroll fixes, and package dependency consistency.
- Updated dependencies
  - @nextclaw/core@0.7.4

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
