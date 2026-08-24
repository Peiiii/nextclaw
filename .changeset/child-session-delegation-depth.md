---
"@nextclaw/kernel": patch
---

Prevent child sessions from creating additional sessions. Top-level sessions keep one-level delegation, while child sessions no longer receive session creation tools and nested creation is rejected before persistence.
