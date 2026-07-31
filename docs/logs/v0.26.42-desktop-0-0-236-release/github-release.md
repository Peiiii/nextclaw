## English Version

NextClaw Desktop `0.0.236` brings runtime `0.27.7` to the stable desktop channel, adding explicit project context, more useful Agent Runtime context, richer visual responses, and stronger conversation continuity.

- Desktop shell version: `0.0.236`
- Runtime bundle version: `0.27.7`
- Minimum launcher version: `0.0.141`

### Highlights

- Reference a registered project from the chat composer’s `@` menu without changing the conversation’s working directory.
- Codex and Claude Code receive relevant NextClaw product, workspace, and skill context while preserving their native instructions.
- Panel Apps can receive structured runtime parameters, Mermaid diagrams open in a full-screen preview, and Agents use compact visualizations when they materially improve understanding.
- Codex keeps long-running commands active, preserves thread identity across real timeouts, and resolves its app-server binary correctly in packaged npm installations.
- Queued messages move cleanly into execution, while Marketplace skill uninstall and Claude/Hermes session identity boundaries are more strictly enforced.

### Desktop Availability

- macOS Apple Silicon and Intel DMG builds are included.
- Windows x64 installer and x64/arm64 portable packages are included.
- Linux x64 AppImage, `.deb`, and stable APT repository packages are included.
- Stable desktop manifests point to the public `0.27.7` release note: https://docs.nextclaw.io/en/notes/2026-07-29-nextclaw-v0-27-7

### Verification

- The release gate verifies the packaged update key, isolated GUI startup, renderer readiness, runtime health, cross-platform installers, signed update manifests, stable update channels, and the Linux APT repository.
- Stable update manifests are verified against runtime `0.27.7`, minimum launcher `0.0.141`, and the public release note URL.
- No configuration, session, or file migration is required.

### Install Notes

- These desktop builds are unsigned at the operating-system level. On macOS, if the first launch is blocked, click **Done**, then open **System Settings → Privacy & Security → Open Anyway**. On Windows, use **More info → Run anyway** if SmartScreen appears.

**Full Changelog**: https://github.com/Peiiii/nextclaw/compare/v0.27.5-desktop.1...v0.27.7-desktop.1

## 中文版

NextClaw Desktop `0.0.236` 将 runtime `0.27.7` 带到桌面端 stable 通道，新增显式项目上下文、更有用的 Agent Runtime 上下文和更丰富的视觉结果，并增强会话连续性。

- 桌面壳版本：`0.0.236`
- Runtime bundle 版本：`0.27.7`
- 最低 launcher 版本：`0.0.141`

### 亮点

- 可以从聊天输入框的 `@` 菜单引用已登记项目，而不改变当前会话工作目录。
- Codex 与 Claude Code 会在保留原生指令的同时，获得相关的 NextClaw 产品、工作区和 skill 上下文。
- Panel App 可以接收结构化运行参数，Mermaid 图表支持全屏查看，Agent 也会在确实有助于理解时使用紧凑可视化。
- Codex 会把持续输出的长命令视为活跃，在真实超时后保留 thread 身份，并在 NPM 安装产物中正确解析 app-server binary。
- 排队消息会清晰进入执行阶段；Marketplace skill 卸载边界以及 Claude/Hermes session identity 约束也更严格。

### 桌面端发布范围

- macOS Apple Silicon 和 Intel DMG 均包含在本次发布中。
- Windows x64 安装包，以及 x64/arm64 portable 包均包含在本次发布中。
- Linux x64 AppImage、`.deb` 和 stable APT 仓库包均包含在本次发布中。
- 桌面端 stable manifest 指向公开的 `0.27.7` 更新说明：https://docs.nextclaw.io/zh/notes/2026-07-29-nextclaw-v0-27-7

### 验证

- 发布门会验证安装包内更新公钥、隔离 GUI 启动、renderer 就绪、runtime 健康、跨平台安装包、签名更新 manifest、stable 更新通道和 Linux APT 仓库。
- stable 更新 manifest 会核对 runtime `0.27.7`、最低 launcher `0.0.141` 与公开更新说明 URL。
- 本次更新不需要迁移配置、会话或文件。

### 安装说明

- 本次桌面构建未做操作系统平台代码签名。macOS 首次打开如果被拦截，请先点“完成”，再进入“系统设置 → 隐私与安全性 → 仍要打开”；Windows 如果出现 SmartScreen，请选择“更多信息 → 仍要运行”。

**完整变更**: https://github.com/Peiiii/nextclaw/compare/v0.27.5-desktop.1...v0.27.7-desktop.1
