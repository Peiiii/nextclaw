---
"nextclaw": patch
"@nextclaw/core": patch
"@nextclaw/kernel": patch
---

修复会话搜索索引重复全目录扫描和并发写入造成的全局卡顿，并把会话列表上限下推到 SQLite 查询；在大量会话与重工具调用历史并存时，列表和会话首屏仍能快速出现且不减少历史、搜索或工具详情。
