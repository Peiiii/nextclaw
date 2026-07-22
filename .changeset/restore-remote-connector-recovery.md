---
"@nextclaw/remote": patch
"@nextclaw/service": patch
"nextclaw": patch
---

Remote 连接异常断开后会从基础延迟重新连接，不再因历史失败累计而长时间显示 offline；多个本地进程同时运行时，状态页也会以真正持有 Remote 的服务为准。
