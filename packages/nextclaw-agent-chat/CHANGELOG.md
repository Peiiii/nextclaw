# @nextclaw/agent-chat

## 0.1.5

### Patch Changes

- 9a336f2: Publish the remaining public-package drift from today's commits as one unified patch batch, including the channel enable/disable fixes, declarative channel form layout, subagent follow-up/runtime fixes, and the landing asset updates that landed after the last tagged release.

## 0.1.4

### Patch Changes

- Republish Nextclaw UI with upstream frontend dependency chain.

## 0.1.3

### Patch Changes

- Ship the full set of current unreleased workspace package changes in one release batch, including the server/CLI updates already sitting in the working tree and the previously committed public package drift that has not been published yet. Republish the NCP agent runtime export surface so NextClaw can resolve `LocalAttachmentStore` after update, and add a release guard that blocks shipping public workspace dependents when a package has drifted past its published tag without a pending changeset.

## 0.1.2

### Patch Changes

- Republish all public workspace packages with pnpm publish guards so released manifests no longer retain workspace:\* dependencies and future npm publish misuse is blocked before release.

## 0.1.1

### Patch Changes

- Unified ecosystem release for accumulated chat runtime alignment, stop behavior hardening,
  frontend sticky autoscroll fixes, and package dependency consistency.
