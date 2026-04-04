# @nextclaw/channel-plugin-weixin

## 0.1.24

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.11.17

## 0.1.23

### Patch Changes

- Publish the full April 2 to April 3 public package drift as one aligned patch batch.

  This release includes the session-scoped project context chain, project-aware skill loading, chat header project interactions, server path picker improvements, file operation card rendering refinements, and the aligned runtime or engine updates behind them.

  It also republishes the affected direct dependents so workspace dependency versions stay aligned for downstream installs.

- Updated dependencies
  - @nextclaw/core@0.11.16

## 0.1.22

### Patch Changes

- Publish the remaining unpublished workspace drift from March 31 and April 1 as one aligned patch batch, including the native file preview pipeline updates, structured terminal tool result rendering, and the recent tool card UX refinements.
- Updated dependencies
  - @nextclaw/core@0.11.15

## 0.1.21

### Patch Changes

- Publish the remaining unpublished drift from today's commits as one unified patch batch.

  This batch includes the chat skill token rendering and recent-skill ordering updates, the enter-to-send guard while a chat run is active, and the tightened tool argument validation across the NCP/runtime bridge. It also republishes the dependent public package chain so workspace dependency versions stay aligned for downstream installs.

- Updated dependencies
  - @nextclaw/core@0.11.14

## 0.1.20

### Patch Changes

- 9a336f2: Publish the remaining public-package drift from today's commits as one unified patch batch, including the channel enable/disable fixes, declarative channel form layout, subagent follow-up/runtime fixes, and the landing asset updates that landed after the last tagged release.
- Updated dependencies [9a336f2]
  - @nextclaw/core@0.11.13

## 0.1.19

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.11.12

## 0.1.18

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.11.11

## 0.1.17

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.11.10

## 0.1.16

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.11.9

## 0.1.15

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.11.8

## 0.1.14

### Patch Changes

- Release the current cross-channel routing fixes as one aligned patch batch.
  - expose built-in skill descriptions so the agent can discover `cross-channel-messaging` at the right time
  - let `sessions_list` filter by resolved route fields such as `channel`, `to`, `accountId`, and `sessionKey`
  - fail fast when `message` tries to send to another channel without an explicit target, preventing false-success Feishu sends
  - clarify Feishu and Weixin route lookup guidance so proactive sends reuse saved session routes instead of guessing identifiers
  - include the already-unpublished `@nextclaw/runtime` provider catalog drift in the same release closure so release health returns to clean

- Updated dependencies
  - @nextclaw/core@0.11.7

## 0.1.13

### Patch Changes

- 2a5f94e: Recover the Weixin self-notify release path after a published version collision on `@nextclaw/channel-plugin-weixin`.

  The previous batch released the main packages successfully, but `@nextclaw/channel-plugin-weixin@0.1.12` already existed on npm and was skipped. This recovery release publishes the actual Weixin route-hint changes under a new version and realigns `@nextclaw/openclaw-compat`, `@nextclaw/server`, and `nextclaw` onto that published dependency.

## 0.1.12

### Patch Changes

- f15df6a: Publish the pending NCP realtime sync batch together with the new built-in cross-channel messaging skill and Weixin self-notify route hints.

  This release keeps the product lightweight: the AI reuses the existing reply, `sessions_send`, and `message` primitives, and a fresh UI or NCP session can proactively notify the saved Weixin route without adding a separate notification abstraction.

- Updated dependencies [f15df6a]
  - @nextclaw/core@0.11.6

## 0.1.11

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.11.3

## 0.1.10

### Patch Changes

- Ship the full set of current unreleased workspace package changes in one release batch, including the server/CLI updates already sitting in the working tree and the previously committed public package drift that has not been published yet. Republish the NCP agent runtime export surface so NextClaw can resolve `LocalAttachmentStore` after update, and add a release guard that blocks shipping public workspace dependents when a package has drifted past its published tag without a pending changeset.
- Updated dependencies
  - @nextclaw/core@0.11.2

## 0.1.9

### Patch Changes

- Unify channel configuration around `channels.*` and stop writing channel runtime state back into plugin config entries.

  Preserve plugin-channel config keys in the core schema, route CLI and UI channel reads and writes through the projected channel view, and ensure plugin channel gateways honor the projected `channels.<id>.enabled` state.

- Updated dependencies
  - @nextclaw/core@0.11.1

## 0.1.8

### Patch Changes

- Updated dependencies [bb891c2]
  - @nextclaw/core@0.11.0

## 0.1.7

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.10.0

## 0.1.6

### Patch Changes

- Republish all public workspace packages with pnpm publish guards so released manifests no longer retain workspace:\* dependencies and future npm publish misuse is blocked before release.
- Updated dependencies
  - @nextclaw/core@0.9.12

## 0.1.5

### Patch Changes

- Fix Weixin QR re-auth so rescanning the same Weixin account replaces the current connection instead of appending duplicate bot accounts.

## 0.1.4

### Patch Changes

- Ship the Weixin QR auth flow in the UI, including plugin-backed channel auth sessions and the dedicated scan-first configuration experience.

## 0.1.3

### Patch Changes

- Republish the verified Weixin channel plugin release above already occupied npm versions so the published packages match the repository state that passed real QR login and real reply validation.
- Updated dependencies
  - @nextclaw/core@0.9.11

## 0.1.2

### Patch Changes

- Add the Weixin channel plugin with QR login, long-poll inbound handling, `context_token`-based reply delivery, and `accountId` routing across the shared host contracts.

  Expose plugin-aware `nextclaw channels login --channel weixin`, bundle the new Weixin plugin into the OpenClaw compatibility loader, and pass channel `accountId` through the message tool, cron, and service runtime so verified Weixin reply flows work end to end.

- Updated dependencies
  - @nextclaw/core@0.9.10

## 0.1.1

### Patch Changes

- Add the Weixin channel plugin with QR login, long-poll inbound handling, `context_token`-based reply delivery, and `accountId` routing across the shared host contracts.

  Expose plugin-aware `nextclaw channels login --channel weixin`, bundle the new Weixin plugin into the OpenClaw compatibility loader, and pass channel `accountId` through the message tool, cron, and service runtime so verified Weixin reply flows work end to end.

- Updated dependencies
  - @nextclaw/core@0.9.9
