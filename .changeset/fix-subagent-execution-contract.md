---
"@nextclaw/core": patch
"@nextclaw/kernel": patch
"@nextclaw/ui": patch
"nextclaw": patch
---

修复子 Agent 的运行、等待和通知语义：`sessions_spawn` 现在默认立即启动且不阻塞父 Agent，`notify` 只控制完成通知，`wait` 独立控制同步等待；仅创建空会话改为显式 `start=false`。异步任务结束后，原工具结果会可靠更新并在冷重启后保持终态。
