---
"@nextclaw/core": patch
"@nextclaw/kernel": patch
---

Use real context compaction so compressed sessions feed the model a single working-context summary instead of retaining raw message tails.
