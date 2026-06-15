---
"@nextclaw/core": patch
"@nextclaw/kernel": patch
"@nextclaw/ncp": patch
"@nextclaw/ncp-toolkit": patch
"@nextclaw/server": patch
"@nextclaw/ui": patch
"@nextclaw/nextclaw-narp-runtime-codex-sdk": patch
"@nextclaw/nextclaw-narp-runtime-claude-code-sdk": patch
"@nextclaw/nextclaw-narp-runtime-opencode": patch
"@nextclaw/nextclaw-narp-stdio-runtime-wrapper": patch
"@nextclaw/nextclaw-ncp-runtime-codex-sdk": patch
"@nextclaw/nextclaw-ncp-runtime-claude-code-sdk": patch
"@nextclaw/nextclaw-ncp-runtime-stdio-client": patch
---

Expose runtime-default thinking capability through runtime entry configuration and session type listings, persist Codex thread metadata across NARP stdio, and pass session working directories through NCP execution context instead of coupling agent runtimes to NextClaw session state.
