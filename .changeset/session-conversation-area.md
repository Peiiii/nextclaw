---
"@nextclaw/ui": patch
---

Refactor the chat conversation area into a reusable self-contained surface. Root chat and workspace child sessions now share the same conversation input/send flow, child sessions can continue from the right panel, and the app presenter context stays stable across local hot reloads.
