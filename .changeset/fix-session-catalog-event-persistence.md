---
"@nextclaw/kernel": patch
"nextclaw": patch
---

修复 Desktop 0.47.0 中会话事件写入 SQLite 目录时因多余命名参数持续失败的问题。消息发送后的 journal、会话摘要和列表投影会重新保持一致，并新增真实 SQLite 回归测试阻止同类伪成功进入发布。
