---
"@nextclaw/ncp": patch
"@nextclaw/nextclaw-ncp-runtime-codex-sdk": patch
"@nextclaw/nextclaw-narp-stdio-runtime-wrapper": patch
"@nextclaw/nextclaw-ncp-runtime-stdio-client": patch
"@nextclaw/server": patch
---

Keep Codex conversations attached to the same thread across idle timeouts, and treat ongoing command output as activity so long-running commands can continue while they are still making progress.
