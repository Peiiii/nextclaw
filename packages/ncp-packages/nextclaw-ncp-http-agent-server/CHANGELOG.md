# @nextclaw/ncp-http-agent-server

## 0.3.7

### Patch Changes

- 9a336f2: Publish the remaining public-package drift from today's commits as one unified patch batch, including the channel enable/disable fixes, declarative channel form layout, subagent follow-up/runtime fixes, and the landing asset updates that landed after the last tagged release.
- Updated dependencies [9a336f2]
  - @nextclaw/ncp@0.4.3

## 0.3.6

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.4.2

## 0.3.5

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.4.1

## 0.3.4

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.4.0

## 0.3.3

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.3.3

## 0.3.2

### Patch Changes

- Republish all public workspace packages with pnpm publish guards so released manifests no longer retain workspace:\* dependencies and future npm publish misuse is blocked before release.
- Updated dependencies
  - @nextclaw/ncp@0.3.2

## 0.3.1

### Patch Changes

- Republish the NCP-linked package set so published consumers resolve the
  latest NCP protocol/runtime exports used by the current NextClaw CLI build.
- Updated dependencies
  - @nextclaw/ncp@0.3.1

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
- Add HTTP/SSE route mount helpers for NCP agent events.
