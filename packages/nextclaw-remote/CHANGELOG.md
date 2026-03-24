# @nextclaw/remote

## 0.1.33

### Patch Changes

- Updated dependencies
  - @nextclaw/server@0.10.39

## 0.1.32

### Patch Changes

- Updated dependencies
  - @nextclaw/server@0.10.38

## 0.1.31

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.10.0
  - @nextclaw/server@0.10.37

## 0.1.30

### Patch Changes

- Raise remote connector exponential backoff to a 30 minute cap for non-terminal websocket failures so long outages generate fewer reconnect requests while terminal auth and configuration errors still stop immediately.
- Updated dependencies
  - @nextclaw/server@0.10.36

## 0.1.29

### Patch Changes

- Republish all public workspace packages with pnpm publish guards so released manifests no longer retain workspace:\* dependencies and future npm publish misuse is blocked before release.
- Updated dependencies
  - @nextclaw/core@0.9.12
  - @nextclaw/server@0.10.35

## 0.1.28

### Patch Changes

- @nextclaw/server@0.10.34

## 0.1.27

### Patch Changes

- Stop unbounded remote websocket reconnect loops by classifying terminal handshake failures,
  backing off retry timing, halting after repeated failures, and preserving the registered
  device across reconnect attempts. Keep the CLI release group aligned with version-only
  companion releases for `@nextclaw/mcp` and `@nextclaw/server`.
- Updated dependencies
  - @nextclaw/server@0.10.33

## 0.1.26

### Patch Changes

- Updated dependencies
  - @nextclaw/server@0.10.32

## 0.1.25

### Patch Changes

- Publish the transparent app transport boundary fix so local and remote streaming remain a true transport-only replacement.
  - keep SSE and multiplex adapters transport-only instead of interpreting upper-layer terminal events
  - preserve `final` as a normal streamed event while keeping `openStream().finished` stable
  - ship the repaired local chat UX and remote request-multiplex behavior in the released CLI/UI/runtime chain

- Updated dependencies
  - @nextclaw/server@0.10.31

## 0.1.21

### Patch Changes

- Updated dependencies
  - @nextclaw/server@0.10.25

## 0.1.20

### Patch Changes

- Republish the finalized remote app transport multiplex implementation after maintainability refactors so the published packages match the verified runtime code.
- Updated dependencies
  - @nextclaw/server@0.10.24

## 0.1.19

### Patch Changes

- Add remote app transport multiplexing so the UI can switch from direct local transport to remote runtime transport, including browser-side remote requests, realtime event bridging, and streamed chat turns over the remote relay.
- Updated dependencies
  - @nextclaw/server@0.10.23

## 0.1.18

### Patch Changes

- Publish the remote instance registration compatibility fix so released CLI builds understand the new platform `instance` payload and registration route.
- Updated dependencies
  - @nextclaw/server@0.10.22

## 0.1.17

### Patch Changes

- Updated dependencies [7795d61]
  - @nextclaw/server@0.10.21

## 0.1.16

### Patch Changes

- Fix remote access token-expiry handling so expired platform sessions are no longer treated as logged in.

  The local remote runtime now fails fast on expired or malformed platform tokens, and remote doctor/status surfaces the real token state instead of only checking the `nca.` prefix.
  Republish the CLI release group packages for version alignment.

- Updated dependencies
  - @nextclaw/server@0.10.20

## 0.1.15

### Patch Changes

- Align the default NextClaw UI port to 55667 across core config, remote access, CLI runtime, UI fallbacks, Docker defaults, smoke scripts, and user-facing docs.
- Updated dependencies
  - @nextclaw/core@0.9.8
  - @nextclaw/server@0.10.19

## 0.1.14

### Patch Changes

- Updated dependencies
  - @nextclaw/server@0.10.18

## 0.1.13

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.7
  - @nextclaw/server@0.10.17

## 0.1.12

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.9.6
  - @nextclaw/server@0.10.16

## 0.1.11

### Patch Changes

- Fix remote access to bind status and repair actions to the current UI process runtime instead of a stale managed service snapshot.

  Ensure `serve` and dev UI sessions start the remote runtime whenever the current process actually has UI enabled, even if `config.ui.enabled` is false.

- Updated dependencies
  - @nextclaw/server@0.10.15

## 0.1.10

### Patch Changes

- Updated dependencies
  - @nextclaw/server@0.10.14

## 0.1.9

### Patch Changes

- Updated dependencies
  - @nextclaw/server@0.10.13

## 0.1.8

### Patch Changes

- Optimize remote relay cost behavior by removing connector heartbeat traffic and aligning the platform relay flow with hibernation-friendly online/session state semantics.
- Updated dependencies
  - @nextclaw/server@0.10.12

## 0.1.7

### Patch Changes

- Updated dependencies
  - @nextclaw/server@0.10.11

## 0.1.6

### Patch Changes

- Updated dependencies
  - @nextclaw/server@0.10.10

## 0.1.5

### Patch Changes

- Updated dependencies
  - @nextclaw/server@0.10.9

## 0.1.4

### Patch Changes

- Updated dependencies
  - @nextclaw/server@0.10.8

## 0.1.3

### Patch Changes

- Updated dependencies
  - @nextclaw/server@0.10.7

## 0.1.2

### Patch Changes

- Updated dependencies
  - @nextclaw/server@0.10.6

## 0.1.1

### Patch Changes

- Updated dependencies
  - @nextclaw/server@0.10.5
