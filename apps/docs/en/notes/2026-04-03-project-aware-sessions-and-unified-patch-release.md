---
title: 2026-04-03 · Sessions Now Actually Stay Project-Aware
description: New sessions can bind a project before the first message, project skills now load per session, the project badge is actionable, and this ships in one unified npm patch release.
---

# 2026-04-03 · Sessions Now Actually Stay Project-Aware

Published: April 3, 2026  
Tags: `release` `chat` `project context`

## What changed

- New sessions no longer need a “dummy first message” before a project can really stick. You can set the project directory first and start chatting after that.
- Skill loading now follows the session's real project context:
  - it reads `.agents/skills` from the selected project
  - it keeps workspace-installed `skills`
  - same-name skills no longer overwrite each other because they are distinguished by stable refs
- A project's own `AGENTS.md` and project-specific context now live in a separate `Project Context` block instead of being mixed into the host workspace context.
- The project badge in the chat header is now an action surface, not just a label:
  - click it to open a menu
  - change the project directory there
  - or remove the project directly there
- This release also includes follow-up polish such as immediate skill refresh after project changes, steadier path-picking behavior, and related UI cleanup.

## Why it matters

- NextClaw now behaves much more like a true project-aware session instead of a session that only changed `cwd` while the rest of the stack lagged behind.
- Project skills, project rules, and project context can now apply from the very first turn.
- When you switch between projects inside the same workspace, boundaries are clearer and it is much less likely that skills feel incomplete or that two sources get merged by accident.
- The project badge itself becomes a fast control point for everyday project changes.

## How to use

1. Start a new chat session.
2. Set the project directory first.
3. Open the skill picker and confirm that `.agents/skills` from the project is already available.
4. Send the first message and let the model work in that project context from turn one.
5. If you want to change or remove the project later, click the project badge in the header.

## Also in this release

- This is not a one-package hotfix. It ships as one unified npm patch release.
- The release batch covers the core public packages and direct dependents that needed synchronized publication, including:
  - `nextclaw`
  - `@nextclaw/core`
  - `@nextclaw/server`
  - `@nextclaw/ui`
  - `@nextclaw/openclaw-compat`
  - `@nextclaw/ncp-toolkit`
  - `@nextclaw/ncp-react`
  - `@nextclaw/ncp-mcp`
  - `@nextclaw/mcp`
  - `@nextclaw/remote`
  - `@nextclaw/runtime`
  - `@nextclaw/agent-chat-ui`
  - `@nextclaw/channel-runtime` plus related channel plugins
  - `@nextclaw/nextclaw-engine-*` and `@nextclaw/nextclaw-ncp-runtime-plugin-*` engine/runtime plugins

## Links

- [Chat Guide](/en/guide/chat)
- [Session Management](/en/guide/sessions)
- [Skills Tutorial](/en/guide/tutorials/skills)
