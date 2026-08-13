---
"@nextclaw/kernel": patch
"@nextclaw/server": patch
"@nextclaw/ui": patch
---

加快长会话的打开和历史加载：默认每页读取 40 条消息，空闲会话不再为首屏分页扫描完整消息索引，向上加载旧消息时也不再重复计算整段会话的上下文窗口。
