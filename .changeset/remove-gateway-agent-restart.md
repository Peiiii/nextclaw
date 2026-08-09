---
"@nextclaw/core": patch
"@nextclaw/kernel": patch
"@nextclaw/service": patch
"nextclaw": patch
---

移除无法可靠完成会话恢复的 agent `gateway.restart` 能力；需要重启时，现在统一提示用户在外部终端运行顶层 `nextclaw restart`，并明确 `nextclaw gateway` 仅用于启动前台 gateway、不提供生命周期子命令。
