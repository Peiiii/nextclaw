---
"@nextclaw/shared": patch
"@nextclaw/extension-sdk": patch
"@nextclaw/core": patch
"@nextclaw/kernel": patch
"@nextclaw/service": patch
"@nextclaw/channel-extension-qq": patch
"nextclaw": patch
---

新增统一的结构化运行诊断事件、安全错误分类和日志查询命令，覆盖 Service、扩展、配置、渠道、Agent、全部 kernel 工具、外部 transport 与定时任务关键链路；取消、网络与未知异常都有独立可查询终态。内置 AI 现在可以按时间窗和关联 ID 从日志证据排查运行故障。QQ 渠道首先接入完整投递链路，并默认不记录消息正文、工具参数/结果、完整 URL、用户身份或凭据。
