# English Version

NextClaw v0.27.7 adds registered project references in chat and improves Codex continuity, default execution access, queued-message refresh, and Marketplace uninstall safety.

## Highlights

- Reference a registered project from the chat composer’s `@` menu without changing the conversation’s working directory.
- Keep long-running Codex commands active while they continue producing output.
- Preserve the same Codex thread identity across real timeouts and runtime recreation.
- Use full local execution access by default while approval interaction is unavailable.
- Reject Marketplace skill uninstall targets outside its managed workspace boundary.

Full release notes: https://docs.nextclaw.io/en/notes/2026-07-29-nextclaw-v0-27-7

# 中文版

NextClaw v0.27.7 支持在聊天中引用已登记项目，并改进 Codex 会话连续性、默认执行权限、排队消息刷新与 Marketplace 卸载安全。

## 主要变化

- 从聊天输入框的 `@` 菜单引用已登记项目，不改变当前会话工作目录。
- Codex 长命令持续输出时保持活跃，不再被误判为空闲超时。
- 真实超时和 runtime 重建后继续保留同一个 Codex thread 身份。
- 在审批交互尚不可用时，Codex 默认使用完整本地执行权限。
- Marketplace skill 卸载目标不能越过它管理的 workspace 边界。

完整更新说明：https://docs.nextclaw.io/zh/notes/2026-07-29-nextclaw-v0-27-7
