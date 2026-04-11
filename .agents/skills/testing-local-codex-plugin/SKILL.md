---
name: testing-local-codex-plugin
description: Use when the current NextClaw repo has local changes in the first-party Codex runtime plugin and a real local smoke is needed without publishing a new plugin release
---

# Testing Local Codex Plugin

## Overview

Use the repo-level local smoke command instead of manually creating temp homes, linking the plugin, switching `source=development`, and starting the service by hand.

This path is specifically for the first-party Codex runtime plugin in this repo.

## When to Use

- The user changed `packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk`.
- The user wants to verify local source code, not a published npm version.
- A real reply check is needed right now from local development.
- The user does not want to manually perform plugin install, config, and service startup steps.

## Command

```bash
pnpm smoke:codex-plugin:local
```

## Quick Reference

```bash
pnpm smoke:codex-plugin:local
pnpm smoke:codex-plugin:local -- --model openai/gpt-5.4
pnpm smoke:codex-plugin:local -- --prompt "Reply exactly OK"
pnpm smoke:codex-plugin:local -- --no-keep-running
pnpm smoke:codex-plugin:local -- --json
```

## What It Does

- Creates an isolated `NEXTCLAW_HOME` under `/tmp`
- Copies the current usable config from `~/.nextclaw/config.json`
- Links the local Codex plugin from this repo
- Forces `plugins.entries.nextclaw-ncp-runtime-plugin-codex-sdk.source=development`
- Starts a local source-mode NextClaw service
- Runs the existing `smoke:ncp-chat` check through `session-type=codex`
- Leaves the service running by default so UI follow-up checks can continue immediately

## Common Mistakes

- Using `nextclaw start` or a globally installed package: that tests published artifacts, not the repo source.
- Forgetting that this command leaves the service running by default: stop it with the printed `kill <pid>` command when finished.
- Overriding `--model` with a route that your copied config cannot actually access.
