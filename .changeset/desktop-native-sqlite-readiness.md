---
"@nextclaw/desktop": patch
"@nextclaw/core": patch
---

修复 Desktop 正式包的 SQLite 原生依赖与启动就绪判断：按 Electron ABI 打包 `better-sqlite3`，并在 NCP agent 真正 ready 后才认为桌面运行时启动成功。
