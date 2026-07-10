---
"@nextclaw/core": patch
"@nextclaw/kernel": patch
"@nextclaw/ncp-agent-runtime": patch
"@nextclaw/ncp-agent-runtime-next": patch
"@nextclaw/ncp-toolkit": patch
---

Treat incomplete OpenAI Responses streams as failed runs instead of successful partial answers, retry transient native model stream failures with OpenCode-style retry metadata and backoff, and record lightweight execution contracts in message run specs for debugging.
