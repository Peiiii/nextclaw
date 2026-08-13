---
"nextclaw": patch
"@nextclaw/ui": patch
"@nextclaw/kernel": patch
---

将内置个人空间升级到 0.1.4：重新设计待办和日历，补齐响应式布局、编辑与失败状态、外部日历来源管理，并修复日程范围与同步数据的一致性。同时修复应用检查更新的 Registry 响应兼容问题、成功重试后仍显示历史失败的问题，以及 `app dev/call` 没有为本地 Service APP 注入隔离数据目录的问题。
