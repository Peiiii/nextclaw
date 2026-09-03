---
"@nextclaw/kernel": patch
"@nextclaw/server": patch
"@nextclaw/client-sdk": patch
"@nextclaw/ui": patch
"@nextclaw/service": patch
"nextclaw": patch
---

新增安全的项目移除能力：用户可在项目页面确认影响后将项目从列表移除，或通过要求精确项目 ID 确认的 CLI 执行同一操作；本地目录、历史会话和 Project Work 保持不变，重新添加同一目录会恢复原项目。
