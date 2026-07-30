---
"@nextclaw/nextclaw-narp-runtime-claude-code-sdk": patch
"@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http": patch
"@nextclaw/nextclaw-ncp-runtime-claude-code-sdk": patch
---

阻止 Claude Code 与 Hermes runtime 在同一个 NextClaw 会话中被上游响应替换外部会话身份；检测到身份漂移时会明确失败，避免静默切换上下文。
