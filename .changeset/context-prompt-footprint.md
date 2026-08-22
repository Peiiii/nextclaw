---
"@nextclaw/core": patch
"@nextclaw/kernel": patch
---

降低空用户会话的固有上下文占用：技能目录改为保留完整描述的紧凑分组格式，工具目录不再与工具 schema 重复，回复格式合同去除重复表述，从而减少过早触发上下文压缩的概率。
