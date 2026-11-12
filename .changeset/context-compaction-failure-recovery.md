---
"@nextclaw/core": patch
"@nextclaw/kernel": patch
---

Manual context compaction now reports failures accurately and retains their causes in session history before returning an error. Conversations under message-count or part-count pressure can install verifiable recovery checkpoints when a summary is unavailable, avoiding repeated unsuccessful summary calls while preserving original history and recovery safeguards.
