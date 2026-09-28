---
"@nextclaw/bibo-hosted": minor
"@nextclaw/kernel": patch
"@nextclaw/core": patch
---

Bibo 普通对话和个人空间操作改由边缘会话运行，保留旧会话、文件与问答状态，并避免每条消息启动用户容器及生成整份快照。NextClaw 的通用对话输入与上下文能力增加可移植入口，现有 Node 宿主继续使用相同语义。
