---
"@nextclaw/agent-chat-ui": patch
"@nextclaw/ui": patch
---

精简默认聊天消息的重复身份信息：Main Agent 使用 Native runtime 时，助手回复不再重复展示头像和名称；新会话第一条消息会在真正回复前持续显示无头像的“Agent 正在思考...”，回复开始后立即隐藏；已处理摘要移除无操作含义的前置图标。
