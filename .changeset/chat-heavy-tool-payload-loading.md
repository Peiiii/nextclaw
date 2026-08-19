---
"@nextclaw/kernel": minor
"@nextclaw/server": minor
"@nextclaw/client-sdk": minor
"@nextclaw/agent-chat-ui": minor
"@nextclaw/ui": minor
"nextclaw": minor
---

大工具调用历史会话改为按预算分级加载：首屏显示真实工具调用数量和类型，只有展开处理过程时才按消息读取完整参数与结果，并对超大工具组分批展示。历史分页与会话摘要改走有界投影读模型，避免打开会话时扫描完整 journal；会话列表先限量并限制 metadata 读取并发，减少首屏请求之间的 I/O 争用。
