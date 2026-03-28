# @nextclaw/agent-chat-ui

## 0.2.9

### Patch Changes

- Publish the pending frontend UI batch together with the already-drifted public packages required by release guards.

## 0.2.8

### Patch Changes

- Make Claude engine and NCP runtime prompts bootstrap-aware so workspace context and requested skills are injected consistently, and refresh the shared chat UI tool/file cards to match the current tool lifecycle presentation.

## 0.2.7

### Patch Changes

- Publish the current committed runtime and UI startup fixes as one aligned patch batch. This release moves the Codex runtime plugin onto host-injected agent runtime APIs, splits UI session reads from the deferred NCP runtime so `/api/ncp/sessions` is available before the runtime agent is ready, and republishes the linked public packages above the currently published tags so the shipped dependency chain stays version-consistent.

## 0.2.6

### Patch Changes

- Publish the pending branch changes for Claude NCP event visibility and chat tool status feedback. Claude runtime now exposes richer reasoning and tool-call events to the NCP layer, and the shared chat UI surfaces clearer tool lifecycle states, call IDs, and output labels.

## 0.2.5

### Patch Changes

- Ship the full set of current unreleased workspace package changes in one release batch, including the server/CLI updates already sitting in the working tree and the previously committed public package drift that has not been published yet. Republish the NCP agent runtime export surface so NextClaw can resolve `LocalAttachmentStore` after update, and add a release guard that blocks shipping public workspace dependents when a package has drifted past its published tag without a pending changeset.

## 0.2.4

### Patch Changes

- ee69ef6: Keep pasted and uploaded NCP images in composer order end to end: preserve caret placement, retain image visibility across follow-up turns without hidden model switching, and serialize mixed text/image message parts in the same order users authored them.

## 0.2.3

### Patch Changes

- Add NCP image attachment support across the shared chat composer, NCP runtime, React bindings, and bundled NextClaw UI so pasted or uploaded images are sent as NCP file parts and rendered inline. Also keep the required CLI/server/mcp release group in sync for the bundled NextClaw distribution.

## 0.2.2

### Patch Changes

- Republish all public workspace packages with pnpm publish guards so released manifests no longer retain workspace:\* dependencies and future npm publish misuse is blocked before release.

## 0.2.1

### Patch Changes

- Release the tokenized chat composer, IME fixes, and inline skill chip UI improvements.

## 0.2.0

### Minor Changes

- Unify the latest NCP native chat chain, runtime capability assembly, chat UI alignment, stream/reasoning/tool fixes, and marketplace metadata publishing into a single minor release.

## 0.1.1

### Patch Changes

- cfcd97f: Split the reusable chat presentation layer into a standalone `@nextclaw/agent-chat-ui` package and wire `@nextclaw/ui` to consume it.
