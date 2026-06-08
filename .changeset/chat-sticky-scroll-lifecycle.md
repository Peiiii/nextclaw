---
"@nextclaw/agent-chat-ui": patch
"@nextclaw/ui": patch
---

Improve chat sticky-scroll lifecycle cleanup so queued scroll frames are cancelled on unmount, reducing the chance of stale chat scroll scheduling after session or view transitions.
