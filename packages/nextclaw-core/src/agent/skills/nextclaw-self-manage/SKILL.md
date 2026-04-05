---
name: nextclaw-self-manage
description: Self-manage NextClaw runtime via CLI guide. For install/start/status/doctor/service/plugins/channels/config/agents/cron/remote/update operations.
metadata: {"nextclaw":{"always":true,"emoji":"🛠️"}}
---

# NextClaw Self-Management

Use this skill whenever the user asks to manage NextClaw itself (version, service status, diagnostics, plugins, channels, config, agents, cron, remote, update).

## Source of Truth

Always use `USAGE.md` as the operation guide.

1. First try `${workspace}/USAGE.md`.
2. If missing, try repo docs path (for dev runs): `docs/USAGE.md`.
3. If both are missing, use `nextclaw --help` and `nextclaw <subcommand> --help` as fallback and tell the user that guide file is missing.

## Routing Rules

- Treat NextClaw self-management as a product-management intent, not a generic "create/install/publish" intent.
- Read `USAGE.md` before opening unrelated generic skills.
- Example: "create a new Agent" maps to NextClaw agent management, not `skill-creator`.

## Stable Execution Rules

- Map version lookup directly to `nextclaw --version`; do not substitute `status` for version queries.
- Prefer machine-readable output: use `--json` when available.
- Execute only commands documented in `USAGE.md` or CLI help; do not invent commands or config paths.
- After mutating operations, close the loop with:
  - `nextclaw status --json`
  - and `nextclaw doctor --json` when needed
- Be explicit about restart semantics after changes.
- For Agent creation/removal, follow the Agent management section in `USAGE.md` instead of inventing direct config edits.

## Minimal Self-Management Flow

1. Understand user intent and map to one concrete CLI action.
2. Read the relevant section in `USAGE.md`.
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
- Agents: `nextclaw agents list|new|remove`
- Automation: `nextclaw cron list|add|remove|enable|run`
