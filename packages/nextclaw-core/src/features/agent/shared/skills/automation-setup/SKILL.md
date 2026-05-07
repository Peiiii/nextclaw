---
name: automation-setup
description: Turn a user request into a scheduled automation by configuring cron jobs, including session-bound follow-ups and periodic checks.
---

# Automation Setup

Use this skill when the user wants the assistant to:

- remind them later
- check something periodically
- continue an existing investigation on a schedule
- create a recurring follow-up tied to an existing session
- turn a repeated manual workflow into an automation

This skill is a thin planner on top of the `cron` tool. Do not implement a second scheduler. Do not refer to Heartbeat or `HEARTBEAT.md`.

## Decision Rules

1. If the task should continue an existing conversation or investigation, pass the target `sessionId`.
2. If the task should use a dedicated background thread, omit `sessionId` and let cron use its own `cron:<jobId>` session.
3. If the schedule is one-time, use `at`.
4. If the schedule is a true fixed interval, use `every`.
5. If the schedule is a calendar pattern, use `cron`.

## Message Rules

Write the `message` as an executable instruction for the agent at run time.

- Good: `Check the release board, summarize blockers, and report only changes since the previous run.`
- Good: `Continue the existing debugging session, inspect the latest logs, and append the next concrete step.`
- Bad: `debug logs`

If the user wants a periodic check of a file, include that file path directly in the message.

- Example: `Read docs/TODO.md, identify items due this week, and summarize anything blocked.`

## Session-Bound Follow-Up

When the user wants “continue this later” or “keep following up on this thread”, prefer:

```text
cron(action="add", name="<short-name>", message="<runtime instruction>", every=<seconds>, sessionId="<existing-session-id>")
```

## Examples

Recurring follow-up on the current investigation:

```text
cron(action="add", name="investigation-follow-up", message="Continue the existing investigation, check for new evidence, and report only meaningful changes.", every=1800, sessionId="<session-id>")
```

Periodic file-based review without a special session:

```text
cron(action="add", name="todo-review", message="Read docs/TODO.md, identify items that need attention, and summarize the highest-priority updates.", cron="0 9 * * *")
```

One-time reminder:

```text
cron(action="add", name="meeting-reminder", message="At the scheduled time, send a message to the current conversation saying: \"Meeting starts in 10 minutes.\"", at="<absolute-iso-time>")
```
