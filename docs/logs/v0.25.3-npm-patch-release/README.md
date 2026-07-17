# v0.25.3 NPM Patch 全量发布

## 迭代完成说明

本次从已同步 `origin/master` 的隔离分支 `codex/release-npm-patch-0.25.2` 发布 NextClaw NPM stable patch。主工作区原有 landing 未提交改动保持隔离，不进入发布产物；本地 3 个已提交变更与远程 14 个提交通过 merge 基线统一，发布范围覆盖全部 49 个公开 workspace 包。

用户可见主变化来自 [v0.25.2 固定周期自动检查更新](../v0.25.2-fixed-automatic-update-check/README.md)：NPM 安装态持续运行时每两小时自动检查更新，但发现更新后只提示，下载和应用始终需要用户明确触发；切换更新通道时不会复用旧通道的在途检查结果。

发布说明已生成中英文页面与结构化 JSON。该 patch 不发布新的 Desktop installer，不涉及数据库 migration、独立后端部署或 X 宣发。

## 测试/验证/验收方式

发布前已完成：

- `pnpm release:sync-readmes`、`pnpm release:check-readmes`：通过。
- `pnpm release:check:health`：通过，当前批次之外无未发布漂移，workspace 版本不落后稳定 tag。
- `NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc npm whoami`：返回 `peiiii`。
- `pnpm release:auto:changeset`、`pnpm release:version`：完成 49 个公开包的 patch 版本化；私有 `@nextclaw/desktop` 只同步内部版本元数据，不进入 NPM publish。
- `pnpm release:check:strict`：49 个公开包的 build、`tsc`、ESLint 全部通过；0 error，既有 maintainability warning 不阻塞发布。
- `pnpm --filter @nextclaw/docs build`：中英文 `0.25.2` 更新说明和结构化 JSON 均成功构建。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、`git diff --check`：全部通过。
- `pnpm -C packages/nextclaw pack --pack-destination /private/tmp/nextclaw-pack-0.25.2`：`prepack` 合同通过；tarball 包含 `dist/cli/launcher/index.js`、`dist/cli/app/index.js` 与 `resources/update-bundle-public.pem`，依赖均已替换为本批精确版本，没有 `workspace:*`。

产品行为的真实 Desktop 与 NPM runtime smoke 已在 [v0.25.2 固定周期自动检查更新](../v0.25.2-fixed-automatic-update-check/README.md) 记录。本次发布闭环又从公开 registry 安装 `nextclaw@0.25.1`，在不注入自定义 manifest URL 或公钥的情况下完成 stable `--check`、`--download-only`、`--apply`：检查阶段只发现 `0.25.2`，下载阶段才写入 `downloadedVersion: 0.25.2`，应用后新进程、`current.json` 与更新状态均确认当前版本为 `0.25.2`。

发布后验收结果：

- `pnpm release:publish` 与 `release:verify:published`：49/49 个公开包全部发布并可从 registry 读取。
- `npm view nextclaw version dist-tags dependencies --json`：`version` 与 `latest` 均为 `0.25.2`，内部依赖全部指向本批精确版本。
- 从 registry 全新安装 `nextclaw@latest`：`nextclaw --version` 返回 `0.25.2`，launcher、app runtime 与 `update-bundle-public.pem` 均存在。
- [npm-runtime-update-release #29586610777](https://github.com/Peiiii/nextclaw/actions/runs/29586610777)：darwin arm64/x64、linux x64、win32 x64 与发布 job 全部成功。
- [nextclaw@0.25.2 runtime release](https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.25.2)：四个平台 bundle assets 均已上传；该 GitHub prerelease 继续只作为 NPM runtime 资产载体，用户稳定通道由公开 manifest 决定。
- 四个平台公开 stable manifest 均返回 `latestVersion: 0.25.2`、`hostKind: npm-runtime-bundle`，并指向本次英文发布说明。
- Cloudflare Pages 正式部署成功；中英文页面与结构化 JSON 均通过 `docs.nextclaw.io` 返回 HTTP 200，结构化内容确认 `version: 0.25.2`、`channel: stable`、`releaseType: patch`。

## 发布/部署方式

- NPM：已使用仓库标准命令 `pnpm release:publish` 全量发布，没有从单包目录执行 raw `npm publish`；49 个当前批次 tag 已逐一推送，避免历史本地冲突 tag 污染发布范围。
- Runtime update：已执行 `pnpm release:stable:runtime -- --version 0.25.2 --release-tag nextclaw@0.25.2 --branch codex/release-npm-patch-0.25.2`，GitHub Actions、runtime release assets、`gh-pages` 与公共 stable manifest 全部生效。
- Docs：已使用已登录的本地 Wrangler 部署 `@nextclaw/docs` 构建产物，正式部署预览为 `https://a8d2089c.nextclaw-docs.pages.dev`；中英文页面与 `/release-notes/nextclaw-v0.25.2.json` 已在自定义域名验收。
- Desktop installer / manifest：不适用，本次没有新的桌面安装包。
- 数据库 migration / 独立后端部署：不适用，本批没有数据库或独立服务端变更。
- X 帖与配图：不适用；这是稳定性与默认行为 patch，没有能直接证明主结论的必要视觉素材，也不属于默认宣发范围。

## 用户/产品视角的验收步骤

1. 在隔离目录安装发布前的旧版 `nextclaw@0.25.1`，使用独立 `NEXTCLAW_HOME`。
2. 执行 stable `update --check`，确认能发现 `0.25.2`。
3. 确认检查动作不会自动下载；显式执行 `--download-only` 后才获得已下载版本。
4. 显式执行 `--apply`，确认新进程与 active runtime 版本均切换到 `0.25.2`。
5. 从 registry 新装 `nextclaw@latest`，确认 `nextclaw --version` 为 `0.25.2`，并确认包内 launcher、app runtime 与 update public key 均存在。

## 可维护性总结汇总

本次发布操作没有新增产品源码；代码可维护性结论沿用 [v0.25.2 固定周期自动检查更新](../v0.25.2-fixed-automatic-update-check/README.md) 的已验证结果：相关源码/脚本/测试总代码净减 264 行，非测试代码净减 237 行，更新偏好合同、自动下载分支和重复状态字段被删除。

本记录新增的版本号、changelog、发布说明和结构化 JSON 属于必要 release metadata，不用压行或删除用户发布记录来追求净减。发布完成后会清理非必要生成 hash 漂移，并在隔离 worktree 与主工作区分别检查状态。

## NPM 包发布记录

已通过 full public workspace batch 发布以下 49 个公开包；`release:verify:published` 结果为 49/49，当前状态均为 `已发布并验证 registry`：

- `@nextclaw/companion@0.2.9`
- `@nextclaw/aigen@0.2.3`
- `@nextclaw/browser-connector@0.3.3`
- `@nextclaw/channel-extension-dingtalk@0.2.7`
- `@nextclaw/channel-extension-discord@0.2.7`
- `@nextclaw/channel-extension-email@0.2.7`
- `@nextclaw/channel-extension-feishu@0.2.7`
- `@nextclaw/channel-extension-qq@0.2.6`
- `@nextclaw/channel-extension-slack@0.2.7`
- `@nextclaw/channel-extension-telegram@0.2.7`
- `@nextclaw/channel-extension-wecom@0.2.7`
- `@nextclaw/channel-extension-weixin@0.2.7`
- `@nextclaw/channel-extension-whatsapp@0.2.7`
- `@nextclaw/feishu-core@0.3.3`
- `@nextclaw/nextclaw-narp-runtime-claude-code-sdk@0.2.6`
- `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.2.6`
- `@nextclaw/nextclaw-narp-runtime-opencode@0.2.8`
- `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.2.6`
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.2.5`
- `@nextclaw/ncp-agent-runtime-next@0.1.5`
- `@nextclaw/ncp-agent-runtime@0.4.5`
- `@nextclaw/ncp-http-agent-client@0.4.5`
- `@nextclaw/ncp-http-agent-server@0.4.5`
- `@nextclaw/ncp-mcp@0.2.7`
- `@nextclaw/ncp-react-ui@0.3.5`
- `@nextclaw/ncp-react@0.5.7`
- `@nextclaw/ncp-toolkit@0.6.6`
- `@nextclaw/ncp@0.7.5`
- `@nextclaw/agent-chat-ui@0.6.9`
- `@nextclaw/agent-chat@0.3.3`
- `@nextclaw/app-runtime@0.9.3`
- `@nextclaw/app-sdk@0.3.3`
- `@nextclaw/client-sdk@0.5.9`
- `@nextclaw/core@0.15.7`
- `@nextclaw/extension-sdk@0.3.6`
- `@nextclaw/nextclaw-hermes-acp-bridge@0.3.5`
- `@nextclaw/kernel@0.6.9`
- `@nextclaw/mcp@0.3.7`
- `@nextclaw/nextclaw-narp-stdio-runtime-wrapper@0.3.6`
- `@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.3.5`
- `@nextclaw/nextclaw-ncp-runtime-http-client@0.3.5`
- `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.8`
- `@nextclaw/remote@0.3.9`
- `@nextclaw/runtime@0.4.7`
- `@nextclaw/server@0.15.9`
- `@nextclaw/service@0.3.9`
- `@nextclaw/shared@0.4.6`
- `@nextclaw/ui@0.15.9`
- `nextclaw@0.25.2`

`@nextclaw/desktop@0.0.225` 是 private workspace package，不会发布到 NPM；其版本变化只用于内部依赖一致性。

## 发布复盘

- registry 个别包短暂传播延迟由标准 `release:verify:published` 有限重试机制自动吸收，最终在同一次发布流程中达到 49/49，没有重复 publish；现有机制已经覆盖该类反复出现的外部一致性窗口，无需再增加平行验证脚本。
- 本地存在两个历史 tag 与远程同名但指向不同对象；本次只推送当前 49 个精确 release tag，没有使用 `git push --tags`，因此没有把历史 tag 冲突扩散到发布闭环。
- GitHub Actions 仅报告 Actions Node 20 被平台强制迁移到 Node 24 的弃用告警，所有 job 实际成功；这是上游 action 版本维护提示，不影响本次 runtime 产物或更新合同。
- 发布提交为 `660ad828d release: publish nextclaw 0.25.2`。发布元数据提交包含大批 package 版本、changelog、生成 UI payload 与文档索引变化；本次发布操作本身没有新增产品语义源码，可维护性仍以 v0.25.2 实现批次的源码净减 264 行、非测试代码净减 237 行为准。
