## English Version

NextClaw Desktop `0.0.234` brings the stable `0.27.5` runtime to the desktop channel, with per-runtime model memory, stronger message continuity, steadier long conversations, and more resilient Remote connections.

- Desktop shell version: `0.0.234`
- Runtime bundle version: `0.27.5`
- Minimum launcher version: `0.0.141`

### Highlights

- New chats remember the model most recently selected for each Agent Runtime and restore it when that runtime is selected again.
- Sent and queued messages remain visible and ordered across navigation, refreshes, and realtime reconnects.
- Manual context compaction now provides immediate progress feedback and clears it when the request finishes.
- Long-chat scrolling better preserves the reading position while replies stream, history loads, or rich content resizes.
- Remote instances keep stable identities and domains, expose correlated connection diagnostics, and recover automatically from temporary outages.
- Mobile navigation can open Panel Apps directly, while targeted text and Markdown previews retain the complete file below the preview limit.

### Desktop Availability

- macOS Apple Silicon and Intel DMG builds are included.
- Windows x64 installer and x64/arm64 portable packages are included.
- Linux x64 AppImage, `.deb`, and stable APT repository packages are included.
- Stable desktop manifests point to the public `0.27.5` release note: https://docs.nextclaw.io/en/notes/2026-07-28-nextclaw-v0-27-5

### Verification

- `nextclaw@0.27.5` was published and verified from the npm registry, including the current embedded UI payload.
- A public runtime update smoke confirmed `nextclaw@0.27.4` discovers, downloads, verifies, and applies stable `0.27.5`.
- The desktop release gate verifies the packaged update key, isolated GUI startup, renderer readiness, runtime health, cross-platform installers, signed update manifests, stable update channels, and the Linux APT repository.

### Install Notes

- No configuration, session, or file migration is required.
- The desktop update compatibility floor remains launcher `0.0.141` and newer.
- These desktop builds are unsigned at the operating-system level. On macOS, if the first launch is blocked, click **Done**, then open **System Settings → Privacy & Security → Open Anyway**. On Windows, use **More info → Run anyway** if SmartScreen appears.

**Full Changelog**: https://github.com/Peiiii/nextclaw/compare/v0.26.0-desktop.1...v0.27.5-desktop.1

## 中文版

NextClaw Desktop `0.0.234` 将稳定版 `0.27.5` runtime 带到桌面端正式通道，新增按 Agent Runtime 记忆模型，并增强消息连续性、长会话阅读稳定性和 Remote 连接恢复能力。

- 桌面壳版本：`0.0.234`
- Runtime bundle 版本：`0.27.5`
- 最低 launcher 版本：`0.0.141`

### 亮点

- 全新会话会记住每个 Agent Runtime 最近选择的模型，并在再次选择该 Runtime 时恢复。
- 已发送和排队消息在页面跳转、刷新与实时连接恢复后仍保持可见、顺序一致。
- 手动压缩上下文后会立即显示进度，并在请求完成后正确清理状态。
- 回复流式生成、历史加载或富内容改变高度时，长会话会更稳定地保持当前阅读位置。
- Remote 实例会保持稳定身份和域名，提供可串联的连接诊断，并在临时故障后自动恢复。
- 移动端导航可以直接打开 Panel App；定位到指定行的文本和 Markdown 预览也会在限制内保留完整文件。

### 桌面端发布范围

- macOS Apple Silicon 和 Intel DMG 均包含在本次发布中。
- Windows x64 安装包，以及 x64/arm64 portable 包均包含在本次发布中。
- Linux x64 AppImage、`.deb` 和 stable APT 仓库包均包含在本次发布中。
- 桌面端 stable manifest 指向公开的 `0.27.5` 更新说明：https://docs.nextclaw.io/zh/notes/2026-07-28-nextclaw-v0-27-5

### 验证

- `nextclaw@0.27.5` 已发布到 NPM 并完成 registry 验证，其中包含当前 UI 载荷。
- 公开 runtime 更新冒烟确认 `nextclaw@0.27.4` 可以发现、下载、验签并应用 stable `0.27.5`。
- 桌面发布门会验证安装包内更新公钥、隔离 GUI 启动、renderer 就绪、runtime 健康、跨平台安装包、签名更新 manifest、stable 更新通道和 Linux APT 仓库。

### 安装说明

- 无需迁移配置、会话或文件。
- 桌面更新兼容性最低版本继续保持 launcher `0.0.141` 及以上。
- 本次桌面构建未做操作系统平台代码签名。macOS 首次打开如果被拦截，请先点“完成”，再进入“系统设置 → 隐私与安全性 → 仍要打开”；Windows 如果出现 SmartScreen，请选择“更多信息 → 仍要运行”。

**完整变更**: https://github.com/Peiiii/nextclaw/compare/v0.26.0-desktop.1...v0.27.5-desktop.1
