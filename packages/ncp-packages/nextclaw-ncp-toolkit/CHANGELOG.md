# @nextclaw/ncp-toolkit

## 0.4.8

### Patch Changes

- Fix NCP subagent completion so results persist back into the originating session, become visible in chat after realtime refresh, and no longer depend on the legacy system-message relay.

## 0.4.7

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.4.1

## 0.4.6

### Patch Changes

- f15df6a: Publish the pending NCP realtime sync batch together with the new built-in cross-channel messaging skill and Weixin self-notify route hints.

  This release keeps the product lightweight: the AI reuses the existing reply, `sessions_send`, and `message` primitives, and a fresh UI or NCP session can proactively notify the saved Weixin route without adding a separate notification abstraction.

## 0.4.5

### Patch Changes

- 1ce3d58: Improve chat stream rendering performance by preserving stable message identities for unchanged messages and batching sticky autoscroll work with requestAnimationFrame.

## 0.4.4

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.4.0

## 0.4.3

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.3.3

## 0.4.2

### Patch Changes

- Republish all public workspace packages with pnpm publish guards so released manifests no longer retain workspace:\* dependencies and future npm publish misuse is blocked before release.
- Updated dependencies
  - @nextclaw/ncp@0.3.2

## 0.4.1

### Patch Changes

- Republish the NCP-linked package set so published consumers resolve the
  latest NCP protocol/runtime exports used by the current NextClaw CLI build.
- Updated dependencies
  - @nextclaw/ncp@0.3.1

## 0.4.0

### Minor Changes

- Unify the latest NCP native chat chain improvements into a single release batch:
  - fix NCP streaming/state-manager promotion so tool-first assistant streams do not lose parts
  - align session type handling to stay generic outside the built-in native type
  - remove runtime-specific default-model branching and use a generic session-scoped fallback strategy
  - ship the latest NextClaw UI, server, and CLI cutover fixes together
  - republish direct dependents of `@nextclaw/ncp-toolkit` for version alignment

## 0.3.0

### Minor Changes

- Unify the latest NCP native chat chain, runtime capability assembly, chat UI alignment, stream/reasoning/tool fixes, and marketplace metadata publishing into a single minor release.

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.3.0

## 0.2.0

### Minor Changes

- Refactor the NCP agent backend stack from run-centric semantics to session-centric live execution.
  - Replace run-based stream and abort payloads with `sessionId`-based live session APIs.
  - Rename the manifest capability from `supportsRunStream` to `supportsLiveSessionStream`.
  - Remove run-store/controller abstractions from `@nextclaw/ncp-toolkit` and move active execution ownership into the live session registry.
  - Align the HTTP client/server transports and React hooks with live session streaming.
  - Update `ncp-demo` to use the session-centric backend, add a `sleep` tool, and remove mock LLM mode.

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.2.0

## 0.1.1

### Patch Changes

- Expose the new NCP agent runtime/backend type exports and session delete API, and add the docs entry under Settings in the main chat sidebar.
- Updated dependencies
  - @nextclaw/ncp@0.1.1

## 0.1.0

- Initial package.
- Add default agent conversation state manager implementation.
