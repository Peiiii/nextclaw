---
title: "Long sessions no longer get stuck on truncated compaction summaries"
description: Verified prefixes, bounded shrinking retries, and recent-source recovery keep a failed compaction from becoming the end of a session.
---

# Long sessions no longer get stuck on truncated compaction summaries

Published: 2026-08-24

Tags: `sessions` `context compaction` `reliability`

NextClaw v0.42.3 fixes a failure path that could trap a long session in a loop. When a compaction summary reached the provider output limit, older versions discarded the result and kept the previous checkpoint. The next message then triggered the same failure again.

A truncated summary no longer means that the session must fail. NextClaw first verifies whether the information required to continue is complete, then chooses whether to install it, retry, or use a bounded recovery path.

## Current results

| Scenario | Behavior in v0.42.3 |
| --- | --- |
| Summary completes normally | Install the complete checkpoint |
| Truncation happens after essential content | Keep the closed essential prefix and discard the unfinished low-priority tail |
| Truncation happens before essential content | Make at most three total calls, with strictly smaller input each time |
| All three summaries are unusable | Stop calling the model and preserve recent source messages |
| Final authentication, configuration, or network error | Return the actual error instead of repeating it as a summary failure |

## A verifiable summary boundary

The compaction prompt asks the model to output the active request, work state, safety constraints, and continuation requirements first. A completion marker follows those essential sections.

The runtime installs only closed sections. Truncation before the essential marker means the required content is incomplete. Truncation in an optional section after that marker drops only the unfinished tail. This avoids guessing whether a partial summary merely looks complete.

## A retry must make measurable progress

Retrying the same history usually reaches the same output limit again. Recovery therefore limits both the number of calls and the input size: no more than three total calls, with each retry removing older unprotected history while retaining the recent task and constraints.

If the next request is not actually smaller, the runtime does not call the provider just to use the remaining retry count.

## The final path preserves recent source messages

If all three summaries are unusable, NextClaw does not make a fourth model call. It creates a deterministic checkpoint from protected system and service anchors plus recent messages.

This path deliberately drops older history, but the retained content comes from source messages rather than newly invented facts. The original journal also remains intact. The result is a recovery path with an explicit information boundary, not a degraded summary presented as complete.

## A budget tied to installable space

The summary output limit is now derived from the space available for the installed checkpoint. The target remains at most 4,000 tokens, but the provider no longer receives an unrelated fixed 8,000-token limit. It gets at most 10% controlled completion headroom, followed by another size check before installation.

For a 4,000-token target, the common provider limit is 4,400 rather than 8,000. The headroom helps close the current structure without doubling the intended summary size.

## Boundaries

- Final provider authentication, configuration, or network errors still fail. Compaction recovery cannot replace an available primary model.
- The deterministic recent-source path drops older history. It guarantees a way forward, not zero context loss.
- Token counts are runtime estimates; the final request remains constrained by the selected model's context limit.

NextClaw will continue tracking call counts, truncation reasons, installed size, and recovery frequency in real long sessions so this path remains predictable across models.
