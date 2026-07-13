---
"@nextclaw/nextclaw-narp-runtime-claude-code-sdk": patch
"@nextclaw/nextclaw-ncp-runtime-claude-code-sdk": patch
"@nextclaw/nextclaw-narp-stdio-runtime-wrapper": patch
---

修复 Claude Code 会话在连续消息、模型切换和服务重启后丢失上下文，以及上游失败被误判为成功结束的问题。同一个 NextClaw 会话现在稳定绑定同一个 Claude 会话，并通过持久化 transcript store 跨 provider 配置目录恢复；临时空响应会自动重试，仍失败时会保留可见错误并明确结束为运行失败。
