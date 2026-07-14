---
"@nextclaw/agent-chat-ui": patch
"@nextclaw/ui": patch
---

修复流式输出期间输入框后台同步覆盖页面选区、历史 Markdown 因动态 renderer 变化重新挂载，以及内联 Panel App 被动态工具分组重新挂载的问题，并移除弹层对输入框焦点的旧兜底特判。
