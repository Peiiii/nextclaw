---
"@nextclaw/agent-chat-ui": patch
"@nextclaw/ncp-react": patch
"@nextclaw/ncp-toolkit": patch
"@nextclaw/ui": patch
---

精简默认聊天消息的重复身份信息：Main Agent 使用 Native runtime 时，助手回复不再重复展示头像和名称；新会话发送后，首条用户消息与“Agent 正在思考...”会立即稳定显示，并在正式会话生成前后保持连续；编辑后重新执行或继续运行也无需等待后端 running 确认；首个可见回复出现后立即隐藏思考提示；已处理摘要移除无操作含义的前置图标。
