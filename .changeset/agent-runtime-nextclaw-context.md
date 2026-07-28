---
"@nextclaw/ncp": patch
"@nextclaw/core": patch
"@nextclaw/kernel": patch
"@nextclaw/service": patch
"@nextclaw/nextclaw-ncp-runtime-stdio-client": patch
"@nextclaw/nextclaw-narp-stdio-runtime-wrapper": patch
"@nextclaw/nextclaw-ncp-runtime-codex-sdk": patch
"@nextclaw/nextclaw-narp-runtime-codex-sdk": patch
"@nextclaw/nextclaw-narp-runtime-claude-code-sdk": patch
"nextclaw": patch
---

Codex 和 Claude Code agent runtime 现在会保留各自原生系统提示词，并默认追加 NextClaw 产品指令、工作区上下文与 skill 信息；可通过 `nextclaw agents runtime config` 按 runtime 关闭或恢复注入。
