# v0.23.0 NPM Minor Release

## 迭代完成说明

本迭代用于发布 `nextclaw` 的 `0.22.4 -> 0.23.0` npm stable minor 版本，并补齐对应文档站产品更新笔记。

本次用户可见变化聚合为：

- Agent 输出展示：流式 Mermaid、Markdown、内联展示、侧栏提示和用户消息复制更稳定一致。
- 项目上下文：项目 `.agents/skills` 与项目 `AGENTS.md` 会进入会话上下文，技能选择器区分项目、NextClaw、全局与内建来源。
- 会话工作区：概览之外的页面、子会话、草稿和文件标签页可以关闭并从概览重新打开。
- 本地资源预览：Markdown `file:` 链接保留真实行号，`nextclaw-inline` 文件目标复用工作台预览 HTML、Markdown、代码、图片、媒体、PDF 与 Office 文件。
- 更新诊断：版本号旁的更新异常图标会展示完整原因、诊断信息和恢复命令。

机制修正：

- `nextclaw-release-notes-automation` 明确稳定 NPM minor 发布前必须补齐文档站版本更新笔记。
- `npm-release-contract-guard` 明确稳定 `nextclaw` minor 发布必须先有文档站产品更新笔记，runtime manifest 继续要求 `releaseNotesUrl`。
- `npm-runtime-update-release` stable channel 现在从文档站结构化 release note JSON 读取 `releaseNotesUrl`，本地 stable runtime 发布脚本会同步校验公开 manifest 的 `releaseNotesUrl`。

## 测试/验证/验收方式

已完成：

- `pnpm release:report:health`：确认当前 registry 状态干净，`nextclaw@0.22.4` 是 npm `latest`。
- `npm view nextclaw version dist-tags --json`：确认发布前 npm `latest` 为 `0.22.4`。
- `node -e "JSON.parse(...nextclaw-v0.23.0.json)"`：确认结构化 release notes JSON 可解析。
- `pnpm release:version`：生成 `0.23.0` package 版本与 changelog。
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=true pnpm release:check`：通过本批发布包 build / tsc；release check 未启用 lint，输出仅有既有第三方依赖与 bundle size warning。
- `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm docs:i18n:check`：通过，确认中英文 notes 镜像完整。
- `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm --filter @nextclaw/docs build`：通过，确认文档站可构建并生成包含 v0.23.0 note 的 project pulse 数据。
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=true pnpm release:publish`：通过，`release:verify:published` 确认 `22/22` 个 public package version 已发布。
- `git push origin tag <tag>`：已推送本批 `22` 个 npm package tags。
- `npm view nextclaw version dist-tags --json`：确认发布后 `latest` 为 `0.23.0`。
- `npm --prefix <temp> install nextclaw@0.23.0 --ignore-scripts --no-audit --no-fund`：通过，临时安装包为 `nextclaw@0.23.0`。
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=true pnpm release:stable:runtime -- --version 0.23.0 --release-tag nextclaw@0.23.0`：通过，workflow `29355385854` 完成，公开 stable manifests 为 `latestVersion=0.23.0`。
- `curl https://peiiii.github.io/nextclaw/npm-runtime-updates/stable/manifest-stable-darwin-arm64.json`：确认 `releaseNotesUrl=https://docs.nextclaw.io/en/notes/2026-07-15-nextclaw-v0-23-0`。
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=true pnpm deploy:docs:global`：在临时干净 worktree 中通过，Cloudflare Pages deployment 为 `https://57c72713.nextclaw-docs.pages.dev`。
- `curl https://docs.nextclaw.io/zh/notes/2026-07-15-nextclaw-v0-23-0` 与英文页面：确认文档站更新笔记公开可访问。
- `curl https://docs.nextclaw.io/release-notes/nextclaw-v0.23.0.json`：确认结构化 release notes 在文档站公开可访问，`version=0.23.0`、`releaseType=minor`。
- `curl https://docs.nextclaw.io/release-notes/nextclaw-v0.23.0-mermaid-preview.png`：确认截图资产公开可访问，`content-type=image/png`。

验证环境说明：

- 当前 Codex PATH 默认 `pnpm` 为 11.7.0，仓库声明 `pnpm@9.15.1`。发布验证和后续发布命令必须前置 `/Users/peiwang/.nvm/versions/node/v22.16.0/bin`，确保内部 spawn 的 `pnpm` 也使用 9.15.1。

## 发布/部署方式

本次发布路径：

1. 调整 changeset，将 `nextclaw` 的本批产品变化标记为 minor。
2. 补齐文档站中英文 notes、结构化 JSON 和截图资产。
3. 执行 `pnpm release:version` 生成版本文件与 changelog。
4. 提交 release commit。
5. 执行 `pnpm release:publish` 发布 npm public packages。
6. 执行 `pnpm release:stable:runtime -- --version 0.23.0 --release-tag nextclaw@0.23.0` 更新 stable runtime channel。
7. 部署 docs site，让 `https://docs.nextclaw.io/zh/notes/2026-07-15-nextclaw-v0-23-0` 和英文页面可访问。

## 用户/产品视角的验收步骤

用户可从这些入口确认本次发布：

- NPM：`npm view nextclaw version` 返回 `0.23.0`。
- 文档站中文更新笔记：`https://docs.nextclaw.io/zh/notes/2026-07-15-nextclaw-v0-23-0`。
- 文档站英文更新笔记：`https://docs.nextclaw.io/en/notes/2026-07-15-nextclaw-v0-23-0`。
- 结构化更新说明：`https://docs.nextclaw.io/release-notes/nextclaw-v0.23.0.json`。
- NPM 安装态用户：旧版本应通过 stable runtime update channel 看到 `0.23.0` 更新说明或可重新安装 `nextclaw@latest`。

## 可维护性总结汇总

本次主要改动是发布元数据、文档站内容、截图资产和 skill 机制规则，不新增运行时代码路径。

- 干净实现原则：复用既有 docs notes、release notes JSON 和 npm release guard，不新增平行发布机制。
- 用户可见内容边界：文档站更新笔记只写用户可感知结果，不写内部治理过程。
- 机制治理：把“稳定 NPM minor 必须补 docs update note”落入已有 release notes skill 和 npm guard，而不是放在普通文档里靠记忆执行。
- 可维护性检查：源码运行逻辑未改；发布元数据生成后仍需执行 release check、docs build 和发布闭环验证。

## NPM 包发布记录

发布类型：stable NPM minor release。

目标主包：

- `nextclaw@0.23.0`：minor，已发布。

本批 public workspace packages：

- `@nextclaw/companion@0.2.5`：已发布。
- `@nextclaw/channel-extension-dingtalk@0.2.4`：已发布。
- `@nextclaw/channel-extension-discord@0.2.4`：已发布。
- `@nextclaw/channel-extension-email@0.2.4`：已发布。
- `@nextclaw/channel-extension-slack@0.2.4`：已发布。
- `@nextclaw/channel-extension-telegram@0.2.4`：已发布。
- `@nextclaw/channel-extension-wecom@0.2.4`：已发布。
- `@nextclaw/channel-extension-whatsapp@0.2.4`：已发布。
- `@nextclaw/nextclaw-narp-runtime-opencode@0.2.5`：已发布。
- `@nextclaw/ncp-mcp@0.2.4`：已发布。
- `@nextclaw/agent-chat-ui@0.6.5`：已发布。
- `@nextclaw/client-sdk@0.5.5`：已发布。
- `@nextclaw/core@0.15.4`：已发布。
- `@nextclaw/kernel@0.6.5`：已发布。
- `@nextclaw/mcp@0.3.4`：已发布。
- `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.5`：已发布。
- `@nextclaw/remote@0.3.5`：已发布。
- `@nextclaw/runtime@0.4.4`：已发布。
- `@nextclaw/server@0.15.5`：已发布。
- `@nextclaw/service@0.3.5`：已发布。
- `@nextclaw/ui@0.15.5`：已发布。

私有版本元数据：

- `@nextclaw/desktop@0.0.221`：private，不发布 npm。
