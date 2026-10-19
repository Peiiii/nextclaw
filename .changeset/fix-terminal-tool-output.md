---
"@nextclaw/agent-chat-ui": patch
"@nextclaw/ui": patch
---

修复命令执行成功后工具卡片仍显示“无输出”的问题。现在会展示 `stdout`、`stderr` 等终端内容，同时继续隐藏原始 JSON；命令没有产生输出时仍显示空输出提示。
