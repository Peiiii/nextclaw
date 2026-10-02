---
"@nextclaw/kernel": patch
"@nextclaw/server": patch
"@nextclaw/ui": patch
"@nextclaw/service": patch
"nextclaw": patch
"@nextclaw/core": patch
---

Keep session pins across refreshes, instance restarts, and browsers, and place pinned sessions before pagination so older pinned work remains visible. Existing browser pins migrate automatically without overriding a saved unpin. Failed saves restore the previous state and show an error. Add matching `sessions pin` / `sessions unpin` CLI actions and AI session updates.
