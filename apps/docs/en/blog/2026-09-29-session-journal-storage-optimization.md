---
title: "NextClaw long-session journal: 178.4 MB down to 45.7 MB in a frozen sample"
description: "Live token updates stay intact while adjacent journal deltas are combined. A real session copy shrank 74.4% and passed cold replay and continuation checks."
---

# A long-session journal shrank from 178.4 MB to 45.7 MB

Written: 2026-09-29

Tags: `Sessions` `Reliability` `Performance`

A long-running collaboration can leave hundreds of thousands of token-level events. They preserve reasoning, replies, and tool arguments, but each short fragment also repeats the full event envelope. That repetition can dominate both journal size and index writes.

One user reported a two-day session with 1,003,611 lines and a 488.6 MB journal: about 205 MB of reasoning deltas, 83 MB of tool-argument deltas, and 147 MB of full message snapshots, including about 71 MB of image data. Those figures show the scale of the issue; they are not a measure of recoverable space.

In the NextClaw development build, live progress still streams fragment by fragment. Before the journal writes those fragments, adjacent deltas of the same type and message are combined. The journal remains in its existing v1 format, and full messages, tool results, images, and run events stay in place.

## Measured on a frozen session copy

We applied the offline maintenance path to an isolated copy of a real long session. The original and candidate were cold-replayed and their full messages compared. We then cold-started the compacted file, paged through it, appended a new message, and restarted again.

| Metric | Before | After |
| --- | ---: | ---: |
| Journal size | 178,436,341 bytes (about 178.4 MB) | 45,655,999 bytes (about 45.7 MB) |
| Event lines | 434,835 | 12,476 |
| File reduction | — | **74.4%** |

This is a measurement from one session, not a promise for every session. Sessions dominated by images or full message snapshots will have a different reduction. We did not modify or measure the user-reported journal above, so we do not apply this percentage to it.

We also ran a real conversation in an isolated development instance. The live stream delivered 598 text deltas while the journal wrote 13 combined text deltas. The final reply matched and the run finished normally. This confirms that streaming and journal coalescing worked together in that run; a release latency comparison is still pending.

## The continuity check

Reasoning, text, and tool-argument delta events often contain only a few bytes of new text. NextClaw joins their text in order only when adjacent events belong to the same message, tool, and event type. A message, tool, or run boundary flushes the pending text. The live state and UI continue to receive the original fine-grained stream.

An ordinary upgrade does not rewrite old journals. To maintain an existing file, [`nextclaw sessions compact-journal`](/en/guide/commands) first previews the result. Applying it requires every instance sharing the data directory to be stopped and explicitly acknowledged. The operation keeps a backup, compares cold replay before switching files, and restores that backup if a switch is interrupted. After a successful switch, `--restore` can recover the original file if the session has not gained new events; it refuses to overwrite later messages.

## Current scope

These results come from a development build and an isolated copy. Installer upgrades, platform-specific file switching, and live latency still need release verification. This article does not imply the change is already available in a published version or that journal appends gained a new power-loss durability guarantee. Ordinary upgrades will continue to leave old files unchanged.
