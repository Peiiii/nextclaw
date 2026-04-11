---
name: testing-local-plugin-development-source
description: Use when a local NextClaw plugin in this repo needs to be loaded from source for frontend or backend verification without publishing a new package version
---

# Testing Local Plugin Development Source

## Overview

Use the generic local plugin dev command as the unified base path for unpublished plugin testing.

This command handles the shared bootstrapping work:

- isolated `NEXTCLAW_HOME`
- local linked plugin install
- `plugins.entries.<id>.source` selection
- local source-mode service startup
- optional frontend dev server proxy

## When to Use

- The user changed a plugin under `packages/extensions/`.
- The user wants to test local source code before publishing.
- A frontend session should point at a backend that loads the local plugin.
- The plugin type is not always the same, so a Codex-only command is too narrow.

## Command

```bash
pnpm dev:plugin:local -- --plugin-path ./packages/extensions/<plugin-dir> --frontend
```

## Quick Reference

```bash
pnpm dev:plugin:local -- --plugin-path ./packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk --session-type codex --frontend
pnpm dev:plugin:local -- --plugin-path ./packages/extensions/nextclaw-channel-plugin-discord --frontend
pnpm dev:plugin:local -- --plugin-path ./packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk --session-type claude
```

## Notes

- If the plugin declares `openclaw.development.extensions`, the command switches it to `source=development`.
- If it does not, the command still links the local plugin path, but keeps `source=production`.
- For agent-runtime plugins, add `--session-type <type>` so readiness waits for that runtime to appear.
- Use the dedicated wrapper `pnpm smoke:codex-plugin:local` when a real Codex chat reply smoke is needed immediately.
