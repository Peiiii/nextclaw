---
"@nextclaw/ncp-react": patch
"@nextclaw/ui": patch
---

修复 AI 回复期间追加消息会同时出现在会话记录和待发队列的问题；排队消息会在真正开始执行后进入会话记录，并且只显示一次。
