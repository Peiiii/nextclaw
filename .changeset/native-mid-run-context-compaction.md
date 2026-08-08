---
"@nextclaw/core": patch
"@nextclaw/ncp-agent-runtime-next": patch
"@nextclaw/ncp": patch
"@nextclaw/ncp-react": patch
"@nextclaw/ncp-toolkit": patch
"@nextclaw/agent-chat-ui": patch
"@nextclaw/kernel": patch
"@nextclaw/server": patch
"@nextclaw/ui": patch
"nextclaw": patch
---

Native 会话会在同一次长任务的工具调用轮次之间自动压缩上下文；压缩输入、输出和最终 checkpoint 使用包含工具 schema 与输出预留的同一动态预算，压缩后除完整摘要外还会按 token 预算保留最近的真实用户原文。上下文指示器会按完整输入显示系统与工具、会话内容、自动压缩线和输出预留。Agent 配置会按当前指令与全量工具动态拒绝不可用的小窗口；send、继续运行和编辑重跑共享同一运行状态入口，进程中断统一恢复为可继续的中性终态。运行中压缩与 continuation 前压缩会稳定显示在对应助手过程位置，刷新后不再堆到消息末尾。
