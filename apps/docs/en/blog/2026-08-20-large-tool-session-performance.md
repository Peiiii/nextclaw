---
title: "2026-08-20 · From 6.94 Seconds to as Fast as 1.13: NextClaw Reopens Large Sessions About 6× Faster"
description: A 44.5MB stress session now opens quickly, with an initial response about 98% smaller while preserving all 500 tool calls.
---

# From 6.94 Seconds to as Fast as 1.13: NextClaw Reopens Large Sessions About 6× Faster

Published: 2026-08-20

Tags: `sessions` `performance` `tool calls`

NextClaw v0.40.0 improves how quickly large, tool-heavy sessions reopen.

In a 44.5MB stress session with 500 tool calls in one message, time to the latest visible message dropped from about **6.94 seconds** to **1.13–1.73 seconds**—up to about **6× faster**.

## Results

| Metric | Before | After |
| --- | ---: | ---: |
| Time to latest visible message | About 6.94s | 1.13–1.73s |
| Initial history response | 12.96MB | 261.85KB |
| Tool objects in the first view | About 1,450 | 20 summaries |
| History request | About 2.16s to first byte | About 219–281ms under concurrent load |
| 4.39MB of full tool details | Blocked the first view | Loaded on expansion in about 433ms |

The initial response is about **98% smaller**. Even when a session contains many commands, file operations, and tool results, users can see the latest progress first and expand the full process only when needed.

## Faster without dropping records

The optimization does not delete or truncate tool records.

NextClaw first shows the tool-call count, tool types, and final response. Expanding a process loads the full arguments and results for that message. Once loaded, collapsing and reopening it does not repeat the request.

For a message with 500 tool calls, the interface renders 40 items at a time. Every record remains available without forcing the page to mount hundreds of complex cards at once.

## Long-running work should remain easy to resume

Agents accumulate tool calls, arguments, and results over time. Those records preserve task continuity, but they should not make a session progressively harder to reopen.

NextClaw v0.40.0 now supports both needs:

- return to the latest task progress quickly;
- keep the complete execution history available for inspection.

Small sessions still load complete content in one pass. On-demand loading is reserved for genuinely large tool histories, so everyday sessions do not gain extra steps.

## Scope of the measurements

These numbers come from a local 44.5MB stress session with 500 tool calls. Actual timing will vary with the device, storage, network, session size, and concurrent requests.

The stress fixture remains in the project so future changes can continue checking first-view speed, response size, and navigation through large tool histories.
