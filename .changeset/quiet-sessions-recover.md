---
"nextclaw": patch
"@nextclaw/core": patch
"@nextclaw/kernel": patch
"@nextclaw/ncp-agent-runtime-next": patch
"@nextclaw/server": patch
"@nextclaw/ui": patch
"@nextclaw/client-sdk": patch
"@nextclaw/bibo-client": patch
---

Keep long conversations usable when context summaries are incomplete. Persist verifiable recovery checkpoints, require original-history reads or explicit business clarification before resuming actions, and prevent unsafe retry after tool execution.

Load large histories through bounded SQLite pages and exact source fragments, with visible, cancellable index preparation instead of full-history loading. Preserve original journals and support the same projection contract in local and hosted sessions.
