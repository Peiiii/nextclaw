---
"@nextclaw/bibo-hosted": patch
"@nextclaw/bibo-client": patch
---

修复刷新、手机切后台或连接断开时终止回复的问题。任务由服务端管理，页面返回后恢复同一次运行及停止入口，显示工作和连接状态，避免重复发送与错误的取消提示。
