# v0.25.0 NPM and Desktop Release

## 迭代完成说明

本迭代用于发布 `nextclaw` 的 `0.24.0 -> 0.25.0` npm stable minor 版本，并在 NPM 发布闭环完成后发布桌面端 stable release。

本次桌面端发布频率低于 NPM 发布，因此桌面 release note 聚合了 `0.22.4` 之后进入桌面端的主要用户可见变化：

- 项目成为独立工作区对象，支持项目模板、服务端目录选择和从项目上下文启动新任务。
- 聊天输入框支持当前项目文件/目录引用，目录导航、项目搜索和发送后紧凑标签更自然。
- Mermaid、HTML 预览、文件预览、附件和工具结果在聊天中呈现更稳定，减少源码闪现和布局跳动。
- 桌面端运行期间继续检查更新，窗口重新聚焦或系统恢复后会补查，同时尊重自动更新开关。
- Marketplace 技能、Skin Studio 资源、目录刷新和历史安装记录兼容性更稳定。
- 上下文压缩、窄屏会话导航、模型连续性和文件预览路由更可靠。

配图判断：

- 本次 NPM release note 配图，使用 `nextclaw-v0.25.0-inline-results.png` 展示聊天中直接呈现结构化结果，符合“确实可见、有展示效果、有宣传价值”的配图门槛。
- desktop GitHub release 不额外内嵌新图；桌面端低频发布的重点是下载资产、更新通道和跨平台验证，正文用更丰富的文字聚合最近多个 runtime 版本的桌面可见变化。

## 测试/验证/验收方式

已完成：

- `pnpm release:version`：生成 `0.25.0` package 版本、changelog 和 workspace 依赖版本。
- `pnpm --filter @nextclaw/docs build`：通过，确认文档站可构建并生成包含 v0.25.0 note 的 project pulse 数据。
- `pnpm release:check -- --reset`：通过；期间补跑 `pnpm --filter nextclaw... build` 生成发布包依赖闭包。
- `git push origin codex/release-npm-minor-0.25.0`：已推送隔离 release 分支。
- `git push origin <本批 npm package tags>`：已推送本批 10 个 package tag。
- `pnpm release:publish`：通过，`release:verify:published` 确认 `10/10` 个 public package versions 已发布。
- `npm view nextclaw version dist-tags dependencies --json`：确认 `latest=0.25.0`，并确认主包依赖指向本批 workspace 版本。
- `npm pack nextclaw@0.25.0`：确认 tarball 包含 `dist/cli/launcher/index.js`、`dist/cli/app/index.js`、`resources/update-bundle-public.pem` 与 `ui-dist/index.html`。
- `npm install --prefix <temp> nextclaw@0.25.0` + `nextclaw --version`：通过，返回 `0.25.0`。
- `pnpm deploy:docs:global`：通过，Cloudflare Pages deployment 为 `https://babe7d2a.nextclaw-docs.pages.dev`。
- `curl https://docs.nextclaw.io/zh/notes/2026-07-17-nextclaw-v0-25-0` 与英文页面：确认文档站更新笔记公开可访问。
- `curl https://docs.nextclaw.io/release-notes/nextclaw-v0.25.0.json`：确认结构化 release notes 公开可访问。
- `curl https://docs.nextclaw.io/release-notes/nextclaw-v0.25.0-inline-results.png`：确认截图资产公开可访问。
- `pnpm release:stable:runtime -- --version 0.25.0 --release-tag nextclaw@0.25.0 --branch codex/release-npm-minor-0.25.0`：通过，workflow `29547943124` 完成，runtime release 为 `https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.25.0`。
- `curl https://peiiii.github.io/nextclaw/npm-runtime-updates/stable/manifest-stable-*.json`：确认 darwin arm64、darwin x64、linux x64、win32 x64 的 `latestVersion=0.25.0`，且 `releaseNotesUrl=https://docs.nextclaw.io/en/notes/2026-07-17-nextclaw-v0-25-0`。
- `npm install --prefix <temp> nextclaw@0.24.0` + `nextclaw update --check`：通过，输出 `Runtime update available: 0.24.0 -> 0.25.0`。

待完成：

- 桌面端 stable release workflow。
- 官网下载 fallback 更新与部署。
- minor+ X 帖子闭环。

验证备注：

- GitHub Actions 输出 Node.js 20 deprecated annotation，来源于 action runtime 提示，不影响本次 runtime 发布结果。
- npm 安装输出若干既有 transitive dependency deprecated warning，不影响 `nextclaw@0.25.0` 安装和更新检查。

## 发布/部署方式

本次发布路径：

1. 从 `codex/release-npm-minor-0.24.0` 创建隔离 release worktree，避免主工作区 WIP 进入发布。
2. 合并 `origin/master` 和本地已提交 `master` 的新变更，解决 release 分支冲突。
3. 添加 minor changeset 并执行 `pnpm release:version`。
4. 补齐文档站中英文 notes、结构化 JSON、截图资产和发布记录。
5. 执行 docs / release 验证。
6. 提交 release commit `9452444b6c9bad348daad5d62a34bdbeab03594b`。
7. 执行 `pnpm release:publish` 发布 npm public packages。
8. 部署 docs site，让 HTML notes、结构化 JSON 和截图资产公开可访问。
9. 执行 stable runtime update 发布，确保 NPM 安装用户能看到可用更新和 release note 链接。
10. 执行桌面端 stable release，并更新官网下载链接。

## 用户/产品视角的验收步骤

用户可从这些入口确认本次 NPM 发布：

- NPM：`npm view nextclaw version` 返回 `0.25.0`。
- 文档站中文更新笔记：`https://docs.nextclaw.io/zh/notes/2026-07-17-nextclaw-v0-25-0`。
- 文档站英文更新笔记：`https://docs.nextclaw.io/en/notes/2026-07-17-nextclaw-v0-25-0`。
- 结构化更新说明：`https://docs.nextclaw.io/release-notes/nextclaw-v0.25.0.json`。
- 截图资产：`https://docs.nextclaw.io/release-notes/nextclaw-v0.25.0-inline-results.png`。
- NPM 安装态用户：`nextclaw@0.24.0` 可通过 stable runtime update channel 看到 `0.25.0` 更新。

桌面端验收入口将在 desktop stable release 完成后补齐。

## 可维护性总结汇总

本次主要改动是发布元数据、版本文件、文档站内容、截图资产、生成数据和发布留痕。

- 干净实现原则：复用既有 changeset、docs notes、release notes JSON、runtime update 和 desktop release guard，不新增平行发布机制。
- 用户可见内容边界：文档站更新笔记只写用户可感知结果，不写内部治理过程；desktop release note 聚合低频桌面端用户真正会感知到的变化。
- 配图原则：只为有真实展示效果和传播价值的可见功能配图；本次截图展示聊天内结构化结果，符合配图门槛。
- 隔离发布原则：主工作区存在无关 WIP，本次使用 `/private/tmp/nextclaw-release-0.25.0` 隔离发布，避免把半成品带进 npm 或 desktop release。

## NPM 包发布记录

发布类型：stable NPM minor release。

目标主包：

- `nextclaw@0.25.0`：minor，已发布。

本批 public workspace packages：

- `@nextclaw/agent-chat-ui@0.6.7`：已发布。
- `@nextclaw/client-sdk@0.5.7`：已发布。
- `@nextclaw/companion@0.2.7`：已发布。
- `@nextclaw/kernel@0.6.7`：已发布。
- `@nextclaw/ncp-react@0.5.6`：已发布。
- `@nextclaw/remote@0.3.7`：已发布。
- `@nextclaw/server@0.15.7`：已发布。
- `@nextclaw/service@0.3.7`：已发布。
- `@nextclaw/ui@0.15.7`：已发布。

私有版本元数据：

- `@nextclaw/desktop@0.0.223`：private，不发布 npm；将用于 desktop stable release。
