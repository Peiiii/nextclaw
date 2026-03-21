# @nextclaw/remote

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
