---
"@nextclaw/kernel": patch
"@nextclaw/server": patch
"@nextclaw/client-sdk": patch
"@nextclaw/ui": patch
---

应用市场现在使用 NextClaw 提供的真实宿主 target 判断兼容性：不支持当前设备的应用会被明确标注并禁用安装，同时仍可查看详情；历史安装失败不再跨页面刷新持续显示为错误和“重试”。
