---
title: "NextClaw: pick up where you left off after a restart"
description: Controlled restarts now resume eligible conversations automatically, removing a manual handoff from updates and maintenance.
---

# NextClaw: pick up where you left off after a restart

Published: 2026-09-11

Tags: `self-management` `session recovery` `reliability`

“Update yourself, then come back and continue.”

For a long-term AI companion, that should be a complete request: check the version, apply the update, restart when necessary, and return to unfinished work. NextClaw v0.53.0 adds multi-session recovery to controlled restarts.

## Current results

| Scenario | Behavior in v0.53.0 |
| --- | --- |
| Update and restart through the ordinary commands | Resume every eligible active conversation |
| Several conversations are running | Let the new process claim each one, not only the conversation that requested the restart |
| The old tool process is interrupted | Do not restore or replay it; first verify the update, version, and service state |
| A conversation already completed or failed normally | Do not mistake it for a restart interruption and run it again |
| The same restart handoff is observed twice | Claim it once to prevent duplicate recovery |

## Maintenance should remember the work in progress

Imagine that one conversation is editing a report while another is organizing source material, and the runtime needs an update. Restarting the service is only the first step. What matters is that NextClaw returns knowing which work remains and continues from saved progress without asking you to wake every task manually.

Before a controlled restart, NextClaw records active conversations. Once the new process is ready, it checks and resumes eligible runs. Completed tasks do not run again, and ordinary failures are not reclassified as restart interruptions.

This removes a manual handoff from maintenance and keeps ongoing work from ending at a process boundary.

## A missing result is not permission to repeat an action

When an AI restarts its own runtime, the old process may exit before it receives the complete tool result. If it sees only an interruption, it could treat a successful restart as a failure.

The new handoff explicitly tells the resumed run that the planned restart completed and that the old tool process was not restored. It should verify the version, service health, and actual outcome before deciding what to do next—not repeat the update or restart simply because the previous result was interrupted.

NextClaw does not replay tools automatically. Recovery does not move an old execution stack into a new process; it continues with saved conversation history and an explicit restart handoff.

## Self-management supports a long-term companion

NextClaw exists to be a long-term personal AI companion. To participate reliably over time, it needs to understand whether it is available and maintain its runtime within the user's authorization—not only respond to individual tasks.

Checking state, updating the runtime, and continuing after a restart are concrete parts of that responsibility. The boundary remains explicit: serve the user's goal, respect authorization, do not present a software update as a smarter model, and do not expand permissions.

## Boundaries

- Recovery currently covers background services and foreground hosts that support the local runtime API, using `nextclaw restart` without configuration overrides.
- Desktop and system-supervisor exits, crash recovery, first upgrades from older releases, and durable scheduling for arbitrary queued work are outside this release.
- A resumed conversation decides its next step with the saved history, but NextClaw does not restore or automatically replay the previous tool process.

Local acceptance used a signed test update source across one update, two consecutive real restarts, and three distinct runtime processes. Two conversations resumed after each restart and still accepted ordinary new messages. Model output came from a deterministic simulator, so this evidence verifies the process and conversation recovery path; it does not prove that every model will always choose the correct next action.

See [Self-management: update, restart, and continue working](/en/guide/self-management) for usage and complete limitations.
