## English Version

NextClaw Desktop `0.0.227` brings the stable `0.26.0` runtime to the desktop channel, with smoother long conversations, a scheduled task workbench, richer AI response details, and a built-in Agent Browser.

Desktop shell version: `0.0.227`  
Runtime bundle version: `0.26.0`  
Minimum launcher version: `0.0.141`

### Highlights

- Long conversations now use a dynamic-height virtual timeline, load earlier messages on demand, and preserve reading position while rich content resizes.
- The scheduled task workbench adds natural-language creation, reusable templates, search, filters, pagination, and direct task-session navigation.
- A built-in Agent Browser lets Agents visit pages and research information when a configured search service is unavailable.
- AI responses can show the runtime, model, and token usage actually used for each run.
- HTML, Panel App, Mermaid, table, image, and mixed-response output remains steadier after streaming completes.
- Update checks run immediately after every start and continue every two hours while the app is running; checks do not download or apply updates automatically.

### Desktop Availability

- macOS Apple Silicon and Intel DMG builds are included.
- Windows x64 installer and x64/arm64 portable packages are included.
- Linux x64 AppImage, `.deb`, and stable APT repository packages are included.
- Stable desktop manifests point to the public `0.26.0` release note: https://docs.nextclaw.io/en/notes/2026-07-18-nextclaw-v0-26-0

### Verification

- `nextclaw@0.26.0` and all 49 public workspace package versions were published and verified from the npm registry.
- A clean registry install confirmed the CLI reports `0.26.0` and includes the runtime update public key and UI payload.
- A public update smoke confirmed `nextclaw@0.25.3` discovers, downloads, and applies the stable `0.26.0` runtime.
- The desktop release gate verifies the packaged update key, isolated GUI startup, renderer readiness, runtime health, cross-platform installers, signed manifests, stable update channels, and the Linux APT repository.

### Install Notes

- No configuration migration is required.
- The desktop update compatibility floor remains launcher `0.0.141` and newer.
- These desktop builds are unsigned. On macOS, if the first launch is blocked, click **Done**, then open **System Settings → Privacy & Security → Open Anyway**. On Windows, use **More info → Run anyway** if SmartScreen appears.

**Full Changelog**: https://github.com/Peiiii/nextclaw/compare/v0.25.0-desktop.1...v0.26.0-desktop.1

## 中文版

NextClaw Desktop `0.0.227` 将稳定版 `0.26.0` runtime 带到桌面端正式通道，让长会话、定时任务、AI 回复运行信息和内置 Agent Browser 都能直接在桌面应用中使用。

桌面壳版本：`0.0.227`  
Runtime bundle 版本：`0.26.0`  
最低 launcher 版本：`0.0.141`

### 亮点

- 长会话改用动态高度虚拟时间线，按需加载更早消息，并在富内容高度变化时保持阅读位置。
- 定时任务工作台支持自然语言创建、常用模板、搜索、筛选、分页和任务会话直接跳转。
- 内置 Agent Browser 让 Agent 在已配置搜索服务不可用时，仍能访问网页并检索资料。
- 每条 AI 回复可以显示本次实际使用的运行时、模型和 token 用量。
- HTML、Panel App、Mermaid、表格、图片和混合回复在流式结束后保持更稳定。
- 每次启动都会立即检查更新，运行期间继续每两小时检查；检查只发现新版本，不会自动下载或应用更新。

### 桌面端发布范围

- macOS Apple Silicon 和 Intel DMG 均包含在本次发布中。
- Windows x64 安装包，以及 x64/arm64 portable 包均包含在本次发布中。
- Linux x64 AppImage、`.deb` 和 stable APT 仓库包均包含在本次发布中。
- 桌面端 stable manifest 指向公开的 `0.26.0` 更新说明：https://docs.nextclaw.io/zh/notes/2026-07-18-nextclaw-v0-26-0

### 验证

- `nextclaw@0.26.0` 以及 49 个公开 workspace 包版本均已发布到 NPM，并完成 Registry 验证。
- 全新 Registry 安装确认 CLI 返回 `0.26.0`，且包含 runtime 更新公钥和 UI 载荷。
- 公开更新冒烟确认 `nextclaw@0.25.3` 可以发现、下载并应用 stable `0.26.0` runtime。
- 桌面发布门会验证安装包内更新公钥、隔离 GUI 启动、renderer 就绪、runtime 健康、跨平台安装包、签名 manifest、stable 更新通道和 Linux APT 仓库。

### 安装说明

- 无需迁移配置。
- 桌面更新兼容性最低版本继续保持 launcher `0.0.141` 及以上。
- 本次桌面构建未做平台代码签名。macOS 首次打开如果被拦截，请先点“完成”，再进入“系统设置 → 隐私与安全性 → 仍要打开”；Windows 如果出现 SmartScreen，请选择“更多信息 → 仍要运行”。

**完整变更**: https://github.com/Peiiii/nextclaw/compare/v0.25.0-desktop.1...v0.26.0-desktop.1
