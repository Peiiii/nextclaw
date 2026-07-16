# v0.24.0 NPM Minor Release

## 迭代完成说明

本迭代用于发布 `nextclaw` 的 `0.23.0 -> 0.24.0` npm stable minor 版本，并补齐对应文档站产品更新笔记、结构化 release notes JSON 和可见功能截图。

本次用户可见变化聚合为：

- 独立项目：项目可以在没有会话时创建、展示和作为新任务入口。
- 项目模板：新建项目支持空项目和知识库模板。
- 目录选择：新建项目时可以浏览运行 NextClaw 服务的机器上的目录，并使用常用位置、地址导航、搜索、新建文件夹、单击选择和双击进入。
- 项目引用：聊天输入框支持通过 `@` 引用当前项目中的文件或目录，发送时补充受限、可控的项目上下文。
- 更新体验：运行时更新检查、下载和版本切换状态更连贯，当前版本和可用更新都能进入对应 release note。

配图判断：

- 本次配图，因为“新建项目选择服务端目录”是明显可见的新功能，截图能帮助用户理解项目目录选择和服务端路径语义。
- 截图使用 `/tmp/nextclaw-release-note-demo` 演示目录，避免公开真实用户目录和私人文件名。

## 测试/验证/验收方式

发布前已完成：

- `pnpm release:report:health`：确认 registry 状态干净，当前 `nextclaw@latest` 为 `0.23.0`。
- `npm view nextclaw version dist-tags --json`：确认发布前 npm `latest` 为 `0.23.0`。
- `pnpm install`：安装发布隔离 worktree 依赖。
- `pnpm release:version`：生成 `0.24.0` package 版本与 changelog。
- Playwright 截图：在本地源码运行实例中打开真实 UI，生成 `nextclaw-v0.24.0-project-workflow.png`。
- `node -e "JSON.parse(...nextclaw-v0.24.0.json)"`：确认结构化 release notes JSON 可解析。
- `pnpm docs:i18n:check`：通过，确认中英文 notes 镜像完整。
- `pnpm --filter @nextclaw/docs build`：通过，确认文档站可构建并生成包含 v0.24.0 note 的 project pulse 数据。
- `pnpm release:check`：通过，确认本批发布包 build / tsc 成功；输出仅有既有第三方依赖、Browserslist 和 chunk size warning。

发布闭环仍需完成并在本记录补充：

- `pnpm release:publish`。
- npm registry 发布验证。
- stable runtime update channel 发布和 manifest 验证。
- docs site 部署与公开 URL 验证。
- 临时 NPM 安装和更新检查冒烟。

## 发布/部署方式

本次发布路径：

1. 从已提交的 `master` / `origin/master` 创建隔离发布 worktree，排除主工作区未完成 WIP。
2. 将本批 `nextclaw` 产品变化标记为 minor。
3. 补齐文档站中英文 notes、结构化 JSON、截图资产和本发布记录。
4. 执行 docs / release 验证。
5. 提交 release commit。
6. 执行 `pnpm release:publish` 发布 npm public packages。
7. 执行 stable runtime update 发布，确保 NPM 安装用户能看到可用更新和 release note 链接。
8. 部署 docs site，让 HTML notes、结构化 JSON 和截图资产公开可访问。

## 用户/产品视角的验收步骤

用户可从这些入口确认本次发布：

- NPM：`npm view nextclaw version` 返回 `0.24.0`。
- 文档站中文更新笔记：`https://docs.nextclaw.io/zh/notes/2026-07-16-nextclaw-v0-24-0`。
- 文档站英文更新笔记：`https://docs.nextclaw.io/en/notes/2026-07-16-nextclaw-v0-24-0`。
- 结构化更新说明：`https://docs.nextclaw.io/release-notes/nextclaw-v0.24.0.json`。
- 截图资产：`https://docs.nextclaw.io/release-notes/nextclaw-v0.24.0-project-workflow.png`。
- NPM 安装态用户：旧版本应通过 stable runtime update channel 看到 `0.24.0` 更新说明或可重新安装 `nextclaw@latest`。

## 可维护性总结汇总

本次主要改动是发布元数据、版本文件、文档站内容、截图资产和发布留痕。

- 干净实现原则：复用既有 changeset、docs notes、release notes JSON、runtime update 和 release guard，不新增平行发布机制。
- 用户可见内容边界：文档站更新笔记只写用户可感知结果，不写内部治理过程。
- 配图原则：只为有真实展示效果和传播价值的可见功能配图；本次截图展示项目目录选择能力，符合配图门槛。
- 隔离发布原则：主工作区存在无关 WIP，本次从已提交的 `master` 创建隔离 worktree 发布，避免把半成品带进 npm。

## NPM 包发布记录

发布类型：stable NPM minor release。

目标主包：

- `nextclaw@0.24.0`：minor，待发布。

本批 public workspace packages 状态会在 `pnpm release:publish` 完成后补充。
