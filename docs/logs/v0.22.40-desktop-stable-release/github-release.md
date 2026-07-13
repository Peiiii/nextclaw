## English Version

NextClaw v0.22.4 desktop stable release brings the verified 0.22.4 runtime bundle to the desktop stable channel. This release focuses on a calmer chat workspace, stronger file previews, and refreshed public product assets.

Desktop shell version: `0.0.220`
Runtime bundle version: `0.22.4`
Minimum launcher version: `0.0.141`

### Highlights

- The chat workspace now has a dedicated session workspace sidebar for browsing and opening task files without leaving the conversation.
- Chat messages default to a flatter layout, making long task threads easier to scan.
- Local file previews use a unified visual treatment across workspace, attachments, and message surfaces.
- The npm package, GitHub README, product screenshots, and community entry points now share the refreshed public-facing product assets.

### Verification

- `nextclaw@0.22.4` and the affected public workspace packages have been published to npm and verified from the registry.
- A real global-install smoke test confirmed `nextclaw --version` reports `0.22.4` and `nextclaw update --check --json` returns `up-to-date`.
- Local macOS packaging verification passed for the `0.0.220` desktop shell with seed runtime `0.22.4`.
- The stable desktop release workflow publishes macOS, Windows, and Linux installers, Windows portable packages, stable update manifests, update bundles, and the stable Linux APT package.

### Notes

- No manual migration is required.
- The minimum stable launcher version remains `0.0.141`.

**Full Changelog**: https://github.com/Peiiii/nextclaw/compare/v0.22.3-desktop.8...v0.22.4-desktop.1

## 中文版

NextClaw v0.22.4 桌面端正式版将已验证的 0.22.4 runtime bundle 推进到桌面端 stable 通道。本版本重点改进聊天工作台、文件预览一致性，并同步刷新对外产品资产。

桌面壳版本：`0.0.220`
Runtime bundle 版本：`0.22.4`
最低 launcher 版本：`0.0.141`

### 亮点

- 聊天工作台新增会话工作区侧栏，可以在当前任务里浏览和打开相关文件，不必离开对话。
- 聊天消息默认使用更扁平的布局，长任务线程更容易扫读。
- 本地文件预览在工作区、附件和消息表面采用统一视觉表达。
- npm 包、GitHub README、产品截图和社群入口同步到最新对外产品资产。

### 验证

- `nextclaw@0.22.4` 以及受影响的 public workspace 包已发布到 npm，并完成 registry 验证。
- 真实全局安装冒烟确认 `nextclaw --version` 输出 `0.22.4`，`nextclaw update --check --json` 返回 `up-to-date`。
- 本地 macOS 打包验证通过，桌面壳版本为 `0.0.220`，seed runtime 为 `0.22.4`。
- stable 桌面发布 workflow 会发布 macOS、Windows、Linux 安装包、Windows portable 包、stable 更新 manifest、更新包，以及 stable Linux APT 包。

### 说明

- 本版本不需要手动迁移。
- stable 最低 launcher 版本保持 `0.0.141`。

**完整变更**: https://github.com/Peiiii/nextclaw/compare/v0.22.3-desktop.8...v0.22.4-desktop.1
