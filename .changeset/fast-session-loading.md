---
"nextclaw": patch
"@nextclaw/core": patch
"@nextclaw/kernel": patch
---

修复会话搜索索引重复全目录扫描和并发写入造成的全局卡顿；会话列表改为 SQLite 页码分页、后端搜索排序与滚动前预取，在大量会话与重工具调用历史并存时仍能快速出现，并可继续访问全部会话、历史和工具详情。
