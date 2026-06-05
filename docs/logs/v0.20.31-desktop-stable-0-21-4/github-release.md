## English Version

NextClaw Desktop 0.0.207 promotes the verified 0.21.4 runtime line to the stable desktop channel.

Launcher version: `0.0.207`
Bundle version: `0.21.4`

### Highlights
- Promotes the new app-facing Panel App client surface to stable, including standard Agent Runs APIs and clearer realtime event guidance.
- Includes the PWA runtime cache recovery work so browser-hosted runtime pages no longer get stuck on stale chunks or reload loops.
- Ships refreshed built-in channel extensions and runtime packages from the 0.21.4 line.
- Keeps the stable desktop launcher compatibility floor at `0.0.141`.

### Validation Summary
- The candidate was first published and closed as beta preview `v0.21.4-beta.1-desktop-beta.1`.
- The stable desktop release workflow builds macOS, Windows, and Linux installers, update bundles, manifests, and the Linux APT repo.
- Installer/update validation covers packaged public-key material, update manifest signatures, Electron-bundled runtime boot, GUI smoke, command surface smoke, release assets, stable update manifests, public Pages propagation, and stable APT publishing.

### Notes
- macOS builds are unsigned; first launch may require opening from Privacy & Security.
- The stable update channel remains separate from the beta channel.

**Full Changelog**: https://github.com/Peiiii/nextclaw/compare/v0.20.5-desktop.1...v0.21.4-desktop.1

## 中文版

NextClaw Desktop 0.0.207 将已验证的 0.21.4 runtime 线提升到桌面端正式稳定通道。

Launcher 版本：`0.0.207`
Bundle 版本：`0.21.4`

### 亮点
- 将新的 Panel App app-facing client 能力提升到 stable，包括标准 Agent Runs API 与更清晰的实时事件使用口径。
- 包含 PWA runtime cache recovery，避免浏览器形态运行时页面卡在旧 chunk 或反复 reload。
- 随 0.21.4 线刷新内置渠道扩展与运行时包。
- stable 桌面 launcher 兼容 floor 保持为 `0.0.141`。

### 验证摘要
- 候选版本已先通过 beta preview `v0.21.4-beta.1-desktop-beta.1` 发布闭环验证。
- stable desktop release workflow 会构建 macOS、Windows、Linux 安装包、更新包、manifest 与 Linux APT 仓库。
- 安装/更新验证覆盖包内公钥材料、update manifest 签名、Electron 内置 runtime 启动、GUI smoke、command surface smoke、release assets、stable update manifest、公开 Pages 传播与 stable APT 发布。

### 说明
- macOS 构建仍是 unsigned，首次打开可能需要在 Privacy & Security 中手动允许。
- stable 更新通道与 beta 更新通道保持分离。

**完整变更**: https://github.com/Peiiii/nextclaw/compare/v0.20.5-desktop.1...v0.21.4-desktop.1
