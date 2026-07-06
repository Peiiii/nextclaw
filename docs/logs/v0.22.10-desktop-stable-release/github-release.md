## English Version

NextClaw v0.22.1 desktop stable release brings the verified 0.22.1 runtime bundle to the desktop stable channel, with clearer Agent configuration, steadier long-session continuity, more accurate cancellation state, and more predictable file previews.

Desktop shell version: `0.0.217`
Runtime bundle version: `0.22.1`
Minimum launcher version: `0.0.141`

### Enhancements

- Agent management now separates read-only details from editing, so common configuration facts are easier to inspect while context-window overrides stay focused.
- When the left sidebar is collapsed, the chat header can search and switch between recent sessions without reopening the sidebar.
- Update prompts can show structured release notes before users download or apply a new version.
- Local HTML links stay in source preview by default, and rendered HTML opens only when explicitly requested.

### Fixes

- User-cancelled runs are shown as cancelled instead of being surfaced as failed conversation errors.
- Context compaction now preserves the current user turn and places compressed context in the leading system prompt, so long conversations can continue more coherently after rollover.
- Fresh-session onboarding content is no longer reinserted after context compaction.
- NARP stdio prompt timeouts are treated as idle timeouts, so actively streaming runs are not failed only because total request time was exceeded.

### Notes

- Full human-readable notes are available in the docs: [English](https://docs.nextclaw.io/en/notes/2026-07-06-nextclaw-v0-22-1) and [Chinese](https://docs.nextclaw.io/zh/notes/2026-07-06-nextclaw-v0-22-1).
- Structured release note data is available at [nextclaw-v0.22.1.json](https://docs.nextclaw.io/release-notes/nextclaw-v0.22.1.json).
- This release publishes macOS, Windows, and Linux installers, Windows portable packages, stable update manifests, update bundles, and the Linux APT package for the stable channel.
- No manual migration is required.

**Full Changelog**: https://github.com/Peiiii/nextclaw/compare/v0.22.0-desktop.1...v0.22.1-desktop.1

## 中文版

NextClaw v0.22.1 桌面端正式版将已验证的 0.22.1 runtime bundle 推进到桌面端 stable 通道，重点改进 Agent 配置查看、长会话连续性、取消状态、文件预览和更新前说明。

桌面壳版本：`0.0.217`
Runtime bundle 版本：`0.22.1`
最低 launcher 版本：`0.0.141`

### 增强

- Agent 管理页把只读详情和编辑配置分开，常用配置事实更容易检查，context window 覆盖项也更聚焦。
- 收起左侧栏后，聊天顶部可以搜索并切换最近会话，不需要先展开侧栏。
- 更新提示可以展示结构化版本说明，让用户在下载或应用前先看到本版本变化。
- 本地 HTML 链接默认保留源码预览，只在明确请求渲染视图时打开页面渲染。

### 修复

- 用户主动取消的运行会显示为已取消，不再被当作失败错误展示在会话里。
- 上下文压缩会保留当前用户输入，并把压缩后的上下文放入前置系统提示，长会话滚动后更容易继续原任务。
- 新会话引导内容不会在压缩后的会话里重复插入，减少上下文滚动后的干扰。
- NARP stdio prompt timeout 会按空闲超时处理，正在流式输出的任务不再仅因总耗时超过请求超时而失败。

### 说明

- 完整的人类可读版本说明见 docs：[中文](https://docs.nextclaw.io/zh/notes/2026-07-06-nextclaw-v0-22-1) / [English](https://docs.nextclaw.io/en/notes/2026-07-06-nextclaw-v0-22-1)。
- 结构化版本说明数据见 [nextclaw-v0.22.1.json](https://docs.nextclaw.io/release-notes/nextclaw-v0.22.1.json)。
- 本次发布包含 macOS、Windows、Linux 安装包、Windows portable 包、stable 更新 manifest、更新包，以及 stable Linux APT 包。
- 本版本不需要手动迁移。

**完整变更**: https://github.com/Peiiii/nextclaw/compare/v0.22.0-desktop.1...v0.22.1-desktop.1
