---
"@nextclaw/core": patch
"@nextclaw/kernel": patch
"@nextclaw/ui": patch
---

Add opt-in parent context inheritance for child sessions spawned through `sessions_spawn`. Child sessions can now inherit parent messages up to the spawn anchor, and the chat timeline marks inherited context at the start of the message list.
