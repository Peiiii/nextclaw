# NextClaw 0.27.0 NPM Minor 发布

## 迭代完成说明

本次从隔离分支 `codex/release-npm-minor-0.27.0` 发布本地 `master` 在 `e8118cf3b` 的全部已提交变更，目标版本为 `nextclaw@0.27.0`，采用 full public workspace batch，共 49 个公开包。

用户可见变化包括：Remote 按设备与本地端口保持稳定实例身份；每个实例同时拥有随机固定默认域名和可选的全局唯一自定义域名；长会话支持手动上下文压缩；可以添加已有目录作为项目；Codex 模型切换保持会话连续；Marketplace 技能安装、工作区文件预览和项目列表体验得到改进。

中英文产品更新说明与结构化 JSON 已写入仓库。本次不配图：核心变化分散在 Remote、项目列表、聊天会话和 Panel App 等多个表面，单张截图无法完整、真实地代表整个 minor 版本。

## 测试/验证/验收方式

发布前已完成：

- NPM 身份：`peiiii`。
- `pnpm release:check:health`：通过，当前批次之外无未发布漂移，workspace 版本不落后稳定 tag。
- `pnpm release:check:groups`：通过。
- `pnpm release:auto:changeset`、`pnpm release:version`：完成 full public workspace 版本化，`nextclaw` 为 `0.27.0`。
- Remote 功能已完成 Gateway、Platform、认证 UI 与线上域名占用链路验证，结果记录在 `docs/logs/v0.26.10-remote-instance-domain-claims/README.md`。
- `NEXTCLAW_RELEASE_CHECK_RESET=1 pnpm release:check:strict`：从空 checkpoint 完成 49 个公开包的 build、TypeScript 与 lint，0 个阻断错误。
- 干净安装验证发现 `@nextclaw/app-sdk`、`@nextclaw/client-sdk`、`@nextclaw/ncp-react-ui` 继承统一 Node 类型合同时依赖工作区偶然提升；现已为三个包显式声明 `@types/node`，定向 `tsc` 与完整 release check 均通过。
- `pnpm -C apps/docs build`、发布说明 JSON 解析、`pnpm lint:maintainability:guard`：通过；可维护性检查 0 errors、0 warnings，非测试语义代码净增为 0。
- `packages/nextclaw/ui-dist` 已从当前源码重新生成并纳入发布提交，避免 NPM 包继续携带旧前端资源。
- 发布提交 `78593df06` 已进入本地 `master` 并推送 `origin/master`；49 个 package tag 已全部推送。
- `pnpm release:publish` 与 `release:verify:published`：通过，49/49 个公开包均已发布；`nextclaw@latest` 为 `0.27.0`。
- 从 registry 执行 `npm pack nextclaw@0.27.0`：通过，tarball integrity 与 registry 一致，且包含 app CLI、launcher CLI、update public key 和 `ui-dist/index.html`。
- 隔离安装 `nextclaw@0.27.0`：`--version` 返回 `0.27.0`，stable `update --check --json` 返回 `up-to-date`。
- 真实更新烟测：隔离安装 `nextclaw@0.26.1` 后依次执行 `update --check`、`--download-only`、`--apply`，成功发现、下载并切换到 `0.27.0`，最终 CLI 与 runtime pointer 均为 `0.27.0`。
- Docs workflow `29794479718`：成功；中英文更新说明与结构化 JSON 在 `docs.nextclaw.io`、`docs.nextclaw.net` 均返回 200。
- Stable runtime workflow `29794663007`：成功；darwin-arm64、darwin-x64、linux-x64、win32-x64 四个平台资产齐全，公开 manifest 均为 `latestVersion=0.27.0`、`minimumLauncherVersion=0.18.11`、`hostKind=npm-runtime-bundle`，bundle 和 manifest 签名非空，更新说明指向英文公开页面。
- 本机全局安装已从 `0.26.1` 更新到 `0.27.0`，在原端口 `55667` 重启；PID 从 `60407` 切换为 `63642`，managed/configured health 均为 `ok`，`/api/app/meta` 返回 `productVersion=0.27.0`，Remote runtime 为 `connected`，stable 更新检查返回 `up-to-date`。

## 发布/部署方式

- NPM：已使用仓库标准命令 `pnpm release:publish` 统一发布 49 个公开包，没有使用 raw `npm publish`。
- Runtime update：已完成 stable runtime workflow，版本为 `0.27.0`，release tag 为 `nextclaw@0.27.0`。
- Docs：已发布中英文 `0.27.0` 更新说明与结构化 JSON，runtime manifest 的 `releaseNotesUrl` 指向公开页面。
- 本地运行时：已安装 `nextclaw@latest`，沿用端口 `55667` 重启，并完成版本、PID、健康状态、Remote 连接和更新检查验证。
- Desktop installer / manifest：不适用，本次没有新的桌面安装包。
- 数据库 migration / 独立后端部署：不适用；Remote 所需 migration、Gateway 与 Platform 已在功能交付阶段完成并验证。
- X 帖：未执行。`x-twitter-bird` 要求只有用户明确授权发帖时才能操作社交账号；本次“全量 NPM 发布”不扩大为社交账号写入权限。

## 用户/产品视角的验收步骤

1. 从公开 registry 安装 `nextclaw@0.27.0`，确认 CLI 报告正确版本，并包含 launcher、app runtime 与 update public key。
2. 使用独立 `NEXTCLAW_HOME` 验证启动、状态和 update manifest；确认 stable 通道能发现、下载并应用 `0.27.0`。
3. 打开中英文产品更新说明与结构化 JSON，确认内容一致且 runtime manifest 的 `releaseNotesUrl` 可访问。
4. 更新本机全局 NextClaw，在原端口 `55667` 重启，确认服务健康且实际运行版本为 `0.27.0`。

## 可维护性总结汇总

本次发布操作只新增必要的版本号、changelog、产品更新说明、结构化 JSON 和发布记录，不新增产品语义源码。源代码改动的可维护性结论沿用各自迭代记录；发布闭环会运行 release check、governance 与生成产物清理，避免发布过程留下源码或构建产物漂移。

## NPM 包发布记录

已发布。以下 49 个公开包已完成版本化、NPM publish、registry 校验与 tag 推送：

- `@nextclaw/agent-chat@0.3.7`
- `@nextclaw/agent-chat-ui@0.6.13`
- `@nextclaw/aigen@0.2.7`
- `@nextclaw/app-runtime@0.9.7`
- `@nextclaw/app-sdk@0.3.7`
- `@nextclaw/browser-connector@0.3.7`
- `@nextclaw/channel-extension-dingtalk@0.2.11`
- `@nextclaw/channel-extension-discord@0.2.11`
- `@nextclaw/channel-extension-email@0.2.11`
- `@nextclaw/channel-extension-feishu@0.2.11`
- `@nextclaw/channel-extension-qq@0.2.10`
- `@nextclaw/channel-extension-slack@0.2.11`
- `@nextclaw/channel-extension-telegram@0.2.11`
- `@nextclaw/channel-extension-wecom@0.2.11`
- `@nextclaw/channel-extension-weixin@0.2.11`
- `@nextclaw/channel-extension-whatsapp@0.2.11`
- `@nextclaw/client-sdk@0.5.13`
- `@nextclaw/companion@0.2.13`
- `@nextclaw/core@0.15.11`
- `@nextclaw/extension-sdk@0.3.10`
- `@nextclaw/feishu-core@0.3.7`
- `@nextclaw/kernel@0.6.13`
- `@nextclaw/mcp@0.3.11`
- `@nextclaw/ncp@0.7.9`
- `@nextclaw/ncp-agent-runtime@0.4.9`
- `@nextclaw/ncp-agent-runtime-next@0.1.9`
- `@nextclaw/ncp-http-agent-client@0.4.9`
- `@nextclaw/ncp-http-agent-server@0.4.9`
- `@nextclaw/ncp-mcp@0.2.11`
- `@nextclaw/ncp-react@0.5.11`
- `@nextclaw/ncp-react-ui@0.3.9`
- `@nextclaw/ncp-toolkit@0.6.10`
- `@nextclaw/nextclaw-hermes-acp-bridge@0.3.9`
- `@nextclaw/nextclaw-narp-runtime-claude-code-sdk@0.2.10`
- `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.2.10`
- `@nextclaw/nextclaw-narp-runtime-opencode@0.2.12`
- `@nextclaw/nextclaw-narp-stdio-runtime-wrapper@0.3.10`
- `@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.3.9`
- `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.2.10`
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.2.9`
- `@nextclaw/nextclaw-ncp-runtime-http-client@0.3.9`
- `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.12`
- `@nextclaw/remote@0.3.13`
- `@nextclaw/runtime@0.4.11`
- `@nextclaw/server@0.15.13`
- `@nextclaw/service@0.3.13`
- `@nextclaw/shared@0.4.10`
- `@nextclaw/ui@0.15.13`
- `nextclaw@0.27.0`

`@nextclaw/desktop` 是 private workspace package，只同步内部版本元数据，不进入 NPM publish。
