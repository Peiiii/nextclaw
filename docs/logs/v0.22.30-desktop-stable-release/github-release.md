## English Version

NextClaw v0.22.3 desktop stable release brings the verified 0.22.3 runtime bundle to the desktop stable channel. This release focuses on a cleaner work surface, stronger workspace previews, better chat attachment inspection, and more predictable runtime model behavior.

Desktop shell version: `0.0.219`
Runtime bundle version: `0.22.3`
Minimum launcher version: `0.0.141`

### Highlights

- Chat file attachments can open directly in the workspace preview, so project files stay inside the current task instead of opening a separate browser tab.
- Message images can open in a fullscreen lightbox for inspecting screenshots, design references, generated images, and visual tool output.
- The workspace side panel can browse directories, refresh file previews, and maximize inside the conversation area.
- Claude Code sessions now support `Runtime default`, allowing Claude Code to use its own configured authentication and default model.

### Enhancements

- The default theme uses a brighter workspace style with more consistent sidebar, navigation, message bubble, and marketplace surfaces.
- Chat input controls keep model selection, thinking, context window, and send actions in a tighter row.
- The sidebar supports pinned sessions and projects, with expandable project folder rows for faster navigation.
- Tool activity rows are more compact and show clearer status for reasoning, tool calls, file work, and directory work.
- Chinese and mainland-timezone users are routed to the domestic docs mirror by default, with environment-based fallback to the global docs site.

### Fixes

- Codex runtime no longer tends to return empty responses with the newer runtime default model setup.
- Marketplace skill detail pages restore their document content after browser refreshes.
- Incomplete OpenAI Responses streams are treated as failed runs instead of successful partial answers.
- Transient native model stream failures retry with visible retry metadata and backoff.
- Focused Panel App iframes keep keyboard input, so interactive apps can respond to key presses.

### Notes

- Full human-readable notes are available in the docs: [v0.22.3 English](https://docs.nextclaw.io/en/notes/2026-07-13-nextclaw-v0-22-3), [v0.22.3 Chinese](https://docs.nextclaw.io/zh/notes/2026-07-13-nextclaw-v0-22-3), [v0.22.2 English](https://docs.nextclaw.io/en/notes/2026-07-12-nextclaw-v0-22-2), and [v0.22.2 Chinese](https://docs.nextclaw.io/zh/notes/2026-07-12-nextclaw-v0-22-2).
- Structured release note data is available at [nextclaw-v0.22.3.json](https://docs.nextclaw.io/release-notes/nextclaw-v0.22.3.json).
- This release publishes macOS, Windows, and Linux installers, Windows portable packages, stable update manifests, update bundles, and the Linux APT package for the stable channel.
- No manual migration is required.

**Full Changelog**: https://github.com/Peiiii/nextclaw/compare/v0.22.1-desktop.1...v0.22.3-desktop.8

## 中文版

NextClaw v0.22.3 桌面端正式版将已验证的 0.22.3 runtime bundle 推进到桌面端 stable 通道。本版本重点改进工作台界面、工作区预览、聊天附件查看，以及 runtime 模型选择的兼容性。

桌面壳版本：`0.0.219`
Runtime bundle 版本：`0.22.3`
最低 launcher 版本：`0.0.141`

### 亮点

- 聊天里的文件附件可以直接打开到工作区预览，项目材料留在当前任务里，不必跳到新的浏览器标签页。
- 消息图片支持全屏灯箱查看，适合放大检查截图、设计参考、生成图片和视觉工具输出。
- 工作区右侧面板支持目录浏览、文件刷新和局部最大化，查看项目材料时不需要离开当前会话。
- Claude Code 会话支持 `Runtime default`，可以使用 Claude Code 自己的鉴权、配置和默认模型。

### 增强

- 默认主题切换为更明亮的工作台样式，侧栏、导航、消息气泡和 marketplace 区域的视觉层次更统一。
- 聊天输入区把模型、thinking、上下文窗口和发送操作收在更紧凑的一行里。
- 侧边栏支持置顶会话和项目，项目列表可以展开为文件夹行，查找会话和项目更直接。
- 工具活动展示更紧凑，推理、工具调用、文件和目录操作会用更清晰的状态行呈现。
- 中文和大陆时区用户会优先进入国内文档镜像，仍可通过环境配置回退到全球文档站。

### 修复

- Codex runtime 在新的默认模型配置下不再容易出现空响应。
- Marketplace skill 详情页刷新后会恢复文档内容。
- OpenAI Responses 流不完整时会按失败运行处理，不再把半截回答当作成功结果。
- 原生模型流的瞬时失败会带着重试信息和退避策略重试，便于判断真实失败原因。
- Panel App iframe 获得焦点后会保留键盘输入，交互应用可以直接响应按键。

### 说明

- 完整的人类可读版本说明见 docs：[v0.22.3 中文](https://docs.nextclaw.io/zh/notes/2026-07-13-nextclaw-v0-22-3)、[v0.22.3 English](https://docs.nextclaw.io/en/notes/2026-07-13-nextclaw-v0-22-3)、[v0.22.2 中文](https://docs.nextclaw.io/zh/notes/2026-07-12-nextclaw-v0-22-2) 和 [v0.22.2 English](https://docs.nextclaw.io/en/notes/2026-07-12-nextclaw-v0-22-2)。
- 结构化版本说明数据见 [nextclaw-v0.22.3.json](https://docs.nextclaw.io/release-notes/nextclaw-v0.22.3.json)。
- 本次发布包含 macOS、Windows、Linux 安装包、Windows portable 包、stable 更新 manifest、更新包，以及 stable Linux APT 包。
- 本版本不需要手动迁移。

**完整变更**: https://github.com/Peiiii/nextclaw/compare/v0.22.1-desktop.1...v0.22.3-desktop.8
