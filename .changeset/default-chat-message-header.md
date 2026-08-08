---
"@nextclaw/agent-chat-ui": patch
"@nextclaw/ui": patch
---

精简默认聊天消息的重复身份信息：Main Agent 使用 Native runtime 时，助手回复不再重复展示头像和名称；发送消息、编辑后重新执行或继续运行时，前端会立即进入“Agent 正在思考...”状态，无需等待后端 running 确认，Main Agent 使用 Native runtime 时该状态不展示头像；首个可见回复出现后立即隐藏；已处理摘要移除无操作含义的前置图标。
