---
"nextclaw": minor
"@nextclaw/app-runtime": minor
"@nextclaw/kernel": minor
"@nextclaw/ui": minor
---

把 Mini App、Panel App 和 Service App 收敛为可安装、可更新、可卸载的统一 App 产品：每个 App Instance 现在拥有独立的 data、config、state、cache、tmp 和 logs 目录，卸载默认保留个人数据，重装时只允许同一发布者继续使用。

更新会先安装和探测候选版本，再切换当前版本；候选 Service 启动失败、数据 schema 不兼容或代码完整性异常时，旧版本和旧数据保持可用。Apps 管理界面同时显示真实的数据位置、占用空间和运行隔离等级，原生进程会明确标注为当前用户完整权限，社区原生 Service App 不再允许直接进入公开目录。
