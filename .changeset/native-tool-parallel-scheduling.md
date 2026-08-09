---
"@nextclaw/core": patch
"@nextclaw/kernel": patch
"@nextclaw/ncp-agent-runtime-next": patch
"@nextclaw/ncp": patch
"nextclaw": patch
---

Native 会话现在会并行执行同一轮中的只读文件、图片、网页和记忆查询，同时让写入、命令和未明确声明安全的工具继续独占执行；多个查询可以更快返回，工具结果仍按原调用位置回填，后续模型回复不会因完成顺序不同而错位。
