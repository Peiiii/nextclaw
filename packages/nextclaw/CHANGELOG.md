# nextclaw

## 0.4.9

### Patch Changes

- Show MiniMax API base hints in UI and extend config schema hints/help.
- Updated dependencies
  - nextclaw-core@0.4.7

## 0.4.8

### Patch Changes

- Align provider/channel list descriptions with config UI hints and extend schema help entries.
- Updated dependencies
  - nextclaw-core@0.4.6

## 0.4.7

### Patch Changes

- Align config schema + uiHints pipeline with OpenClaw-style mechanism, add schema API, and unify config redaction.
- Updated dependencies
  - nextclaw-core@0.4.5
  - nextclaw-server@0.3.3

## 0.4.6

### Patch Changes

- Remove source-install docs and simplify self-update to npm-only.

## 0.4.5

### Patch Changes

- Add built-in ClawHub CLI install command for skills.

## 0.4.4

### Patch Changes

- fix: avoid exec guard blocking curl format query
- Updated dependencies
  - nextclaw-core@0.4.4

## 0.4.3

### Patch Changes

- fix: persist tool call history in sessions
- Updated dependencies
  - nextclaw-core@0.4.3

## 0.4.2

### Patch Changes

- chore: seed built-in skills during init
- Updated dependencies
  - nextclaw-core@0.4.2

## 0.4.1

### Patch Changes

- chore: tighten eslint line limits
- Updated dependencies
  - nextclaw-core@0.4.1
  - nextclaw-server@0.3.2

## 0.4.0

### Minor Changes

- Align core tools (gateway/sessions/subagents/memory) with openclaw semantics and add gateway update flow.

### Patch Changes

- Updated dependencies
  - nextclaw-core@0.4.0
  - nextclaw-server@0.3.1

## 0.3.3

### Patch Changes

- Add `nextclaw init` and run init automatically on start to prepare workspace templates.

## 0.3.2

### Patch Changes

- Fix dev UI API base/WS derivation and correct port availability checks to avoid conflicts.

## 0.3.1

### Patch Changes

- Refactor CLI runtime into dedicated runtime and utils modules.

## 0.3.0

### Minor Changes

- Add provider hot-reload support and wire_api configuration updates.

### Patch Changes

- Updated dependencies
  - nextclaw-core@0.3.0
  - nextclaw-server@0.3.0

## 0.2.9

### Patch Changes

- Update provider/channel logos and UI assets.

## 0.2.6

### Patch Changes

- Add Feishu verify/connect flow, probe API, and channel reload handling.

## 0.2.5

### Patch Changes

- Improve dev start port handling and remove guide links

## 0.2.4

### Patch Changes

- Republish UI updates and refresh bundled UI assets.

## 0.2.3

### Patch Changes

- Add background service management with `nextclaw start` and `nextclaw stop`.

## 0.2.2

### Patch Changes

- Make `nextclaw start` avoid auto-starting the frontend dev server by default.

## 0.2.1

### Patch Changes

- Add `start` command and serve bundled UI assets from the UI backend.

## 0.2.0

### Minor Changes

- Remove legacy nextbot compatibility and centralize brand configuration.

## 0.1.0

### Minor Changes

- Rename the project to nextclaw, update CLI/config defaults, and refresh docs.
