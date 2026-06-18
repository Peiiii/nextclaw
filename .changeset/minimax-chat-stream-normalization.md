---
"@nextclaw/core": patch
---

Normalize OpenAI-compatible chat streams so MiniMax responses that end after `finish_reason` complete cleanly instead of surfacing `Premature close` in Docker.
