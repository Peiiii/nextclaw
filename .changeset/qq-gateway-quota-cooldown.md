---
"@nextclaw/channel-extension-qq": patch
---

Treat QQ gateway session quota exhaustion as a startup cooldown instead of a generic startup failure, logging the reset-aligned retry without a stack trace.
