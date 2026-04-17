---
name: nextclaw-self-manage
description: Self-manage NextClaw runtime via CLI guide. For install/start/status/doctor/service/plugins/channels/config/agents/cron/remote/update operations.
metadata: {"nextclaw":{"always":true,"emoji":"🛠️"}}
---

# NextClaw Self-Management

Use this skill whenever the user asks to manage NextClaw itself (version, service status, diagnostics, plugins, channels, config, agents, cron, remote, update, installed skills, marketplace skills).

## Source of Truth

Always use the built-in NextClaw self-management guide as the operation guide.

1. Read the built-in guide path provided by the system prompt first.
2. If the packaged guide is unavailable in a repo source checkout, use repo docs path `docs/USAGE.md`.
3. Never treat workspace `USAGE.md` snapshots or copied artifacts as the source of truth.
4. If both guide paths are unavailable, use `nextclaw --help` and `nextclaw <subcommand> --help` as fallback and tell the user that guide file is missing.

## Routing Rules

- Treat NextClaw self-management as a product-management intent, not a generic "create/install/publish" intent.
- Read the built-in self-management guide before opening unrelated generic skills.
- Example: "create a new Agent" maps to NextClaw agent management, not `skill-creator`.

## Stable Execution Rules

- Map version lookup directly to `nextclaw --version`; do not substitute `status` for version queries.
- Prefer machine-readable output: use `--json` when available.
- Execute only commands documented in the self-management guide or CLI help; do not invent commands or config paths.
- Keep installed skills and marketplace catalog as two different domains:
  - local installed: `nextclaw skills installed|info`
  - marketplace catalog: `nextclaw marketplace skills search|info|recommend|install`
- After mutating operations, close the loop with:
  - `nextclaw status --json`
  - and `nextclaw doctor --json` when needed
- Be explicit about restart semantics after changes.
- For Agent creation/update/removal, treat `nextclaw agents list|new|update|remove --json` as the default path and follow the Agent management section in the self-management guide.
- Do not edit `config.json` or `agents.list` directly for normal Agent CRUD; only do that when the user explicitly wants a manual recovery path.
- When creating an Agent, prefer an explicit non-text avatar and avoid text-based styles such as DiceBear `initials`.

## Minimal Self-Management Flow

1. Understand user intent and map to one concrete CLI action.
2. Read the relevant section in the self-management guide.
3. Execute the documented command with safe parameters.
4. Verify with status/doctor.
5. Report outcome + next action (if any).

## Release Notes / Changelog Lookup

When user asks "what changed in version X", follow:

- `references/release-notes-changelog.md`
- Do not claim details without a traceable source path.

## High-frequency Intents

- Version lookup: `nextclaw --version`
- Service health: `nextclaw status --json` / `nextclaw doctor --json`
- Lifecycle: `nextclaw start|restart|stop`
- Channels: `nextclaw channels status|login`
- Config: `nextclaw config get|set|unset`
- Agents: `nextclaw agents list|new|update|remove`
- Automation: `nextclaw cron list|add|remove|enable|run`
- Installed skills: `nextclaw skills installed|info`
- Marketplace skills: `nextclaw marketplace skills search|info|recommend|install`
