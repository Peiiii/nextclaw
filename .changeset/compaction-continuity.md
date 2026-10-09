---
"@nextclaw/core": patch
"@nextclaw/kernel": patch
"nextclaw": patch
---

Preserve tool identities and complete recent tool rounds during context compaction. Carry completed work forward across repeated summaries, keep newly appended assistant parts exactly once, and recover safely when a summary cannot fit without losing execution records.
