# NextClaw 0.26.1 NPM Patch 发布

## 迭代完成说明

本次从隔离分支 `codex/release-npm-patch-0.26.1` 准备 NextClaw NPM stable patch。发布基线合并本地 `master` 的已提交文档更新与 `origin/master` 的最新指标快照；主工作区现有 Skin Studio 未提交改动和 UI 构建产物保持隔离，不进入发布版本。

本批采用 full public workspace batch，共 49 个公开包。用户可见变化包括：无 token 用量时不再显示无效占位，运行信息弹窗不再跳位；移动端聊天输入工具栏减少不必要高度；定时任务模板在窄窗口和移动端保持完整可读。

中英文产品更新说明与结构化 JSON 已写入仓库。发布说明不配图：三项变化分散在聊天消息、移动端输入区和定时任务模板，单张截图不能完整、真实地支撑本批结论。该 patch 默认不发布 X 帖。

## 测试/验证/验收方式

发布前已完成：

- `NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc npm whoami`：返回 `peiiii`。
- `pnpm release:check:health`：通过，当前批次之外无未发布漂移，workspace 版本不落后稳定 tag。
- `pnpm release:check:groups`：通过。
- `pnpm release:auto:changeset`、`pnpm release:version`：完成 full public workspace patch 版本化。

发布前仍需完成严格 release check、文档构建、治理检查、tarball 合同检查和临时安装冒烟；发布后还需验证 registry、stable runtime update、公开 manifest 与产品更新说明 URL。最终结果将在发布闭环完成后回填。

## 发布/部署方式

- NPM：计划使用仓库标准命令 `pnpm release:publish` 发布，不使用 raw `npm publish`。
- Runtime update：`nextclaw@0.26.1` 发布后，计划执行 `pnpm release:stable:runtime -- --version 0.26.1 --release-tag nextclaw@0.26.1 --branch codex/release-npm-patch-0.26.1`。
- Docs：计划构建并发布中英文 `0.26.1` 更新说明与结构化 JSON，确保 runtime manifest 的 `releaseNotesUrl` 可公开访问。
- Desktop installer / manifest：不适用，本次没有新的桌面安装包。
- 数据库 migration / 独立后端部署：不适用，本批没有数据库或独立服务端变更。
- X 帖与配图：不适用；patch 默认不宣发，且没有一张图片能完整证明三个分散界面的修复。

## 用户/产品视角的验收步骤

1. 从公开 registry 安装 `nextclaw@0.26.1`，确认 CLI 报告正确版本，并包含 launcher、app runtime 与 update public key。
2. 使用独立 `NEXTCLAW_HOME` 从旧版 stable 安装执行 `update --check`、`--download-only` 与 `--apply`，确认可发现、下载并切换到 `0.26.1`。
3. 打开中英文产品更新说明，确认三项用户可见修复与结构化 JSON 内容一致。

## 可维护性总结汇总

本次发布操作只新增必要的版本号、changelog、产品更新说明、结构化 JSON 和发布记录，不新增产品语义源码。三项产品修复的代码可维护性结论沿用各自迭代记录；本次将运行 release check、governance 与生成产物清理，避免发布过程留下源码或构建产物漂移。

## NPM 包发布记录

需要发布。以下 49 个公开包已完成 patch 版本化，当前状态为 `待统一发布`：

- `@nextclaw/agent-chat-ui@0.6.12`
- `@nextclaw/agent-chat@0.3.6`
- `@nextclaw/aigen@0.2.6`
- `@nextclaw/app-runtime@0.9.6`
- `@nextclaw/app-sdk@0.3.6`
- `@nextclaw/browser-connector@0.3.6`
- `@nextclaw/channel-extension-dingtalk@0.2.10`
- `@nextclaw/channel-extension-discord@0.2.10`
- `@nextclaw/channel-extension-email@0.2.10`
- `@nextclaw/channel-extension-feishu@0.2.10`
- `@nextclaw/channel-extension-qq@0.2.9`
- `@nextclaw/channel-extension-slack@0.2.10`
- `@nextclaw/channel-extension-telegram@0.2.10`
- `@nextclaw/channel-extension-wecom@0.2.10`
- `@nextclaw/channel-extension-weixin@0.2.10`
- `@nextclaw/channel-extension-whatsapp@0.2.10`
- `@nextclaw/client-sdk@0.5.12`
- `@nextclaw/companion@0.2.12`
- `@nextclaw/core@0.15.10`
- `@nextclaw/extension-sdk@0.3.9`
- `@nextclaw/feishu-core@0.3.6`
- `@nextclaw/kernel@0.6.12`
- `@nextclaw/mcp@0.3.10`
- `@nextclaw/ncp-agent-runtime-next@0.1.8`
- `@nextclaw/ncp-agent-runtime@0.4.8`
- `@nextclaw/ncp-http-agent-client@0.4.8`
- `@nextclaw/ncp-http-agent-server@0.4.8`
- `@nextclaw/ncp-mcp@0.2.10`
- `@nextclaw/ncp-react-ui@0.3.8`
- `@nextclaw/ncp-react@0.5.10`
- `@nextclaw/ncp-toolkit@0.6.9`
- `@nextclaw/ncp@0.7.8`
- `@nextclaw/nextclaw-hermes-acp-bridge@0.3.8`
- `@nextclaw/nextclaw-narp-runtime-claude-code-sdk@0.2.9`
- `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.2.9`
- `@nextclaw/nextclaw-narp-runtime-opencode@0.2.11`
- `@nextclaw/nextclaw-narp-stdio-runtime-wrapper@0.3.9`
- `@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.3.8`
- `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.2.9`
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.2.8`
- `@nextclaw/nextclaw-ncp-runtime-http-client@0.3.8`
- `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.11`
- `@nextclaw/remote@0.3.12`
- `@nextclaw/runtime@0.4.10`
- `@nextclaw/server@0.15.12`
- `@nextclaw/service@0.3.12`
- `@nextclaw/shared@0.4.9`
- `@nextclaw/ui@0.15.12`
- `nextclaw@0.26.1`

`@nextclaw/desktop` 是 private workspace package，只同步内部版本元数据，不进入 NPM publish。
