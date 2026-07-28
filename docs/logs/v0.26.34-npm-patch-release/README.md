# NextClaw v0.27.6 NPM patch 正式发布

## 迭代完成说明

本轮将当前已提交的五类用户可见变化统一发布为 `nextclaw@0.27.6` stable patch：

- Codex 与 Claude Code Agent Runtime 保留原生指令，同时获得 NextClaw 产品、工作区与 skill 上下文；
- Panel App 与 HTML 内容支持结构化运行参数；
- 排队消息只在真正开始执行后进入会话记录；
- Mermaid 图表支持全屏预览；
- Agent 会在比较、流程、层级和数值关系适合时更主动地使用表格或 Mermaid。

发布范围采用完整的 49 个公开 workspace 包 patch 批次，确保顶层 `nextclaw`、内嵌 UI 和 runtime 依赖闭包版本一致。

主工作区中未提交的“项目上下文引用”改动不属于本次已审计发布范围，已通过隔离发布工作树完整保留。

## 测试/验证/验收方式

- `pnpm release:report:health`：发布前仓库健康，批次外无 Registry 漂移，workspace 版本不落后于稳定标签。
- `pnpm release:auto:changeset -- --check`：确认已有用户 changeset 覆盖 15 个受影响公开包。
- `pnpm release:auto:changeset`：为其余 34 个公开包生成完整 patch 批次。
- `pnpm release:version`：完成 49 个公开包版本与 changelog 更新，`nextclaw` 版本为 `0.27.6`。
- `pnpm release:check:strict`：49 个包的 build、TypeScript 与 lint 全部通过；仅保留既有复杂度、包体积和依赖告警，没有错误。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、`pnpm clean:generated`、`pnpm check:generated-clean`：全部通过。
- Registry tarball 检查确认 `dist/cli/app/index.js`、`dist/cli/launcher/index.js`、`resources/update-bundle-public.pem`、`ui-dist/index.html` 均在 `nextclaw@0.27.6` 中。
- Registry 隔离安装：安装 468 个依赖后，CLI 报告 `0.27.6`，app、launcher、内置公钥和 UI 四项合同均存在。
- 公开 stable 升级：隔离安装 `0.27.5`，`--check` 发现 `0.27.6`，`--download-only` 完成下载，`--apply` 返回 `restart-required`，新进程报告 `0.27.6`。
- 公开文档：中英文页面和结构化 JSON 均返回 HTTP 200；Docs Deploy 的 build、全球部署、国内部署和双域一致性验证全部通过。

## 发布/部署方式

- NPM：49/49 个公开包已发布并通过 Registry 精确版本验证，`nextclaw@latest` 为 `0.27.6`。
- GitHub：49 个版本标签已推送；stable Release 为 [NextClaw v0.27.6](https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.27.6)，不是 draft 或 prerelease，并包含四个平台的 runtime bundle。
- Stable runtime：[workflow 30388989368](https://github.com/Peiiii/nextclaw/actions/runs/30388989368) 全部通过，公开 stable manifest 已覆盖 darwin-arm64、darwin-x64、linux-x64 和 win32-x64。
- Docs：[workflow 30388776719](https://github.com/Peiiii/nextclaw/actions/runs/30388776719) 全部通过；[中文说明](https://docs.nextclaw.io/zh/notes/2026-07-29-nextclaw-v0-27-6)、[English notes](https://docs.nextclaw.io/en/notes/2026-07-29-nextclaw-v0-27-6) 与[结构化 JSON](https://docs.nextclaw.io/release-notes/nextclaw-v0.27.6.json) 均已上线。
- 数据库 migration、后端服务部署和 Desktop installer：不适用；本次没有数据库、远程后端或桌面安装包发布。

## 用户/产品视角的验收步骤

1. 从旧版 NPM 安装态检查 stable 更新，确认发现 `0.27.6`。
2. 下载并应用更新，确认新进程报告 `0.27.6`。
3. 在 Codex 或 Claude Code Runtime 中确认原生行为保留，并能使用 NextClaw 工作区和 skill 上下文。
4. 打开带参数的 Panel App 或 HTML 内容，确认页面能读取 `window.nextclaw.params`。
5. 在聊天中放大 Mermaid 图表，并通过按钮、遮罩和 Escape 退出。
6. 在 AI 回复期间继续发送消息，确认待发内容不会同时出现在聊天时间线中。

## 可维护性总结汇总

- 本轮发布元数据沿用 Changesets、docs notes、结构化 release notes JSON、GitHub Release 和 stable runtime 的既有单一路径，没有新增发布 owner。
- 完整公开包批次由现有 release scope 脚本生成；产品变化的可维护性结论沿用各功能迭代记录。
- 发布阶段只新增文档、JSON、changelog 和版本元数据，不修改产品源码；代码净增门槛不适用于机械发布元数据。
- 发布提交为 112 个发布元数据文件、`+2111/-90`；其中没有新增产品源码，主要增长来自 49 个包的机械 changelog。
- 首轮发布成功发布 48 个包，顶层 `nextclaw` 被 prepack 合同拦截：生成产物清理后，缓存的 release check 没有重建 UI，导致 `ui-dist` 与源码构建不一致。重建 UI 和顶层包后仅补发 `nextclaw@0.27.6`，最终 Registry 验证为 49/49。
- 为避免同类中断，根发布入口新增 `release:prepare:publish-artifacts`，并在普通与 frontend publish 中于 `changeset publish` 前强制重建 UI 和顶层包；prepack 合同继续作为最后一道安全边界。
- `post-edit-maintainability-review` 对机械发布元数据不适用；发布脚本补强没有引入新 owner 或平行链路，仍由根 `release:publish` 单一路径编排。

## NPM 包发布记录

- 发布范围：49 个公开 workspace 包，统一 patch。
- 顶层包：`nextclaw@0.27.6`，目标 dist-tag 为 `latest`。
- Registry 结果：`published 49/49 package versions`，`nextclaw@latest` 为 `0.27.6`。
- Runtime 兼容合同：四个平台 manifest 的 `latestVersion` 为 `0.27.6`，`minimumLauncherVersion` 为 `0.18.11`，`hostKind` 为 `npm-runtime-bundle`，bundle 与 manifest 签名均存在。
- 公开包精确版本：

```text
@nextclaw/agent-chat@0.3.12
@nextclaw/agent-chat-ui@0.6.18
@nextclaw/aigen@0.2.12
@nextclaw/app-runtime@0.9.12
@nextclaw/app-sdk@0.3.12
@nextclaw/browser-connector@0.3.12
@nextclaw/channel-extension-dingtalk@0.2.16
@nextclaw/channel-extension-discord@0.2.16
@nextclaw/channel-extension-email@0.2.16
@nextclaw/channel-extension-feishu@0.2.16
@nextclaw/channel-extension-qq@0.2.15
@nextclaw/channel-extension-slack@0.2.16
@nextclaw/channel-extension-telegram@0.2.16
@nextclaw/channel-extension-wecom@0.2.16
@nextclaw/channel-extension-weixin@0.2.16
@nextclaw/channel-extension-whatsapp@0.2.16
@nextclaw/client-sdk@0.5.18
@nextclaw/companion@0.2.18
@nextclaw/core@0.15.16
@nextclaw/extension-sdk@0.3.15
@nextclaw/feishu-core@0.3.12
@nextclaw/kernel@0.6.18
@nextclaw/mcp@0.3.16
@nextclaw/ncp@0.7.14
@nextclaw/ncp-agent-runtime@0.4.14
@nextclaw/ncp-agent-runtime-next@0.1.14
@nextclaw/ncp-http-agent-client@0.4.14
@nextclaw/ncp-http-agent-server@0.4.14
@nextclaw/ncp-mcp@0.2.16
@nextclaw/ncp-react@0.5.17
@nextclaw/ncp-react-ui@0.3.14
@nextclaw/ncp-toolkit@0.6.15
@nextclaw/nextclaw-hermes-acp-bridge@0.3.14
@nextclaw/nextclaw-narp-runtime-claude-code-sdk@0.2.15
@nextclaw/nextclaw-narp-runtime-codex-sdk@0.2.15
@nextclaw/nextclaw-narp-runtime-opencode@0.2.17
@nextclaw/nextclaw-narp-stdio-runtime-wrapper@0.3.15
@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.3.14
@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.2.15
@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.2.14
@nextclaw/nextclaw-ncp-runtime-http-client@0.3.14
@nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.17
@nextclaw/remote@0.3.18
@nextclaw/runtime@0.4.16
@nextclaw/server@0.15.18
@nextclaw/service@0.3.18
@nextclaw/shared@0.4.15
@nextclaw/ui@0.15.19
nextclaw@0.27.6
```
