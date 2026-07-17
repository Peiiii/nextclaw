# v0.25.5 NPM Patch 全量发布

## 迭代完成说明

本次从已同步 `origin/master` 的隔离分支 `codex/release-npm-patch-0.25.3` 发布 NextClaw NPM stable patch。发布目标是把 [v0.25.4 NPM 运行时内置 Skill 资产保留](../v0.25.4-runtime-builtin-skill-assets/README.md) 交付给现有 NPM 安装：应用 runtime update 后，`@nextclaw/core` 随包提供的完整内置 skill 资产仍然存在并可用。

发布范围采用 full public workspace batch，共 49 个公开包。理由是 `nextclaw` 的真实安装行为来自 kernel、service、server、NCP、runtime adapter 与 UI 等依赖闭包；统一 patch 可以让 registry、changelog、tag 和安装依赖保持同一个版本批次。私有 `@nextclaw/desktop` 只同步内部版本元数据，不进入 NPM publish。

本次生成中英文产品更新说明与结构化 JSON。该 patch 默认不发 X 帖，也不配图：变化位于运行时打包与技能资产完整性，真实截图不能比文字和真实升级验收提供更多证据。

## 测试/验证/验收方式

发布前实现验证已记录在 v0.25.4，包括 package lint/tsc、runtime update smoke、`dev:verify-update -- --rebuild`、候选 runtime skill API 断言、冷/热缓存验证以及真实模型读取 `visualize-output` 的前向验收。

本次发布窗口将补充：

- 49 个公开包的严格 build、TypeScript 与 ESLint 发布前门禁。
- `nextclaw@0.25.3` tarball 的 launcher、app runtime、update public key、精确依赖与内置 skill 资产检查。
- registry 49/49 发布验证与 `nextclaw@latest` 全新安装检查。
- 从公开 `nextclaw@0.25.2` 执行 stable check、download-only、apply、新进程版本以及内置 skill 资产检查。
- 四个平台 stable runtime manifest、GitHub Release assets 与正式文档站验收。

## 发布/部署方式

- NPM：使用仓库标准命令 `pnpm release:publish` 全量发布，不从单包目录执行 raw `npm publish`。
- Runtime update：NPM 发布成功后执行 `pnpm release:stable:runtime -- --version 0.25.3 --release-tag nextclaw@0.25.3 --branch codex/release-npm-patch-0.25.3`，等待 GitHub Actions 与公开 manifest 生效。
- Docs：构建并部署 `@nextclaw/docs`，确认中英文页面与 `/release-notes/nextclaw-v0.25.3.json` 对外返回成功。
- Desktop installer / manifest：不适用，本次没有新的桌面安装包。
- 数据库 migration / 独立后端部署：不适用，本批没有数据库或独立服务端变更。
- X 帖与配图：不适用；patch 修复没有能直接证明主结论的必要视觉素材，也不属于默认宣发范围。

## 用户/产品视角的验收步骤

1. 在隔离目录安装发布前的 `nextclaw@0.25.2`，使用独立 `NEXTCLAW_HOME`。
2. 执行 stable `update --check`，确认能发现 `0.25.3` 且检查本身不会下载。
3. 显式执行 `--download-only` 与 `--apply`，确认下一进程和 active runtime 都切换到 `0.25.3`。
4. 检查已应用 runtime 的 `@nextclaw/core/dist/skills`，确认 `visualize-output/SKILL.md` 与其他内置 skill 资料存在。
5. 从 registry 新装 `nextclaw@latest`，确认版本、launcher、app runtime、update public key 和内置 skill 资产完整。

## 可维护性总结汇总

本次发布操作只增加版本、changelog、发布说明和结构化 JSON，不新增产品语义源码。实现批次继续由现有 `NpmRuntimeDeploymentCacheManager` 拥有裁剪、缓存和资产一致性；没有新增 manager、资产 registry、fallback 或平行安装路径。

v0.25.4 实现批次的运行链路脚本新增 47 行、删除 8 行，净增 39 行；这是修复用户安装态缺陷所需的资产边界和验证合同。`post-edit-maintainability-guard` 为 0 error、1 个既有临界文件 warning，主观复核通过。

## NPM 包发布记录

以下 49 个公开包已完成 patch 版本化，当前状态为 `待发布并验证 registry`：

- `@nextclaw/agent-chat-ui@0.6.10`
- `@nextclaw/agent-chat@0.3.4`
- `@nextclaw/aigen@0.2.4`
- `@nextclaw/app-runtime@0.9.4`
- `@nextclaw/app-sdk@0.3.4`
- `@nextclaw/browser-connector@0.3.4`
- `@nextclaw/channel-extension-dingtalk@0.2.8`
- `@nextclaw/channel-extension-discord@0.2.8`
- `@nextclaw/channel-extension-email@0.2.8`
- `@nextclaw/channel-extension-feishu@0.2.8`
- `@nextclaw/channel-extension-qq@0.2.7`
- `@nextclaw/channel-extension-slack@0.2.8`
- `@nextclaw/channel-extension-telegram@0.2.8`
- `@nextclaw/channel-extension-wecom@0.2.8`
- `@nextclaw/channel-extension-weixin@0.2.8`
- `@nextclaw/channel-extension-whatsapp@0.2.8`
- `@nextclaw/client-sdk@0.5.10`
- `@nextclaw/companion@0.2.10`
- `@nextclaw/core@0.15.8`
- `@nextclaw/extension-sdk@0.3.7`
- `@nextclaw/feishu-core@0.3.4`
- `@nextclaw/kernel@0.6.10`
- `@nextclaw/mcp@0.3.8`
- `@nextclaw/ncp-agent-runtime-next@0.1.6`
- `@nextclaw/ncp-agent-runtime@0.4.6`
- `@nextclaw/ncp-http-agent-client@0.4.6`
- `@nextclaw/ncp-http-agent-server@0.4.6`
- `@nextclaw/ncp-mcp@0.2.8`
- `@nextclaw/ncp-react-ui@0.3.6`
- `@nextclaw/ncp-react@0.5.8`
- `@nextclaw/ncp-toolkit@0.6.7`
- `@nextclaw/ncp@0.7.6`
- `@nextclaw/nextclaw-hermes-acp-bridge@0.3.6`
- `@nextclaw/nextclaw-narp-runtime-claude-code-sdk@0.2.7`
- `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.2.7`
- `@nextclaw/nextclaw-narp-runtime-opencode@0.2.9`
- `@nextclaw/nextclaw-narp-stdio-runtime-wrapper@0.3.7`
- `@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.3.6`
- `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.2.7`
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.2.6`
- `@nextclaw/nextclaw-ncp-runtime-http-client@0.3.6`
- `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.9`
- `@nextclaw/remote@0.3.10`
- `@nextclaw/runtime@0.4.8`
- `@nextclaw/server@0.15.10`
- `@nextclaw/service@0.3.10`
- `@nextclaw/shared@0.4.7`
- `@nextclaw/ui@0.15.10`
- `nextclaw@0.25.3`

`@nextclaw/desktop@0.0.226` 是 private workspace package，不会发布到 NPM；其版本变化只用于内部依赖一致性。
