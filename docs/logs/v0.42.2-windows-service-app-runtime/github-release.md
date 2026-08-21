# NextClaw Desktop 0.0.262

## 中文

NextClaw Desktop `0.0.262` 带来稳定版 `0.42.2` runtime，修复 Windows 上内置收藏与日历等 Service App 可能只显示通用请求失败的问题。

- 桌面壳版本：`0.0.262`
- Runtime bundle 版本：`0.42.2`
- 最低 launcher 版本：`0.0.141`

### 主要变化

- Service App 已知错误跨打包边界时可被稳定识别并返回结构化状态，不再误降级为无信息的通用 500。
- Windows Desktop 的发布验证现在会在真正打包的应用中启用个人空间、授权并实际读写收藏和日历。
- 验证同时覆盖 Windows 安装器、解压版与 Portable 包，并兼容 Windows PowerShell 5。

### 桌面端发布范围

- macOS Apple Silicon 和 Intel DMG。
- Windows x64 安装包和 portable 包。
- Linux x64 AppImage、`.deb` 和 stable APT 仓库包。

完整更新说明：https://docs.nextclaw.io/zh/notes/2026-08-22-nextclaw-v0-42-2

## English

NextClaw Desktop `0.0.262` ships the stable `0.42.2` runtime and fixes a Windows issue where built-in Service Apps such as Favorites and Calendar could show only a generic request failure.

- Desktop shell version: `0.0.262`
- Runtime bundle version: `0.42.2`
- Minimum launcher version: `0.0.141`

### Highlights

- Known Service App errors are recognized across packaged runtime boundaries and keep their structured status instead of being downgraded to an opaque 500 response.
- Windows release verification now enables the personal organizer and performs authorized Favorites and Calendar reads and writes inside the actual packaged desktop app.
- Verification covers the Windows installer, unpacked app, and portable package, including Windows PowerShell 5 compatibility.

### Desktop availability

- macOS Apple Silicon and Intel DMG builds.
- Windows x64 installer and portable packages.
- Linux x64 AppImage, `.deb`, and stable APT repository packages.

Full release notes: https://docs.nextclaw.io/en/notes/2026-08-22-nextclaw-v0-42-2
