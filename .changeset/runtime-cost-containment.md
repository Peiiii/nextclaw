---
"@nextclaw/core": patch
"@nextclaw/kernel": patch
"@nextclaw/ncp-agent-runtime-next": patch
---

修复长时间运行的 Agent 任务可能异常消耗额度的问题：共享同一数据目录的进程不再重复执行同一会话或定时任务，工具调用次数现在严格遵守 Agent 配置上限，上下文压缩也按真实模型输入估算而不再重复计算工具结果。
