# NextClaw Desktop 0.0.263

## 中文

NextClaw Desktop `0.0.263` 带来稳定版 `0.42.3` runtime，重点修复长会话压缩恢复、会话目录可靠性和 Desktop 原生 SQLite 启动问题。

- 桌面壳版本：`0.0.263`
- Runtime bundle 版本：`0.42.3`
- 最低 launcher 版本：`0.0.141`

### 主要变化

- 上下文压缩摘要被截断时，会优先保留可验证的关键内容、有限缩小输入重试，并在必要时保留近期原文继续会话。
- 会话目录迁移到 SQLite，并可从旧 journal、metadata 和 JSON 索引恢复，减少刷新或并发运行后会话从列表消失的问题。
- 安装包包含匹配 Electron 的 SQLite 原生模块；只有 NCP Agent 真正 ready 后，Desktop 才会报告启动成功。
- Agent 可以绑定持续刷新的 Context、订阅外部事件，并在会话时间线中接收事件卡片。
- Windows 上的网页链接改由系统默认浏览器打开，异常退出也会保留本地诊断与恢复记录。

### 桌面端发布范围

- macOS Apple Silicon 和 Intel DMG。
- Windows x64 安装包和 portable 包。
- Linux x64 AppImage、`.deb` 和 stable APT 仓库包。

完整更新说明：https://docs.nextclaw.io/zh/notes/2026-08-24-nextclaw-v0-42-3

## English

NextClaw Desktop `0.0.263` ships the stable `0.42.3` runtime, focusing on long-session compaction recovery, session catalog reliability, and native SQLite startup support.

- Desktop shell version: `0.0.263`
- Runtime bundle version: `0.42.3`
- Minimum launcher version: `0.0.141`

### Highlights

- When a compaction summary is truncated, NextClaw preserves a verified essential prefix, retries with progressively smaller input, and can retain recent source messages to keep the session moving.
- The session catalog moves to SQLite and can rebuild from legacy journals, metadata, and JSON indexes, reducing missing sessions after refreshes or concurrent runtime use.
- Installers include an Electron-compatible native SQLite module, and Desktop reports successful startup only after the NCP Agent is ready.
- Agents can bind refreshing Context, subscribe to external events, and receive event cards in the session timeline.
- Web links on Windows open in the system default browser, while unexpected host exits retain local diagnostics and recovery evidence.

### Desktop availability

- macOS Apple Silicon and Intel DMG builds.
- Windows x64 installer and portable packages.
- Linux x64 AppImage, `.deb`, and stable APT repository packages.

Full release notes: https://docs.nextclaw.io/en/notes/2026-08-24-nextclaw-v0-42-3
