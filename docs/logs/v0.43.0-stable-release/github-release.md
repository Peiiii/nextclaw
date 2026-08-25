# NextClaw v0.43.0

## 中文

NextClaw v0.43.0 让每次 AI 运行更容易核对来源和实际执行信息，并改善插话、子会话和长会话排队体验。

- 消息“更多操作”统一展示触发方、来源渠道、关联会话与消息、工具调用、来源模型和实际运行模型。
- 只有用户直接发起的后台任务弹出完成通知；Agent 委派、定时任务、观察任务和系统运行保持安静。
- 运行中插到下一步的消息在流式、完成和刷新后保持稳定顺序。
- 子会话继承父会话模型，不重复展示继承的压缩记录，并停止递归创建下一层会话。
- 长会话排队确认不再读取和复制完整历史；文件工具结果不再重复展示。

完整更新说明：https://docs.nextclaw.io/zh/notes/2026-08-25-nextclaw-v0-43-0

## English

NextClaw v0.43.0 makes every AI run easier to trace and improves steering, child sessions, and queueing in long conversations.

- The message overflow menu shows the initiator, source channel, related session and message, tool call, source model, and effective run model.
- Only human-started background tasks show completion notifications; delegated, scheduled, observed, and system runs stay quiet.
- Messages steered into the next step keep a stable order during streaming, after completion, and after reload.
- Child sessions inherit the parent model, hide inherited compaction records, and no longer recursively create another level.
- Queue admission no longer reads and copies the complete conversation, and file-tool results no longer appear twice.

Full release notes: https://docs.nextclaw.io/en/notes/2026-08-25-nextclaw-v0-43-0
