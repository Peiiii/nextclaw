---
"@nextclaw/ncp": minor
"@nextclaw/ncp-agent-runtime": patch
"@nextclaw/ncp-agent-runtime-next": patch
"@nextclaw/ncp-toolkit": patch
"@nextclaw/ncp-http-agent-client": patch
"@nextclaw/ncp-http-agent-server": patch
"@nextclaw/ncp-react": patch
"@nextclaw/kernel": patch
"@nextclaw/ui": patch
"@nextclaw/nextclaw-ncp-runtime-codex-sdk": patch
"@nextclaw/nextclaw-ncp-runtime-claude-code-sdk": patch
"@nextclaw/nextclaw-ncp-runtime-stdio-client": patch
"@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http": patch
---

Add standard NCP event timing and message lifecycle fields so completed assistant process summaries can show real elapsed time derived from started and ended timestamps.
Stamp first-party runtime, transport, and extension-produced NCP events at their producer boundary instead of estimating duration in UI or journal consumers.
Make Codex app-server aborts emit the standard NCP abort event promptly so the conversation leaves the running state without waiting for another app-server notification.
