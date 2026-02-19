# @nextclaw/openclaw-compat

## 0.1.9

### Patch Changes

- Complete final OpenClaw alignment by fully externalizing builtin channel runtime from core, moving extension packages into a dedicated extensions workspace path, and wiring channel plugins directly to runtime package.
- Updated dependencies
  - @nextclaw/core@0.6.17
  - @nextclaw/channel-runtime@0.1.1
  - @nextclaw/channel-plugin-telegram@0.1.1
  - @nextclaw/channel-plugin-whatsapp@0.1.1
  - @nextclaw/channel-plugin-discord@0.1.1
  - @nextclaw/channel-plugin-feishu@0.1.1
  - @nextclaw/channel-plugin-mochat@0.1.1
  - @nextclaw/channel-plugin-dingtalk@0.1.1
  - @nextclaw/channel-plugin-email@0.1.1
  - @nextclaw/channel-plugin-slack@0.1.1
  - @nextclaw/channel-plugin-qq@0.1.1

## 0.1.8

### Patch Changes

- Externalize bundled channel implementations into independent installable channel plugin packages and make compat loader resolve bundled channels from those package entries.

## 0.1.7

### Patch Changes

- Align plugin registration architecture with OpenClaw by introducing a dedicated registry module and routing bundled/external plugin registration through a unified API registration path.

## 0.1.6

### Patch Changes

- Align built-in channel loading with OpenClaw-style plugin registration by splitting bundled channel definitions, routing bundled channels through register(api), and keeping channel runtime purely plugin-registry driven.
- Updated dependencies
  - @nextclaw/core@0.6.16

## 0.1.5

### Patch Changes

- Restore OpenClaw-compatible plugin support in NextClaw with a NextClaw-only discovery policy.
  - Restore plugin CLI and runtime integration (`plugins *`, `channels add`, runtime loading bridge).
  - Restore `plugins.*` config schema and reload semantics.
  - Keep OpenClaw plugin compatibility while only scanning NextClaw plugin directories.
  - Do not scan legacy `.openclaw/extensions` directories by default.

- Updated dependencies
  - @nextclaw/core@0.6.2

## 0.1.4

### Patch Changes

- - Improve gateway self-restart behavior after in-process update flow.
  - Refine self-management prompts/docs for update and runtime guidance.
  - Disable OpenClaw plugin loading by default unless `NEXTCLAW_ENABLE_OPENCLAW_PLUGINS=1` is explicitly set.
- Updated dependencies
  - @nextclaw/core@0.5.3

## 0.1.3

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.5.0

## 0.1.2

### Patch Changes

- Align OpenClaw plugin compatibility for channel runtime behavior.
  - Add channel messageToolHints resolution and inject hints into agent system prompt messaging guidance.
  - Forward plugin AccountId context through runtime bridge so channel/account-specific hints can resolve.
  - Improve OpenClaw channel integration path for ClawBay-compatible plugins and update docs/logs.

- Updated dependencies
  - @nextclaw/core@0.4.9

## 0.1.1

### Patch Changes

- Unify internal package names under the `@nextclaw` scope while keeping the CLI package name as `nextclaw`.
  - Rename packages to `@nextclaw/core`, `@nextclaw/server`, and `@nextclaw/openclaw-compat`.
  - Update all workspace imports, dependency declarations, and TypeScript path aliases.
  - Keep plugin compatibility behavior and CLI user experience unchanged.

- Updated dependencies
  - @nextclaw/core@0.4.8
