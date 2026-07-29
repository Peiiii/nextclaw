# NextClaw v0.27.7 NPM patch 正式发布

## 迭代完成说明

本轮把当前主干上已提交、已带 changeset 的五类变化统一纳入 `nextclaw@0.27.7` stable patch：

- 聊天输入框可以通过 `@` 引用已登记项目，并把受限项目概览作为本次消息上下文；
- Codex 长命令输出会维持活动状态，真实超时后保留原 thread 身份；
- Codex 默认使用完整本地执行权限和无审批策略；
- 停止回复并启动排队消息时，输入框队列立即刷新；
- Marketplace skill 卸载被限制在它管理的 workspace 直属 skill 目录内。

发布范围为 49 个公开 workspace 包的完整 patch 批次。主工作区中未提交的官网联系人图片与引用调整不属于本次发布范围，已在隔离发布工作树之外原样保留。

## 测试/验证/验收方式

- 发布前 `master` 与 `origin/master` 完全一致，目标提交冻结为 `215a61feb3b488e006f4f20a0f6d17db5897f147`。
- `NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc npm whoami` 返回 `peiiii`。
- `pnpm release:check:health` 通过，仓库批次外无发布漂移，workspace 版本不落后于稳定标签。
- 完整发布批次检查确认 49 个公开包，其中已有 changeset 覆盖 12 个包，自动 changeset 覆盖其余 37 个包。
- `pnpm release:version` 完成 49 个公开包版本与 changelog 更新，顶层版本为 `nextclaw@0.27.7`。
- `pnpm release:check:strict`：49 个包的 build、TypeScript 与 lint 全部通过；仅保留既有复杂度、包体积和第三方声明告警，没有错误。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、`pnpm clean:generated` 与 `pnpm check:generated-clean`：全部通过。
- `pnpm docs:i18n:check`：92 组中英文镜像页通过；`pnpm --filter @nextclaw/docs build` 完成 VitePress 构建。
- 发布候选 tarball 包含 `dist/cli/app/index.js`、`dist/cli/launcher/index.js`、`resources/update-bundle-public.pem` 和 `ui-dist/index.html`，且 package manifest 中没有残留 `workspace:*` 依赖。
- Registry 隔离安装：安装 468 个依赖后，CLI 报告 `0.27.7`，app、launcher、内置公钥和 UI 四项合同均存在。
- 公开 stable 升级：隔离安装 `0.27.6`，`--check` 发现 `0.27.7`，`--download-only` 完成下载，`--apply` 返回 `restart-required`，新进程报告 `0.27.7`。
- 公开文档：中英文页面和结构化 JSON 均返回 HTTP 200；Docs Deploy 的 build、全球部署、国内部署和双域一致性验证全部通过。

## 发布/部署方式

- NPM：49/49 个公开包已发布并通过 Registry 精确版本验证，`nextclaw@latest` 为 `0.27.7`。
- GitHub：49 个版本标签已推送；stable Release 为 [NextClaw v0.27.7](https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.27.7)，不是 draft 或 prerelease，并包含四个平台的 runtime bundle。
- Stable runtime：[workflow 30464645856](https://github.com/Peiiii/nextclaw/actions/runs/30464645856) 全部通过，公开 stable manifest 已覆盖 darwin-arm64、darwin-x64、linux-x64 和 win32-x64。
- Docs：[workflow 30464336603](https://github.com/Peiiii/nextclaw/actions/runs/30464336603) 全部通过；[中文说明](https://docs.nextclaw.io/zh/notes/2026-07-29-nextclaw-v0-27-7)、[English notes](https://docs.nextclaw.io/en/notes/2026-07-29-nextclaw-v0-27-7) 与[结构化 JSON](https://docs.nextclaw.io/release-notes/nextclaw-v0.27.7.json) 均已上线。
- 同一主干提交的 NCP smoke、Windows NPM update smoke 与 Source LOC Metrics 均通过。
- 数据库 migration、后端服务部署和 Desktop installer：不适用；本次没有数据库、远程后端或桌面安装包变更。
- 本次 release note 不附图：没有一张来自最终版本、同时覆盖项目选择入口和发送后上下文结果的统一真实截图，避免用旧图或弱证据图替代产品链路。
- 独立的 `desktop-validate` workflow 未全绿：Linux AppImage smoke 在 runtime init 失败，Windows portable/EXE job 被临时目录短路径与长路径拼写断言阻塞；macOS DMG、desktop runtime 和 Windows installer smoke 均通过。该 workflow 不属于本次 NPM/runtime 发布判定，本轮也没有发布 Desktop installer。

## 用户/产品视角的验收步骤

1. 从 `nextclaw@0.27.6` 检查 stable 更新，确认发现 `0.27.7`。
2. 下载并应用更新，确认新进程报告 `0.27.7`。
3. 在聊天输入框输入 `@`，选择已登记项目，确认生成项目令牌且不切换会话工作目录。
4. 在 Codex 会话中运行持续输出的长命令，确认不会被误判为空闲超时；真实超时后继续下一轮，确认恢复同一 thread。
5. 从 Marketplace 卸载合法 workspace skill，并确认路径越界目标被拒绝。

## 可维护性总结汇总

- 发布元数据沿用 Changesets、docs notes、结构化 release notes JSON、GitHub Release 和 stable runtime 既有 owner，没有新增平行发布链路。
- 本次版本化只生成 package version、changelog 和发布文档，不修改产品源码；生产语义代码净增门槛不适用于机械发布元数据。
- 各功能改动的代码增减、owner 边界和定向验证已记录在对应迭代日志；发布收尾将补充本次元数据 diff 与发布机制复盘。
- 发布提交 `ba0c961c851591e6249f8c341521fa65ab9e609a` 共 112 个发布元数据文件、`+2292/-84`；其中没有新增产品源码，主要增长来自 49 个包的机械 changelog、中英文 notes、结构化 JSON 与发布记录。
- 上一版新增的 `release:prepare:publish-artifacts` 本次在 Registry mutation 前成功重建 UI 与顶层包，49 个包一次发布完成，没有再次出现顶层包被陈旧 `ui-dist` 阻塞的问题。
- 复盘结论：现有发布 owner、prepack 合同、逐包 Registry 验证与旧版升级烟测已经覆盖本次风险，没有出现需要新增脚本、规则或 skill 的新机制缺口。

## NPM 包发布记录

- 发布范围：49 个公开 workspace 包，统一 patch。
- 顶层包：`nextclaw@0.27.7`，目标 dist-tag 为 `latest`。
- Registry 结果：`published 49/49 package versions`，`nextclaw@latest` 为 `0.27.7`。
- Runtime 兼容合同：四个平台 manifest 的 `latestVersion` 为 `0.27.7`，`minimumLauncherVersion` 为 `0.18.11`，`hostKind` 为 `npm-runtime-bundle`，bundle 与 manifest 签名均存在。
- 公开包精确版本：

```text
@nextclaw/agent-chat@0.3.13
@nextclaw/agent-chat-ui@0.6.19
@nextclaw/aigen@0.2.13
@nextclaw/app-runtime@0.9.13
@nextclaw/app-sdk@0.3.13
@nextclaw/browser-connector@0.3.13
@nextclaw/channel-extension-dingtalk@0.2.17
@nextclaw/channel-extension-discord@0.2.17
@nextclaw/channel-extension-email@0.2.17
@nextclaw/channel-extension-feishu@0.2.17
@nextclaw/channel-extension-qq@0.2.16
@nextclaw/channel-extension-slack@0.2.17
@nextclaw/channel-extension-telegram@0.2.17
@nextclaw/channel-extension-wecom@0.2.17
@nextclaw/channel-extension-weixin@0.2.17
@nextclaw/channel-extension-whatsapp@0.2.17
@nextclaw/client-sdk@0.5.19
@nextclaw/companion@0.2.19
@nextclaw/core@0.15.17
@nextclaw/extension-sdk@0.3.16
@nextclaw/feishu-core@0.3.13
@nextclaw/kernel@0.6.19
@nextclaw/mcp@0.3.17
@nextclaw/ncp@0.7.15
@nextclaw/ncp-agent-runtime@0.4.15
@nextclaw/ncp-agent-runtime-next@0.1.15
@nextclaw/ncp-http-agent-client@0.4.15
@nextclaw/ncp-http-agent-server@0.4.15
@nextclaw/ncp-mcp@0.2.17
@nextclaw/ncp-react@0.5.18
@nextclaw/ncp-react-ui@0.3.15
@nextclaw/ncp-toolkit@0.6.16
@nextclaw/nextclaw-hermes-acp-bridge@0.3.15
@nextclaw/nextclaw-narp-runtime-claude-code-sdk@0.2.16
@nextclaw/nextclaw-narp-runtime-codex-sdk@0.2.16
@nextclaw/nextclaw-narp-runtime-opencode@0.2.18
@nextclaw/nextclaw-narp-stdio-runtime-wrapper@0.3.16
@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.3.15
@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.2.16
@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.2.15
@nextclaw/nextclaw-ncp-runtime-http-client@0.3.15
@nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.18
@nextclaw/remote@0.3.19
@nextclaw/runtime@0.4.17
@nextclaw/server@0.15.19
@nextclaw/service@0.3.19
@nextclaw/shared@0.4.16
@nextclaw/ui@0.15.20
nextclaw@0.27.7
```
