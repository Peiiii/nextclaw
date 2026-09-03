---
"@nextclaw/kernel": patch
"@nextclaw/service": patch
---

将项目注册与项目工作项统一存入同一个 SQLite 数据库，并在首次使用时自动、事务化迁移旧 `projects.json`，避免服务启动期间项目列表因旧格式而加载失败。
