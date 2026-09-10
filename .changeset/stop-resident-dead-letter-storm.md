---
"@nextclaw/kernel": patch
"@nextclaw/server": patch
"nextclaw": patch
---

Stop resident timer ingress at dead-letter boundaries and isolate oversized inboxes before they can exhaust host memory or disk I/O.
