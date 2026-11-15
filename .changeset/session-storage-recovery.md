---
"@nextclaw/core": patch
"@nextclaw/kernel": patch
"nextclaw": patch
---

Keep conversations usable when a catalog or preview update fails after history was saved. Retain unexecuted queued input during storage faults and recover the same session on the next send after storage access is restored, without restarting or replaying an already executed request. Preserve the underlying storage error and failure stage in diagnostic logs, and keep log-file failures from interrupting conversations.
