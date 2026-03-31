# @nextclaw/channel-plugin-mochat

## 0.2.26

### Patch Changes

- 9a336f2: Publish the remaining public-package drift from today's commits as one unified patch batch, including the channel enable/disable fixes, declarative channel form layout, subagent follow-up/runtime fixes, and the landing asset updates that landed after the last tagged release.
- Updated dependencies [9a336f2]
  - @nextclaw/channel-runtime@0.4.12

## 0.2.25

### Patch Changes

- @nextclaw/channel-runtime@0.4.11

## 0.2.24

### Patch Changes

- @nextclaw/channel-runtime@0.4.10

## 0.2.23

### Patch Changes

- @nextclaw/channel-runtime@0.4.9

## 0.2.22

### Patch Changes

- @nextclaw/channel-runtime@0.4.8

## 0.2.21

### Patch Changes

- @nextclaw/channel-runtime@0.4.7

## 0.2.20

### Patch Changes

- Updated dependencies
  - @nextclaw/channel-runtime@0.4.6

## 0.2.19

### Patch Changes

- f15df6a: Publish the pending NCP realtime sync batch together with the new built-in cross-channel messaging skill and Weixin self-notify route hints.

  This release keeps the product lightweight: the AI reuses the existing reply, `sessions_send`, and `message` primitives, and a fresh UI or NCP session can proactively notify the saved Weixin route without adding a separate notification abstraction.

- Updated dependencies [f15df6a]
  - @nextclaw/channel-runtime@0.4.5

## 0.2.18

### Patch Changes

- @nextclaw/channel-runtime@0.4.4

## 0.2.17

### Patch Changes

- Ship the full set of current unreleased workspace package changes in one release batch, including the server/CLI updates already sitting in the working tree and the previously committed public package drift that has not been published yet. Republish the NCP agent runtime export surface so NextClaw can resolve `LocalAttachmentStore` after update, and add a release guard that blocks shipping public workspace dependents when a package has drifted past its published tag without a pending changeset.
- Updated dependencies
  - @nextclaw/channel-runtime@0.4.3

## 0.2.16

### Patch Changes

- Updated dependencies
  - @nextclaw/channel-runtime@0.4.2

## 0.2.15

### Patch Changes

- @nextclaw/channel-runtime@0.4.1

## 0.2.14

### Patch Changes

- bb891c2: Add the Phase 1 Feishu platform foundation for NextClaw, including shared Feishu core primitives, richer message conversion, multi-account routing, and the aligned config UI/runtime release chain.
- Updated dependencies [bb891c2]
  - @nextclaw/channel-runtime@0.4.0

## 0.2.13

### Patch Changes

- Add the Phase 1 Feishu platform foundation for NextClaw, including shared Feishu core primitives, richer message conversion, multi-account routing, and the aligned config UI/runtime release chain.
- Updated dependencies
  - @nextclaw/channel-runtime@0.3.0

## 0.2.12

### Patch Changes

- Republish all public workspace packages with pnpm publish guards so released manifests no longer retain workspace:\* dependencies and future npm publish misuse is blocked before release.
- Updated dependencies
  - @nextclaw/channel-runtime@0.2.12

## 0.2.11

### Patch Changes

- @nextclaw/channel-runtime@0.2.11

## 0.2.10

### Patch Changes

- @nextclaw/channel-runtime@0.2.10

## 0.2.9

### Patch Changes

- @nextclaw/channel-runtime@0.2.9

## 0.2.8

### Patch Changes

- @nextclaw/channel-runtime@0.2.8

## 0.2.7

### Patch Changes

- @nextclaw/channel-runtime@0.2.7

## 0.2.6

### Patch Changes

- @nextclaw/channel-runtime@0.2.6

## 0.2.5

### Patch Changes

- @nextclaw/channel-runtime@0.2.5

## 0.2.4

### Patch Changes

- Updated dependencies
  - @nextclaw/channel-runtime@0.2.4

## 0.2.3

### Patch Changes

- @nextclaw/channel-runtime@0.2.3

## 0.2.2

### Patch Changes

- @nextclaw/channel-runtime@0.2.2

## 0.2.1

### Patch Changes

- Updated dependencies
  - @nextclaw/channel-runtime@0.2.1

## 0.2.0

### Minor Changes

- Unify the latest NCP native chat chain, runtime capability assembly, chat UI alignment, stream/reasoning/tool fixes, and marketplace metadata publishing into a single minor release.

### Patch Changes

- Updated dependencies
  - @nextclaw/channel-runtime@0.2.0

## 0.1.12

### Patch Changes

- @nextclaw/channel-runtime@0.1.36

## 0.1.11

### Patch Changes

- Updated dependencies
  - @nextclaw/channel-runtime@0.1.35

## 0.1.10

### Patch Changes

- @nextclaw/channel-runtime@0.1.34

## 0.1.9

### Patch Changes

- Publish merged PR changes and synchronize the runtime dependency chain for npm consumption.
  This release includes configurable search provider support and workspace development export alignment.
- Updated dependencies
  - @nextclaw/channel-runtime@0.1.33

## 0.1.8

### Patch Changes

- Unified ecosystem release for accumulated chat runtime alignment, stop behavior hardening,
  frontend sticky autoscroll fixes, and package dependency consistency.
- Updated dependencies
  - @nextclaw/channel-runtime@0.1.32

## 0.1.7

### Patch Changes

- Updated dependencies
  - @nextclaw/channel-runtime@0.1.31

## 0.1.6

### Patch Changes

- Release runtime/session fixes and frontend configuration improvements together.
  - fix session persistence across non-streaming/runtime paths
  - stabilize Feishu conversation routing
  - include frontend max-token optimization and related config UX updates
  - republish dependent channel/plugin packages for version consistency

- Updated dependencies
  - @nextclaw/channel-runtime@0.1.28

## 0.1.5

### Patch Changes

- Add Discord preview streaming config and runtime support while keeping channel plugin compatibility.
- Updated dependencies
  - @nextclaw/channel-runtime@0.1.16

## 0.1.4

### Patch Changes

- Add Discord preview streaming config and runtime support while keeping channel plugin compatibility.
- Updated dependencies
  - @nextclaw/channel-runtime@0.1.15

## 0.1.3

### Patch Changes

- Fix agent tool-loop stalls by emitting a fallback reply after the max tool-iteration limit.
- Updated dependencies
  - @nextclaw/channel-runtime@0.1.14

## 0.1.2

### Patch Changes

- release: add WeCom channel support and harden dev runner port fallback.
  - add built-in WeCom channel runtime, plugin package, schema, UI fields and docs
  - add robust dev-runner port fallback to avoid API misrouting under port conflicts
  - publish linked package updates for runtime/plugin compatibility alignment

- Updated dependencies
  - @nextclaw/channel-runtime@0.1.7

## 0.1.1

### Patch Changes

- Complete final OpenClaw alignment by fully externalizing builtin channel runtime from core, moving extension packages into a dedicated extensions workspace path, and wiring channel plugins directly to runtime package.
- Updated dependencies
  - @nextclaw/channel-runtime@0.1.1
