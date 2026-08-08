---
"@nextclaw/core": patch
"@nextclaw/kernel": patch
"@nextclaw/nextclaw-ncp-runtime-claude-code-sdk": patch
"@nextclaw/nextclaw-ncp-runtime-codex-sdk": patch
"@nextclaw/ui": patch
"nextclaw": patch
---

修复聊天失败时同一供应商错误在对话区和输入框重复显示、视觉提示过强且原始响应被截断的问题；错误现在只在对话区以低干扰样式显示一次，正文保留供应商返回的完整内容，并在内容较长时通过限高滚动查看。
