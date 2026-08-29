---
"@nextclaw/core": patch
"@nextclaw/kernel": patch
"@nextclaw/ncp-agent-runtime-next": patch
"@nextclaw/server": patch
"@nextclaw/ui": patch
"nextclaw": patch
---

修复旧实例在第 20 次工具调用后突然中止 Agent 任务的问题：废弃并移除可配置的工具调用上限，旧配置文件中的相关值不再参与运行；NextClaw native runtime 统一使用固定的 1000 次工具调用安全预算，设置页、Agent 详情和 API 也不再暴露该配置。
