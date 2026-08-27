---
"@nextclaw/service": patch
"@nextclaw/ui": patch
"nextclaw": patch
---

现在可以直接从聊天侧边栏每个会话的更多菜单删除会话，无需先打开目标会话。删除当前会话会回到会话根页；删除其它会话不会中断当前阅读，并会显示成功或失败提示。删除确认弹窗打开后，可按 Enter 确认或 Escape 取消。命令行也新增 `nextclaw sessions delete <session-id> --confirm <session-id> --json`，确认值必须与会话 ID 完全一致。
