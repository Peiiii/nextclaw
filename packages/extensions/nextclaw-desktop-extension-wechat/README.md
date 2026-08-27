# @nextclaw/desktop-extension-wechat

微信桌面观察 Extension。它通过 NextClaw Desktop 的辅助功能宿主读取微信窗口，并把新出现的可见消息接入 Observation。

使用前需要：

1. 在 macOS 系统设置中允许 NextClaw Desktop 使用辅助功能。
2. 在 NextClaw 中分别允许本 Extension 读取和观察微信。
3. 由 Agent 使用 `bind_context` 或 `subscribe_events`，并将 `extensionId` 设为 `nextclaw-desktop-extension-wechat`。

当前版本只读取和观察可见内容，不发送消息。微信界面未打开、目标对话不可见或授权被撤销时，Observation 会进入可诊断的阻塞状态。
