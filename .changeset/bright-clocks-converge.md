---
"nextclaw": patch
"@nextclaw/service": patch
---

修复页面更新后 Agent 与 CLI 仍可能进入旧版 runtime 的问题。launcher 元数据现在只在启动边界消费一次，更新后的页面、Agent shell、服务重启与新开的 `nextclaw` 命令会统一使用当前 runtime。
