---
"@nextclaw/core": patch
"@nextclaw/kernel": patch
"@nextclaw/ncp-agent-runtime-next": patch
---

Preserve the current user turn during context compaction, fold compressed context into the leading system prompt, and suppress fresh-session onboarding templates after rollover so compressed NCP/native conversations continue coherently.
