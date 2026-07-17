## English Version

NextClaw Desktop `0.0.223` ships the stable `0.25.0` runtime bundle to the desktop release channel. This is a larger desktop update than the version number alone suggests: it carries the user-facing work from the recent `0.23.0`, `0.24.0`, and `0.25.0` runtime releases into the installable macOS, Windows, and Linux apps.

Desktop shell version: `0.0.223`
Runtime bundle version: `0.25.0`
Minimum launcher version: `0.0.141`

### Highlights

- Projects are now first-class workspace objects. You can create a project before it has sessions, choose a server-side directory, and start new tasks directly from that project context.
- The chat composer can reference files and directories from the current project. Directory navigation, project-wide search, and compact sent tokens make local material easier to hand to an Agent.
- Chat results are more visual and continuous: Mermaid diagrams, HTML previews, file previews, attachments, tool results, and inline content expansion stay in the task flow with fewer flashes or layout jumps.
- The desktop app keeps checking for updates while it is running, including after the window regains focus or the system resumes, while still respecting the automatic-update preference.
- Marketplace skills are more robust, including reusable Skin Studio resources, better recent-update ordering, safer catalog refreshes, and compatibility with older install records.
- Context compaction, narrow-screen session navigation, selected-model continuity, and file-preview routing are steadier across longer work sessions.

### Desktop Availability

- macOS Apple Silicon and Intel DMG builds are published.
- Windows x64 installer and portable package are published.
- Linux x64 AppImage, `.deb`, and stable APT repository entries are published.
- Stable desktop update manifests point to the public `0.25.0` release notes at `https://docs.nextclaw.io/en/notes/2026-07-17-nextclaw-v0-25-0`.

### Verification

- `nextclaw@0.25.0` and the affected public workspace packages have been published to npm and verified from the registry.
- A clean temporary install confirmed `nextclaw --version` reports `0.25.0`.
- An old npm install of `nextclaw@0.24.0` confirmed `nextclaw update --check` reports `Runtime update available: 0.24.0 -> 0.25.0`.
- Stable runtime manifests for darwin arm64, darwin x64, linux x64, and win32 x64 report `latestVersion=0.25.0` and the expected release note URL.
- The desktop release workflow builds and verifies cross-platform installers, update bundles, stable update manifests, and the Linux APT repository before closure.

### Notes

- No manual migration is required.
- Advanced users can experiment with `ui-inject.js` for local interface customization, but this hook does not provide security, DOM stability, or cross-version compatibility guarantees.
- The desktop update floor remains compatible with launcher `0.0.141` and newer.

**Full Changelog**: https://github.com/Peiiii/nextclaw/compare/v0.22.4-desktop.1...v0.25.0-desktop.1

## 中文版

NextClaw Desktop `0.0.223` 将稳定版 `0.25.0` runtime bundle 发布到桌面端正式通道。这次桌面更新比单个版本号看起来更大：它把最近 `0.23.0`、`0.24.0` 和 `0.25.0` 的用户可见能力，一并带到 macOS、Windows 和 Linux 的可安装应用里。

桌面壳版本：`0.0.223`
Runtime bundle 版本：`0.25.0`
最低 launcher 版本：`0.0.141`

### 亮点

- 项目现在是更独立的工作区对象。你可以在还没有会话时创建项目，选择服务端目录，并从项目上下文直接开始新任务。
- 聊天输入框可以引用当前项目里的文件和目录。目录导航、项目范围搜索和发送后的紧凑标签，让本地材料更容易交给 Agent。
- 聊天结果更像连续的工作台内容：Mermaid 图、HTML 预览、文件预览、附件、工具结果和内联展开更稳定地留在同一个任务流里，减少源码闪现和布局跳动。
- 桌面端运行期间会继续判断是否需要检查更新，并在窗口重新获得焦点或系统恢复后补查，同时仍尊重自动检查开关。
- Marketplace 技能体验更稳，包括 Skin Studio 资源、最近更新排序、目录刷新、总数表达，以及历史安装记录兼容性。
- 上下文压缩、窄屏会话导航、当前会话模型连续性和文件预览路由在长任务中更稳定。

### 桌面端发布范围

- macOS Apple Silicon 和 Intel DMG 已发布。
- Windows x64 安装包和 portable 包已发布。
- Linux x64 AppImage、`.deb` 和 stable APT 仓库条目已发布。
- 桌面端 stable 更新 manifest 指向公开的 `0.25.0` 更新笔记：`https://docs.nextclaw.io/zh/notes/2026-07-17-nextclaw-v0-25-0`。

### 验证

- `nextclaw@0.25.0` 以及受影响的 public workspace 包已发布到 npm，并完成 registry 验证。
- 干净临时安装确认 `nextclaw --version` 输出 `0.25.0`。
- 旧版 npm 安装态 `nextclaw@0.24.0` 已确认 `nextclaw update --check` 输出 `Runtime update available: 0.24.0 -> 0.25.0`。
- darwin arm64、darwin x64、linux x64 和 win32 x64 的 stable runtime manifest 均返回 `latestVersion=0.25.0`，并指向预期 release note URL。
- 桌面 release workflow 会在闭环前构建并验证跨平台安装包、更新包、stable 更新 manifest 和 Linux APT 仓库。

### 说明

- 本版本不需要手动迁移。
- 高级用户可以尝试 `ui-inject.js` 做本地界面自定义，但该实验能力不承诺安全性、DOM 稳定性或跨版本兼容性。
- 桌面更新最低 launcher 版本继续兼容 `0.0.141` 及以上。

**完整变更**: https://github.com/Peiiii/nextclaw/compare/v0.22.4-desktop.1...v0.25.0-desktop.1
