---
"@nextclaw/shared": patch
"@nextclaw/ncp-react": patch
"@nextclaw/kernel": patch
"@nextclaw/server": patch
"@nextclaw/client-sdk": patch
"@nextclaw/agent-chat-ui": patch
"@nextclaw/ui": patch
"nextclaw": patch
---

支持直接编辑当前会话最近一条用户消息并在同一会话继续执行；中断或失败后可从输入框或最近一条 AI 回复继续运行，后续输出会直接续写原回复而不是新增消息气泡，并准确区分续写前后成功与取消的工具操作。编辑器会自动聚焦到末尾，运行中隐藏编辑操作，所有纯图标入口均提供明确提示；切换模型时会继续保留可用的恢复入口。
