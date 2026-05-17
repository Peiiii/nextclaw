# v0.18.67 NPM Stable Release

## 迭代完成说明

完成一次正式 NPM stable 发布批次。发布前通过仓库 release check，发布过程中 `@nextclaw/channel-extension-feishu@0.1.1` 曾出现 npm packument 短暂 404，但 access 与 dist-tag 已存在；等待 registry 收敛后恢复，并完成安装验收。

## 测试/验证/验收方式

- `pnpm release:check`：正式批次 build/tsc 通过。
- `pnpm release:verify:published`：确认 50/50 个包版本已发布。
- `npm view nextclaw dist-tags --json`：确认 `latest` 指向 `0.19.7`。
- `npm install --prefix <tmp> nextclaw@latest`：隔离安装通过。
- `<tmp>/node_modules/.bin/nextclaw --version`：输出 `0.19.7`。
- `NEXTCLAW_HOME=<tmp-home> <tmp>/node_modules/.bin/nextclaw update --check`：确认 runtime `0.19.7` 已是最新。

## 发布/部署方式

通过仓库 NPM release 流程发布：

- `pnpm release:auto`：生成 changeset 并执行版本 bump，首次在 `changeset version` 因本机内存压力被 kill，随后以受控方式续跑成功。
- `pnpm release:publish`：执行 README 检查、release check、changeset publish、registry verification；第一次 verification 等待新包 registry 收敛超时，收敛后补跑验证成功。

本次不涉及后端数据库 migration、线上 API deploy 或桌面安装包发布。

## 用户/产品视角的验收步骤

用户现在通过 `npm install -g nextclaw@latest` 获取 `nextclaw@0.19.7`。隔离安装已验证 CLI 可运行，并且 stable runtime update check 能从已发布包中读取更新公钥与运行时信息。

## 可维护性总结汇总

本次为发布版本与构建产物同步，不是功能实现或重构。未引入新业务逻辑；版本、CHANGELOG 与 `nextclaw` UI dist 由仓库发布流程生成。发布前校验覆盖了批次包的 build 和 tsc；release check 默认未启用 lint。

## NPM 包发布记录

需要发布：是。原因是用户明确要求发布正式 NPM 包，并且仓库存在完整 public release batch。

已发布并验证：

- `nextclaw@0.19.7`
- `@nextclaw/agent-chat@0.1.15`
- `@nextclaw/agent-chat-ui@0.3.17`
- `@nextclaw/app-runtime@0.7.5`
- `@nextclaw/app-sdk@0.1.5`
- `@nextclaw/channel-extension-feishu@0.1.1`
- `@nextclaw/channel-extension-weixin@0.1.4`
- `@nextclaw/channel-plugin-dingtalk@0.2.48`
- `@nextclaw/channel-plugin-discord@0.2.48`
- `@nextclaw/channel-plugin-email@0.2.48`
- `@nextclaw/channel-plugin-mochat@0.2.48`
- `@nextclaw/channel-plugin-qq@0.2.48`
- `@nextclaw/channel-plugin-slack@0.2.48`
- `@nextclaw/channel-plugin-telegram@0.2.48`
- `@nextclaw/channel-plugin-wecom@0.2.48`
- `@nextclaw/channel-plugin-whatsapp@0.2.48`
- `@nextclaw/channel-runtime@0.4.34`
- `@nextclaw/client-sdk@0.1.5`
- `@nextclaw/companion@0.1.5`
- `@nextclaw/core@0.12.17`
- `@nextclaw/extension-sdk@0.1.4`
- `@nextclaw/feishu-core@0.2.11`
- `@nextclaw/kernel@0.1.6`
- `@nextclaw/mcp@0.1.82`
- `@nextclaw/ncp@0.5.10`
- `@nextclaw/ncp-agent-runtime@0.3.20`
- `@nextclaw/ncp-http-agent-client@0.3.22`
- `@nextclaw/ncp-http-agent-server@0.3.22`
- `@nextclaw/ncp-mcp@0.1.84`
- `@nextclaw/ncp-react@0.4.30`
- `@nextclaw/ncp-react-ui@0.2.22`
- `@nextclaw/ncp-toolkit@0.5.15`
- `@nextclaw/nextclaw-hermes-acp-bridge@0.1.9`
- `@nextclaw/nextclaw-narp-runtime-claude-code-sdk@0.1.7`
- `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.1.8`
- `@nextclaw/nextclaw-narp-stdio-runtime-wrapper@0.1.4`
- `@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.1.9`
- `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.1.32`
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.31`
- `@nextclaw/nextclaw-ncp-runtime-http-client@0.1.9`
- `@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk@0.1.63`
- `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk@0.1.65`
- `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.10`
- `@nextclaw/openclaw-compat@1.0.17`
- `@nextclaw/remote@0.1.94`
- `@nextclaw/runtime@0.2.49`
- `@nextclaw/server@0.12.17`
- `@nextclaw/service@0.1.8`
- `@nextclaw/shared@0.1.4`
- `@nextclaw/ui@0.12.25`

发布后状态：

- `nextclaw` dist-tag：`latest = 0.19.7`，`beta = 0.18.12-beta.22`。
- `@nextclaw/channel-extension-feishu` dist-tag：`latest = 0.1.1`。
