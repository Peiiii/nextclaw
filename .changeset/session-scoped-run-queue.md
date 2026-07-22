---
"@nextclaw/client-sdk": patch
"@nextclaw/kernel": patch
"@nextclaw/ncp-react": patch
"@nextclaw/server": patch
"@nextclaw/shared": patch
"@nextclaw/ui": patch
---

会话正在回复时继续发送的消息现在由后端按会话排队，并会在当前回复完成后按顺序执行；切换会话或刷新页面后仍能查看、编辑和删除对应会话的待发消息。
