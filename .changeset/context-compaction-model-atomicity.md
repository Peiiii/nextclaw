---
"@nextclaw/kernel": patch
"nextclaw": patch
---

上下文压缩现在始终沿用当前会话所选模型；压缩请求失败时不会留下半完成状态，切换到可用模型后可以直接继续会话。
