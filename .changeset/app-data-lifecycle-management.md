---
"nextclaw": minor
"@nextclaw/app-runtime": minor
"@nextclaw/kernel": minor
"@nextclaw/server": minor
"@nextclaw/client-sdk": minor
"@nextclaw/ui": minor
"@nextclaw/core": minor
---

把 App 数据生命周期补齐为可管理的产品能力：App 更新继续复用原实例，卸载与 Workspace Service 删除默认保留个人数据，也可以在确认后同时永久删除 data、config、state、cache、tmp 和 logs。

Apps 页面会显示六类数据占用、受管路径和已保留数据，并支持稍后清理；CLI 新增 `nextclaw app data list/delete`，开发态可用 `nextclaw app dev --reset-data --confirm <app-id>` 精确重置当前实例。HTTP、Client SDK、双语文档与内建自管理 Skill 同步使用同一套安全确认和 active/retained 规则。
