---
"@nextclaw/core": patch
"@nextclaw/kernel": patch
"@nextclaw/nextclaw-ncp-runtime-stdio-client": patch
---

Fix ACP stdio runtime failures in local dev by preventing dev-only Node export conditions from leaking into external runtime child processes, and surface child stderr in runtime errors.
