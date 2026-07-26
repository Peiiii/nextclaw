---
"@nextclaw/ui": patch
---

修复新任务切换 Agent Runtime 后仍沿用其他 Runtime 模型的问题。现在会优先恢复用户最近为该 Runtime 选择的模型；没有历史选择时，再使用该 Runtime 的推荐模型或全局默认模型。
