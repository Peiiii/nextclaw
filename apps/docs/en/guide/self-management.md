---
title: Self-management — update, restart, and continue working
description: Let NextClaw inspect and maintain its runtime within your authorization, then continue unfinished sessions after a controlled restart.
---

# Self-management: update, restart, and continue working

You can ask NextClaw to help maintain NextClaw itself: inspect its version, check service health, diagnose problems, and update or restart with explicit authorization. Maintaining a long-term partner should support the work it is doing for you.

::: info Controlled-restart recovery is coming
Automatic session continuation described here has been implemented and locally tested, but has not shipped in a stable release. An older installation cannot gain this guarantee simply by running these commands; it must first install a version containing this capability. Version checks, diagnostics, and updates continue to use the existing CLI.
:::

## More than bringing the service back

Suppose one session is revising a report while another is organizing files. A runtime update becomes necessary. You want NextClaw to maintain itself, then return to both jobs without making you find each task and explain where it stopped.

A controlled restart records the sessions that are running. The old process exits. Once the replacement process is ready, it continues only runs interrupted by that restart that still qualify for recovery. This includes the initiating session and concurrent sessions; completed tasks are not repeated.

This preserves continuity of collaboration, not uninterrupted process uptime. Your connection may briefly disconnect.

## Ask NextClaw to handle it

For an authorized update:

> Check your version and service health. If an update is available, install it through the CLI and restart if needed. Once back, verify your version and health, then continue this task.

For a restart without an update:

> Restart NextClaw and continue this task afterward. Check the results of earlier actions before repeating anything.

The agent uses the same ordinary CLI as a human, without a dedicated update tool:

```sh
nextclaw --version
nextclaw status --json
nextclaw update
```

Only when the result requires a restart, run:

```sh
nextclaw restart
```

Afterward, verify with `nextclaw --version` and `nextclaw status --json`. Use `nextclaw doctor --json` if diagnosis is needed. Do not chain update and restart unconditionally: no available update, a failed update, and an applied update awaiting restart need different handling.

## How the agent knows what happened

The resumed run receives explicit context: the planned restart completed; the previous tool process and execution stack were not restored; an interrupted tool result is not a reason to repeat the update or restart; first inspect the version, service health, and effects of earlier actions.

History and persisted progress remain available, but unfinished tools are not automatically replayed. If a file write or external request was started before the restart, inspect the file or remote state before assuming that a missing result means nothing happened.

Each handoff is claimed once. A failed session recovery does not repeatedly restart the whole batch; you can inspect the failure and decide how to continue. These safeguards reduce accidental retries, but do not guarantee that every model will always make the correct decision.

## Supported scope

| Situation | Automatic continuation |
| --- | --- |
| Managed service or foreground host with the local runtime API, using plain `nextclaw restart` | Continues matching runs interrupted by this restart |
| Other concurrent sessions on the same host | Included, not just the initiating session |
| Completed tasks or ordinary execution failures | Not automatically rerun because of a restart |
| A session has already started a new run | The old continuation does not replace or queue behind it |
| Crash, power loss, OS restart, or direct process termination | Outside planned-restart recovery |
| Desktop hosts or exits owned by a system supervisor | Not covered yet |
| Legacy stop/start or the first upgrade from a version without recovery support | Cannot reconstruct a handoff the old process never recorded |
| Explicit port, browser-opening, or startup-timeout overrides on `restart` | Uses the compatibility path, without a recovery guarantee |

Recovery records currently expire after five minutes. Invalid, expired, or mismatched records do not wake sessions automatically. This covers tasks running before the restart, not durable scheduling of arbitrary queued inputs.

If a restart command times out, check status first. The request may already have been accepted; a timeout does not prove the restart failed.

## Self-management and a long-term partnership

Version and health checks help NextClaw understand its runtime state. Authorized updates and restarts let it maintain that runtime. Continuing unfinished work keeps maintenance from becoming the end of a collaboration.

This is part of operational self-awareness and autonomy. It does not mean expanding its own permissions, rewriting its code, training a model, or pursuing unrestricted “self-evolution.” Its actions remain bounded by your goals and authorization.

## Related guides

- [Runtime and hosting](/en/guide/runtime-hosting)
- [Security and permissions](/en/guide/security-and-permissions)
- [CLI capability map](/en/guide/commands)
- [Troubleshooting](/en/guide/troubleshooting)
