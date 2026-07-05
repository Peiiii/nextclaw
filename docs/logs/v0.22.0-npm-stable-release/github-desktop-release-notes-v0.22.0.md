## English Version

NextClaw v0.22.0 desktop stable release brings the latest runtime bundle to the desktop update channel, with clearer task flow, richer content previews, and more reliable runtime behavior.

Desktop shell version: `0.0.216`
Runtime bundle version: `0.22.0`
Minimum launcher version: `0.0.141`

### Features

- Chat input now supports queued messages while a task is running, so follow-up intent is preserved instead of interrupting the current run.
- Tool results can open files, URLs, local HTML previews, panel apps, and images with clearer first-class actions.
- The desktop UI includes the Night theme, giving users a darker working mode without changing the underlying workspace.
- Update prompts can consume structured release notes from the docs site, so users can read categorized version changes before downloading or applying an update.

### Improvements

- Chat output readability is improved with syntax highlighting, breadcrumbs, and stronger formatting for long technical responses.
- Desktop navigation and workspace selection are steadier across refreshed windows, recent workspaces, and session detail views.
- Attachment and image detail handling is more predictable when files are uploaded, previewed, or referenced from tool output.
- Runtime tool contracts are clearer for agents, especially around `show_file`, `show_url`, `show_panel_app`, and `view_image`.
- Local HTML previews now render as inspectable content instead of only exposing the raw file path.

### Fixes

- Failed sessions are easier to surface and inspect instead of disappearing behind optimistic UI state.
- Image detail settings now propagate more consistently to the runtime path that actually renders the result.
- Workspace and navigation state avoid several stale-selection cases after refresh or reconnect.
- NCP and MCP abort handling is cleaner, reducing cases where cancellation left background work in an ambiguous state.
- Several desktop/runtime integration fixes reduce mismatches between tool output, UI affordances, and the actual opened resource.

### Notes

- Full human-readable notes are available in the docs: [English](https://docs.nextclaw.io/en/notes/2026-07-05-nextclaw-v0-22-0) and [Chinese](https://docs.nextclaw.io/zh/notes/2026-07-05-nextclaw-v0-22-0).
- Structured release note data is available at [nextclaw-v0.22.0.json](https://docs.nextclaw.io/release-notes/nextclaw-v0.22.0.json).
- The desktop update manifest links to this GitHub Release as the release note URL; newer clients can also use the structured docs JSON for categorized in-app previews.

**Full Changelog**: https://github.com/Peiiii/nextclaw/compare/v0.21.12-desktop.1...v0.22.0-desktop.1

## 中文版

NextClaw v0.22.0 桌面端正式版将最新 runtime bundle 带入桌面稳定更新通道，重点改善任务连续输入、内容预览、界面阅读体验和运行时稳定性。

桌面壳版本：`0.0.216`
Runtime bundle 版本：`0.22.0`
最低 launcher 版本：`0.0.141`

### 功能

- 聊天输入支持任务运行中的排队发送，用户的后续意图会被保留，不需要打断当前任务。
- 工具结果可以更清晰地打开文件、URL、本地 HTML 预览、面板应用和图片。
- 桌面 UI 新增 Night 主题，用户可以切换到更暗的工作模式，不影响底层 workspace。
- 更新提示可以消费 docs 站的结构化版本说明，让用户在下载或应用更新前看到分类后的本版本变化。

### 增强

- 聊天输出增加语法高亮、路径面包屑和更清晰的长内容排版，技术响应更容易阅读。
- 桌面导航、最近 workspace 和 session 详情在刷新窗口或重新连接后更稳定。
- 附件和图片细节在上传、预览以及工具输出引用时更可预测。
- agent 工具合同更清晰，尤其是 `show_file`、`show_url`、`show_panel_app` 和 `view_image`。
- 本地 HTML 预览现在可以作为可查看内容打开，而不是只暴露原始文件路径。

### 修复

- 失败会话更容易被看到和检查，不再容易被乐观 UI 状态遮住。
- 图片 detail 设置能更稳定地传递到真正负责渲染结果的运行链路。
- workspace 与导航状态减少了刷新或重连后的陈旧选择问题。
- NCP 与 MCP 的 abort 传播更干净，减少取消后后台工作状态不明确的情况。
- 多项桌面端与 runtime 集成修复，减少工具输出、UI 操作入口和实际打开资源之间的不一致。

### 说明

- 完整的人类可读版本说明见 docs：[中文](https://docs.nextclaw.io/zh/notes/2026-07-05-nextclaw-v0-22-0) / [English](https://docs.nextclaw.io/en/notes/2026-07-05-nextclaw-v0-22-0)。
- 结构化版本说明数据见 [nextclaw-v0.22.0.json](https://docs.nextclaw.io/release-notes/nextclaw-v0.22.0.json)。
- 桌面更新 manifest 的 `releaseNotesUrl` 指向本 GitHub Release；较新的客户端也可以用 docs JSON 在应用内展示分类预览。

**完整变更**: https://github.com/Peiiii/nextclaw/compare/v0.21.12-desktop.1...v0.22.0-desktop.1
