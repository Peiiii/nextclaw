---
"@nextclaw/ncp": minor
"@nextclaw/ncp-toolkit": patch
"@nextclaw/ncp-agent-runtime": patch
"@nextclaw/ncp-agent-runtime-next": patch
"@nextclaw/nextclaw-ncp-runtime-codex-sdk": patch
"@nextclaw/agent-chat": patch
"@nextclaw/agent-chat-ui": patch
"@nextclaw/core": patch
"@nextclaw/kernel": patch
"@nextclaw/ui": patch
---

命令工具卡新增实时执行计时：命令真正开始后持续显示已运行时长，并在成功、失败或取消后冻结并保留耗时；刷新会话后仍可从标准 NCP 执行时间恢复。内置命令运行时与 Codex command execution 统一使用同一条计时协议，不再把排队或参数生成时间算作命令执行耗时。
