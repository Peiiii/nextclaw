---
"nextclaw": patch
"@nextclaw/kernel": patch
"@nextclaw/service": patch
"@nextclaw/shared": patch
---

修复 NPM 安装缺少当前平台 Portable Runtime runner 时无法自愈的问题；Linux runner 改为静态链接，并确保 runner 启动失败不会带崩 NextClaw 主服务。发布流程会在 macOS、Linux 与 Windows 上验证真实应用启用、持久组件启动和 Action 调用。
