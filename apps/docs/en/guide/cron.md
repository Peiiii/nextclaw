# Cron & Heartbeat

This page explains how to make your assistant run tasks automatically.

## Cron: Trigger Tasks on Schedule

You can create:

- one-time tasks (run once at a specific time)
- recurring tasks (daily/weekly pattern)

Typical uses:

- daily summary draft
- scheduled reminders
- periodic checks and reports

Restart behavior for recurring interval jobs:

- On restart or hot reload, existing interval jobs do not replay missed runs from downtime.
- After service recovery, the next trigger stays aligned with the existing interval cadence instead of restarting the timer from the recovery moment.
- If the service is already running, including foreground `nextclaw serve` or `pnpm -C packages/nextclaw dev serve`, `nextclaw cron add / enable / disable / remove / run` now applies through the live service API immediately instead of waiting for local file watcher reloads.

## Recommended Order (UI First)

1. Create one one-time task and verify the full path.
2. Add one recurring task (for example once per day).
3. Add advanced rules only after baseline is stable.

## Heartbeat: Periodic Workspace Task Check

When the gateway is running, NextClaw checks `HEARTBEAT.md` in workspace periodically.
If actionable tasks are found, the agent processes them.

If you do not need Heartbeat for now, keep the file empty.

## Advanced Entry (Optional)

For script-based task management, use `nextclaw cron` subcommands.
See details in [Commands](/en/guide/commands).
