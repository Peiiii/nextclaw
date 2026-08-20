# NextClaw Desktop 0.0.260

## 中文

NextClaw Desktop `0.0.260` 将稳定版 `0.42.0` runtime 带入桌面端更新通道。

- 桌面壳版本：`0.0.260`
- Runtime bundle 版本：`0.42.0`
- 最低 launcher 版本：`0.0.141`

### 主要变化

- 固定到主侧栏的 Panel App 现在可以收拢到可折叠分组中。
- Marketplace 会在安装前明确说明当前平台是否兼容。
- 桌面端声明 `node` 或 `node.exe` 的 Service App 统一使用 NextClaw 内置 Node runtime。
- 稳定版 runtime 包包含经过校验的 UI 预压缩资产，静态部署传输更快。

### 桌面端发布范围

- macOS Apple Silicon 和 Intel DMG。
- Windows x64 安装包和 portable 包。
- Linux x64 AppImage、`.deb` 和 stable APT 仓库包。

### 验证

- `nextclaw@0.42.0` 及同批 43 个 NPM 包已发布到公开 registry，并逐包完成校验。
- darwin arm64/x64、linux x64、win32 x64 stable runtime 更新资产已构建，并发布到 GitHub Release 与公开 stable channel。
- 从 `0.41.0` 安装态执行 `check`、`download-only`、`apply` 和新进程版本检查，最终确认版本为 `0.42.0`。

完整更新说明：https://docs.nextclaw.io/zh/notes/2026-08-21-nextclaw-v0-42-0

## English

NextClaw Desktop `0.0.260` brings the stable `0.42.0` runtime to the desktop update channel.

- Desktop shell version: `0.0.260`
- Runtime bundle version: `0.42.0`
- Minimum launcher version: `0.0.141`

### Highlights

- Main-sidebar pinned Panel Apps can now be grouped into a collapsible section.
- Marketplace entries clearly explain platform compatibility before installation.
- Service Apps that declare `node` or `node.exe` use the Node runtime bundled with NextClaw on desktop.
- Stable runtime packages include validated precompressed UI assets for faster static delivery.

### Desktop availability

- macOS Apple Silicon and Intel DMG builds.
- Windows x64 installer and portable packages.
- Linux x64 AppImage, `.deb`, and stable APT repository packages.

### Verification

- NPM `nextclaw@0.42.0` and all 43 release packages were published and verified from the public registry.
- Stable runtime update assets were built for darwin arm64/x64, linux x64, and win32 x64, then published to GitHub Release and the public stable channel.
- The published update path was verified from `0.41.0` through `check`, `download-only`, `apply`, and a new process reporting `0.42.0`.

Full release notes: https://docs.nextclaw.io/en/notes/2026-08-21-nextclaw-v0-42-0
