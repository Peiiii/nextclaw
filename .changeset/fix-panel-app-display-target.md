---
"@nextclaw/kernel": patch
"@nextclaw/core": patch
---

Resolve `show_panel_app` App IDs to their enabled primary Panel before emitting a display request, and return `PANEL_APP_NOT_FOUND` for unknown or inactive targets.
