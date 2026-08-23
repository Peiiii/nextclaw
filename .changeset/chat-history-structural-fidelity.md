---
"@nextclaw/ncp": patch
"@nextclaw/server": patch
"@nextclaw/ui": patch
---

修复会话历史摘要删除工具调用结构节点导致上下文压缩边界和 Continue 后续内容错位的问题。摘要现在保留完整的 part 顺序与数量，仅延迟大 payload 的加载。
