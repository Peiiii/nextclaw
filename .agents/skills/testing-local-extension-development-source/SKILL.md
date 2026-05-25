---
name: testing-local-extension-development-source
description: Use when a local NextClaw extension in this repo needs to be loaded from source for frontend or backend verification without publishing a new package version
---

# Testing Local Extension Development Source

## Overview

Use the extension development source as the unified base path for unpublished extension testing.

The extension runtime discovers local development manifests through the standard extension directories:

- isolated `NEXTCLAW_HOME`
- local extension manifest/source directory
- local source-mode service startup
- optional frontend dev server proxy

## When to Use

- The user changed an extension package.
- The user wants to test local source code before publishing.
- A frontend session should point at a backend that loads the local extension.

## Command

```bash
pnpm dev
```

## Quick Reference

```bash
mkdir -p "$NEXTCLAW_HOME/extensions"
pnpm dev
```

## Notes

- This skill is only for local NextClaw extension development source. Agent runtime entries are configured through `agents.runtimes.entries`.
