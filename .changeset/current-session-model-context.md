---
"@nextclaw/kernel": patch
---

切换会话模型后，AI 会在当前会话上下文中收到本轮实际执行的 provider/model 标识，避免把全局默认模型或历史模型自述误当成当前模型。
