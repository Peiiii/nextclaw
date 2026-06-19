---
"@nextclaw/agent-chat-ui": patch
"@nextclaw/kernel": patch
"@nextclaw/shared": patch
"@nextclaw/ui": patch
---

Add a Side chat slash command before skill entries in the slash panel. The command opens a right-side draft child conversation, keeps backend session creation deferred until the first send, and materializes that first send into an inherited child session.
