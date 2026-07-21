# NextClaw 0.27.1 NPM Patch 发布

## 迭代完成说明

本次发布目标为 `nextclaw@0.27.1`，采用 full public workspace patch batch，共 49 个公开包，确保 `nextclaw` 安装包、`@nextclaw/ui` 与 `@nextclaw/agent-chat-ui` 使用同一批已发布依赖。

用户可见变化只有一项：流式回复期间，用户主动向上滚动超过 10px 后可以稳定退出自动贴底，后续内容继续增长也不会夺回视图位置。中英文产品更新说明与结构化 JSON 已发布到两个生产域；NPM、stable runtime channel 与公开升级链路均已完成验证。

本次不配图：修复的是持续流式输出期间的时间性滚动行为，静态截图无法真实证明修复结果。X 帖不适用：这是单项稳定性 patch，不扩大为社交媒体发布。

## 测试/验证/验收方式

发布准备阶段已完成：

- NPM 身份：`peiiii`。
- 本地 `master` 已吸收 `origin/master` 的最新 metrics 提交，本次修复位于其上。
- `pnpm release:check:health`：通过，当前批次之外无未发布漂移，workspace 版本不落后稳定 tag。
- `pnpm release:auto:changeset`、`pnpm release:version`：完成 full public workspace 版本化，`nextclaw` 为 `0.27.1`。
- 修复定向测试 5/5、`@nextclaw/agent-chat-ui` TypeScript、lint、build、真实浏览器流式滚动验收及治理检查均已通过，详见 `docs/logs/v0.26.12-chat-sticky-scroll-escape/README.md`。
- `NEXTCLAW_RELEASE_CHECK_RESET=1 pnpm release:check:strict`：从空 checkpoint 完成 49 个公开包的 build、TypeScript 与 lint，0 个阻断错误；输出中的 lint 项均为既有 warning。
- `pnpm -C apps/docs build`、发布说明 JSON 解析、`pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet` 与 `git diff --check`：通过。
- 当前 workspace tarball 合同检查：`nextclaw@0.27.1` 不含 `workspace:*` 依赖，并包含 app CLI、launcher CLI、update public key 与 `ui-dist/index.html`。
- 打包 UI 中已确认存在 10px 默认阈值和用户逃逸时取消待执行滚动帧的逻辑，避免源码修复未进入 NPM 资产。
- `pnpm release:publish`：49/49 个公开包发布成功，Changesets 创建的 49 个 tag 已推送；`nextclaw@0.27.1`、`@nextclaw/ui@0.15.14` 与 `@nextclaw/agent-chat-ui@0.6.14` 的 `latest` 均指向本批次版本。
- 公开 registry tarball：`nextclaw@0.27.1` 的 integrity 为 `sha512-8nAcJbatKhr0UB6JnHLwUBmSGHGGmbmLIdT+htOYwbWL+Xk8wQYAbU7O7db2C3V543ag0Y/f4wj9I7sXsafVsw==`，无 `workspace:*` 依赖，必要 CLI、public key 和 UI 资产完整。
- 公开安装冒烟：从 registry 安装 `nextclaw@0.27.1` 后，`--version` 返回 `0.27.1`；不注入自定义公钥时 `update --check --json` 正常，证明发布包可发现内置更新公钥。
- stable runtime workflow [`29857081621`](https://github.com/Peiiii/nextclaw/actions/runs/29857081621)：四个平台构建、签名、release asset 上传和 gh-pages 发布全部成功。
- 四份公开 stable manifest：darwin-arm64、darwin-x64、linux-x64、win32-x64 均为 `latestVersion=0.27.1`、`minimumLauncherVersion=0.18.11`、`hostKind=npm-runtime-bundle`，bundle hash、bundle signature 与 manifest signature 均非空，`releaseNotesUrl` 指向本次英文更新说明。
- 旧版升级实测：从公开 registry 隔离安装 `nextclaw@0.27.0`，在未注入自定义公钥的环境中依次执行 stable 检查、下载和应用；状态从 `update-available` 进入 `downloaded`、`restart-required`，随后同一 CLI 进程入口的 `--version` 返回 `0.27.1`。
- Docs Deploy workflow [`29857076903`](https://github.com/Peiiii/nextclaw/actions/runs/29857076903)：全球站、国内站及双域同产物验证全部成功；`docs.nextclaw.io` 与 `docs.nextclaw.net` 的中英文说明页和结构化 JSON 均返回 HTTP 200。
- 旁路 CI 审计：`windows-update-smoke` 因既有工作流仍调用已移除的 `update --timeout` 失败；`desktop-validate` 的 Windows 临时目录长短路径断言和 Linux AppImage 初始化冒烟失败。这两组工作流在 `0.27.0` 及更早连续多次 master 运行中已有相同失败，本次修复与版本提交未触达对应源码或工作流；同轮 macOS DMG、desktop runtime、Windows installer 冒烟通过，因此不把既有旁路失败误判为本次 NPM/runtime 发布回归，也不表述为全仓 CI 全绿。

## 发布/部署方式

- NPM：使用仓库标准 `pnpm release:publish`，不使用 raw `npm publish`。
- Runtime update：已通过 stable runtime workflow 发布 `0.27.1`，GitHub Release 为 [`nextclaw@0.27.1`](https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.27.1)。
- Docs：中英文 `0.27.1` 更新说明与结构化 JSON 已发布，runtime manifest 的 `releaseNotesUrl` 指向英文说明页。
- Desktop installer / manifest：不适用，本次没有新的桌面安装包。
- 数据库 migration / 独立后端部署：不适用，本次只修复前端会话滚动行为。

## 用户/产品视角的验收步骤

1. 从公开 registry 安装 `nextclaw@0.27.1`，确认 CLI 和依赖闭包版本正确。
2. 在流式回复期间向上滚动超过 10px，确认后续内容不会把视图重新拉到底部。
3. 使用独立 `NEXTCLAW_HOME` 验证 stable 更新检查、下载和应用链路。
4. 打开中英文产品更新说明与结构化 JSON，确认内容一致且 runtime manifest 的 `releaseNotesUrl` 可访问。

## 可维护性总结汇总

本次发布操作只新增必要的版本号、changelog、产品更新说明、结构化 JSON 和发布记录，不新增产品语义源码。修复本身的生产代码净减少 5 行，并把排队滚动任务的取消生命周期收敛到共享 sticky scroll owner；发布闭环继续运行严格 release check、governance 与生成产物清理，避免留下构建漂移。

## NPM 包发布记录

以下 49 个公开包已完成 patch 发布，并通过 registry 49/49 版本校验：

- `@nextclaw/agent-chat@0.3.8`
- `@nextclaw/agent-chat-ui@0.6.14`
- `@nextclaw/aigen@0.2.8`
- `@nextclaw/app-runtime@0.9.8`
- `@nextclaw/app-sdk@0.3.8`
- `@nextclaw/browser-connector@0.3.8`
- `@nextclaw/channel-extension-dingtalk@0.2.12`
- `@nextclaw/channel-extension-discord@0.2.12`
- `@nextclaw/channel-extension-email@0.2.12`
- `@nextclaw/channel-extension-feishu@0.2.12`
- `@nextclaw/channel-extension-qq@0.2.11`
- `@nextclaw/channel-extension-slack@0.2.12`
- `@nextclaw/channel-extension-telegram@0.2.12`
- `@nextclaw/channel-extension-wecom@0.2.12`
- `@nextclaw/channel-extension-weixin@0.2.12`
- `@nextclaw/channel-extension-whatsapp@0.2.12`
- `@nextclaw/client-sdk@0.5.14`
- `@nextclaw/companion@0.2.14`
- `@nextclaw/core@0.15.12`
- `@nextclaw/extension-sdk@0.3.11`
- `@nextclaw/feishu-core@0.3.8`
- `@nextclaw/kernel@0.6.14`
- `@nextclaw/mcp@0.3.12`
- `@nextclaw/ncp@0.7.10`
- `@nextclaw/ncp-agent-runtime@0.4.10`
- `@nextclaw/ncp-agent-runtime-next@0.1.10`
- `@nextclaw/ncp-http-agent-client@0.4.10`
- `@nextclaw/ncp-http-agent-server@0.4.10`
- `@nextclaw/ncp-mcp@0.2.12`
- `@nextclaw/ncp-react@0.5.12`
- `@nextclaw/ncp-react-ui@0.3.10`
- `@nextclaw/ncp-toolkit@0.6.11`
- `@nextclaw/nextclaw-hermes-acp-bridge@0.3.10`
- `@nextclaw/nextclaw-narp-runtime-claude-code-sdk@0.2.11`
- `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.2.11`
- `@nextclaw/nextclaw-narp-runtime-opencode@0.2.13`
- `@nextclaw/nextclaw-narp-stdio-runtime-wrapper@0.3.11`
- `@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.3.10`
- `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.2.11`
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.2.10`
- `@nextclaw/nextclaw-ncp-runtime-http-client@0.3.10`
- `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.13`
- `@nextclaw/remote@0.3.14`
- `@nextclaw/runtime@0.4.12`
- `@nextclaw/server@0.15.14`
- `@nextclaw/service@0.3.14`
- `@nextclaw/shared@0.4.11`
- `@nextclaw/ui@0.15.14`
- `nextclaw@0.27.1`

`@nextclaw/desktop` 是 private workspace package，只同步内部版本元数据，不进入 NPM publish。
