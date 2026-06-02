---
title: "2026-06-03 · Real-Time Agent Progress: Current State and Next Steps"
description: "NextClaw already has real-time session updates, run status, and NCP process events. The next step is to project these into clearer task progress views."
---

# 2026-06-03 · Real-Time Agent Progress: Current State and Next Steps

Published: 2026-06-03  
Tags: `product` `real-time state` `agents` `sessions`

## Abstract

NextClaw already has several low-level capabilities related to real-time agent progress:

- the session list can update as sessions change
- sessions can expose `running / idle` state
- session summaries can be incrementally upserted or deleted
- NCP events can describe run lifecycle, reasoning, tool calls, tool results, and context-window changes

These capabilities are not yet a complete task progress dashboard. The current result is more precise: **the foundation for real-time task observability exists; the product layer still needs projection and organization.**

## Current Results

| Capability | Current state | User-visible result |
| --- | --- | --- |
| Real-time session updates | Available | Session list can update as sessions change |
| Run status | Basic form available | Running sessions can be shown as `running` |
| Incremental session summary updates | Available | New, updated, and deleted sessions can sync into the list |
| NCP process events | Protocol foundation available | Can represent run, reasoning, tool call, tool result, and related process data |

## Boundaries

This is not yet a complete global task dashboard.

Main gaps:

- The list mainly shows session-level state, not full task phases.
- `running / idle` is still coarse-grained.
- NCP process events need to be aggregated into user-readable summaries.
- Background tasks, scheduled tasks, and child-agent tasks do not yet share one progress view.

## Next Steps

Three near-term directions:

1. Extend session-list state with latest phase, latest event, and waiting-for-user indicators.
2. Project NCP events into task progress summaries instead of only rendering them inside the conversation stream.
3. Use one progress model for sessions, child sessions, scheduled tasks, and background tasks.

This post records the current facts and next directions. It does not present an unfinished product shape as already complete.

## Keep Reading

- [Product Vision](/en/project/vision)
- [Multi-Agent Routing](/en/guide/multi-agent)
- [Why Project-Aware Sessions Matter More Than One More AI Feature](/en/blog/2026-04-03-why-project-aware-sessions-matter)
