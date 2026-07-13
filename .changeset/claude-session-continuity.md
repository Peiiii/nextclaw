---
"@nextclaw/nextclaw-narp-runtime-claude-code-sdk": patch
"@nextclaw/nextclaw-ncp-runtime-claude-code-sdk": patch
---

修复 Claude Code 会话在连续消息间丢失上下文的问题。同一个 NextClaw 会话现在会复用并持久化对应的 Claude 会话，服务重启后也能继续此前的上下文。
