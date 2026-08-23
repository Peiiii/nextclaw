---
"@nextclaw/kernel": patch
---

将会话摘要目录迁移到 SQLite，兼容并重建旧 journal、metadata 和 JSON 索引，避免多个 runtime 刷新后会话从列表中消失。
