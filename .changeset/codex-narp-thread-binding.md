---
"@nextclaw/kernel": patch
"@nextclaw/nextclaw-ncp-runtime-codex-sdk": patch
"@nextclaw/nextclaw-narp-runtime-codex-sdk": patch
"@nextclaw/nextclaw-narp-stdio-runtime-wrapper": patch
"@nextclaw/nextclaw-ncp-runtime-stdio-client": patch
---

Persist NARP runtime session metadata updates so Codex thread ids are bound back to NextClaw sessions across restarts, and wait for Codex SDK thread metadata writers before continuing a run.
