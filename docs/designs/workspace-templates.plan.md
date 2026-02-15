# Workspace Templates Plan (NextClaw)

## Goal

Match OpenClaw-level completeness for workspace guidance while keeping NextClaw defaults safe and non-destructive.

## Scope

- Provide a full template set at workspace root.
- Preserve existing user files (create-only, no overwrite).
- Allow future extension without changing CLI behavior.

## Template Set (Workspace Root)

- `AGENTS.md` (primary guide)
- `SOUL.md`
- `USER.md`
- `IDENTITY.md`
- `TOOLS.md`
- `BOOT.md`
- `BOOTSTRAP.md`
- `HEARTBEAT.md`
- `MEMORY.md`
- `memory/` directory for daily notes
- `skills/` directory for skills

## Behavior

- `nextclaw init` creates missing files only.
- `nextclaw start` auto-runs init and informs the user.
- `onboard` remains as a deprecated alias to init.

## Acceptance

- Fresh init creates the full template set.
- Re-running init does not overwrite existing content.
- Template content provides identity, behavior, memory, safety, and group-chat guidance comparable to OpenClaw.
