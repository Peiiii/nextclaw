---
"nextclaw": minor
"@nextclaw/kernel": patch
"@nextclaw/server": patch
"@nextclaw/service": patch
"@nextclaw/shared": patch
"@nextclaw/extension-sdk": patch
"@nextclaw/channel-extension-dingtalk": patch
"@nextclaw/channel-extension-discord": patch
"@nextclaw/channel-extension-email": patch
"@nextclaw/channel-extension-feishu": patch
"@nextclaw/channel-extension-qq": patch
"@nextclaw/channel-extension-slack": patch
"@nextclaw/channel-extension-telegram": patch
"@nextclaw/channel-extension-wecom": patch
"@nextclaw/channel-extension-weixin": patch
"@nextclaw/channel-extension-whatsapp": patch
---

渠道扩展改为按需启动：未启用渠道不再常驻独立 Node 进程，运行中启用或禁用渠道会自动创建或回收对应扩展；同时增加 ready/generation 隔离、鉴权会话租约、有限故障恢复和扩展进程内存诊断。

在 ARM64 Linux、2 vCPU / 2 GiB 限制和无活跃任务的空配置基准中，三轮平均 working set 从旧版本约 865～885 MiB 降至 164.94 MiB，下降约 81%。活跃 Agent runtime、浏览器、MCP、本地模型和已启用渠道仍会按实际工作增加内存占用。
