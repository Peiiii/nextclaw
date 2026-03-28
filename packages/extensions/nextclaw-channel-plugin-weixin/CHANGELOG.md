# @nextclaw/channel-plugin-weixin

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
