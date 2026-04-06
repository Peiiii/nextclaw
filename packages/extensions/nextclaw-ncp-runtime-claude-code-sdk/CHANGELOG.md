# @nextclaw/nextclaw-ncp-runtime-claude-code-sdk

## 0.1.18

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.5.0

## 0.1.17

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.4.6

## 0.1.16

### Patch Changes

- Updated dependencies [f65c1f5]
  - @nextclaw/ncp@0.4.5

## 0.1.15

### Patch Changes

- Publish the remaining unpublished drift from today's commits as one unified patch batch.

  This batch includes the chat skill token rendering and recent-skill ordering updates, the enter-to-send guard while a chat run is active, and the tightened tool argument validation across the NCP/runtime bridge. It also republishes the dependent public package chain so workspace dependency versions stay aligned for downstream installs.

- Updated dependencies
  - @nextclaw/ncp@0.4.4

## 0.1.14

### Patch Changes

- 9a336f2: Publish the remaining public-package drift from today's commits as one unified patch batch, including the channel enable/disable fixes, declarative channel form layout, subagent follow-up/runtime fixes, and the landing asset updates that landed after the last tagged release.
- Updated dependencies [9a336f2]
  - @nextclaw/ncp@0.4.3

## 0.1.13

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.4.2

## 0.1.12

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.4.1

## 0.1.11

### Patch Changes

- Publish the current committed runtime and UI startup fixes as one aligned patch batch. This release moves the Codex runtime plugin onto host-injected agent runtime APIs, splits UI session reads from the deferred NCP runtime so `/api/ncp/sessions` is available before the runtime agent is ready, and republishes the linked public packages above the currently published tags so the shipped dependency chain stays version-consistent.

## 0.1.10

### Patch Changes

- Publish the pending branch changes for Claude NCP event visibility and chat tool status feedback. Claude runtime now exposes richer reasoning and tool-call events to the NCP layer, and the shared chat UI surfaces clearer tool lifecycle states, call IDs, and output labels.

## 0.1.9

### Patch Changes

- Expose Claude reasoning, tool call, and tool result events through the shared NCP event stream so NextClaw chat renders Claude sessions like other runtimes.

## 0.1.8

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.4.0

## 0.1.7

### Patch Changes

- Ship the full set of current unreleased workspace package changes in one release batch, including the server/CLI updates already sitting in the working tree and the previously committed public package drift that has not been published yet. Republish the NCP agent runtime export surface so NextClaw can resolve `LocalAttachmentStore` after update, and add a release guard that blocks shipping public workspace dependents when a package has drifted past its published tag without a pending changeset.
- Updated dependencies
  - @nextclaw/ncp@0.3.3

## 0.1.6

### Patch Changes

- Disable the default 30s Claude request timeout for real chat turns so long-running Claude sessions are only stopped by explicit aborts or an explicitly configured `requestTimeoutMs`.

## 0.1.5

### Patch Changes

- Fix Claude NCP runtime model routing by bridging Anthropic Messages to OpenAI-compatible providers, remove the Claude model whitelist concept, and keep the Claude model selector stable when the previously selected model is missing.

## 0.1.4

### Patch Changes

- Republish all public workspace packages with pnpm publish guards so released manifests no longer retain workspace:\* dependencies and future npm publish misuse is blocked before release.
- Updated dependencies
  - @nextclaw/ncp@0.3.2

## 0.1.3

### Patch Changes

- Fix Claude marketplace installs so the bundled Claude Agent SDK CLI path still resolves when the package does not export `./package.json`.

## 0.1.2

### Patch Changes

- Fix Claude readiness probing so working Anthropic-compatible routes are not marked unavailable by a probe-only USD budget cap, and improve local first-party plugin loading when running NextClaw from source.

## 0.1.1

### Patch Changes

- Bundle the Claude runtime entry so published artifacts include all required local modules and the marketplace plugin can be installed successfully from npm.

## 0.1.0

### Minor Changes

- Add the first Claude-backed NCP runtime and official plugin package so NextClaw can expose Claude sessions through the pluggable runtime registry and marketplace flow.
