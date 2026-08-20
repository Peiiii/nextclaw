---
"@nextclaw/core": patch
"@nextclaw/kernel": patch
"@nextclaw/server": patch
---

修复桌面端 Service App 启动：声明 `node` 或 `node.exe` 的应用现在统一使用 NextClaw 宿主内置 Node，不再要求 Windows、macOS 或 Linux 额外安装系统 Node；运行失败也会返回结构化错误。
