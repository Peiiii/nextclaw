# NextClaw 0.29.0 NPM Minor 发布

## 迭代完成说明

本批把本地 `master` 的 23 个未发布 changeset 统一版本化为 `nextclaw@0.29.0`，其余公开 workspace package 按依赖闭包跟随。选择 minor 的整体依据是批次新增了 Native 长任务自动上下文压缩、消息编辑与继续运行、工作区文件引用、Provider 模型目录和 Exa 搜索等明显的向后兼容新能力。

发布前 fresh release check 暴露了一个跨包 TypeScript 缺陷：`nextclaw-ncp-runtime-stdio-client` 的内部工具文件使用了只在本包 tsconfig 中存在的私有路径别名，OpenCode runtime 通过公共源码入口检查该依赖时无法解析。定向复现确认根因后，导入已改为包内相对路径；相关两个 package 的 TypeScript、附件输入测试和完整发布闭包均重新通过。修复的是错误的包内依赖边界，不是跳过检查或降低并发。

中英文产品更新说明和结构化 JSON 已加入仓库，stable runtime 的 `releaseNotesUrl` 将指向 0.29.0 英文公开页面。

## 测试/验证/验收方式

- NPM 身份：`peiiii`。
- `pnpm release:check:health`、`pnpm release:check:groups`：通过。
- `pnpm release:version`：完成，`nextclaw` 版本为 `0.29.0`。
- `pnpm -C apps/docs build`：通过，中英文更新页和 JSON 已进入文档构建。
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client tsc`：通过。
- `pnpm --filter @nextclaw/nextclaw-narp-runtime-opencode tsc`：通过。
- stdio runtime 附件输入定向测试：2/2 通过。
- `NEXTCLAW_RELEASE_CHECK_RESET=1 pnpm release:check` 首轮捕获跨包路径别名缺陷；修复后从同一 checkpoint 继续，43/43 个公开包 build 与 TypeScript 全部通过。
- `pnpm check:skill-progressive-loading`、`pnpm check:governance-backlog-ratchet`：通过。
- Registry publish、stable runtime、公开 manifest、真实安装与 update 验证：待本次发布闭环完成后回填。

## 发布/部署方式

- NPM：使用仓库标准 `pnpm release:publish` 发布完整公开依赖闭包，不使用 raw `npm publish`。
- Runtime update：NPM 发布与 tag 推送完成后触发 stable runtime `0.29.0`。
- Docs：随 `master` 推送发布中英文说明和结构化 JSON。
- Desktop installer / manifest：不适用，本次不制作新的桌面安装包。
- 数据库 migration / 独立后端部署：不适用。

## 用户/产品视角的验收步骤

1. 从公开 registry 安装 `nextclaw@0.29.0`，确认 `nextclaw --version` 返回 `0.29.0`。
2. 从 stable runtime manifest 检查四个平台资产、签名、兼容 floor 和 0.29.0 更新说明 URL。
3. 在隔离 `NEXTCLAW_HOME` 中执行 update check，并从旧版本完成 download/apply 到 0.29.0。
4. 打开中英文 0.29.0 产品更新页与结构化 JSON，确认公开可访问且内容一致。

## 可维护性总结汇总

发布版本只判断产品包 `nextclaw` 的整体 patch/minor 语义，其余 workspace package 交给 changeset 和依赖闭包统一处理，避免逐包重复裁决。发布检查发现的私有 alias 泄漏已通过删除跨边界隐含条件、改用包内相对导入修复，没有新增 adapter 或并行入口。版本说明、发布记录和生成产物沿用既有 owner 与目录；发布结束前还会运行 diff-only maintainability guard 并清理生成物漂移。

## NPM 包发布记录

需要发布，原因是本批包含用户可见的新能力与修复。以下 43 个公开包已完成版本化和发布前验证，当前均为待统一发布：

- `@nextclaw/agent-chat-ui@0.6.21`
- `@nextclaw/ncp@0.7.16`
- `@nextclaw/ncp-agent-runtime@0.4.16`
- `@nextclaw/ncp-agent-runtime-next@0.1.16`
- `@nextclaw/ncp-http-agent-client@0.4.16`
- `@nextclaw/ncp-http-agent-server@0.4.16`
- `@nextclaw/ncp-react-ui@0.3.16`
- `@nextclaw/ncp-toolkit@0.6.18`
- `@nextclaw/ncp-react@0.5.20`
- `@nextclaw/nextclaw-hermes-acp-bridge@0.3.16`
- `@nextclaw/nextclaw-narp-stdio-runtime-wrapper@0.3.17`
- `@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.3.17`
- `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.2.18`
- `@nextclaw/nextclaw-narp-runtime-claude-code-sdk@0.2.18`
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.2.17`
- `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.2.18`
- `@nextclaw/nextclaw-ncp-runtime-http-client@0.3.16`
- `@nextclaw/shared@0.4.19`
- `@nextclaw/core@0.15.20`
- `@nextclaw/extension-sdk@0.3.19`
- `@nextclaw/channel-extension-dingtalk@0.2.20`
- `@nextclaw/channel-extension-discord@0.2.20`
- `@nextclaw/channel-extension-email@0.2.20`
- `@nextclaw/channel-extension-feishu@0.2.20`
- `@nextclaw/channel-extension-qq@0.2.19`
- `@nextclaw/channel-extension-slack@0.2.20`
- `@nextclaw/channel-extension-telegram@0.2.20`
- `@nextclaw/channel-extension-wecom@0.2.20`
- `@nextclaw/channel-extension-weixin@0.2.20`
- `@nextclaw/channel-extension-whatsapp@0.2.20`
- `@nextclaw/mcp@0.3.20`
- `@nextclaw/ncp-mcp@0.2.20`
- `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.21`
- `@nextclaw/nextclaw-narp-runtime-opencode@0.2.21`
- `@nextclaw/runtime@0.4.20`
- `@nextclaw/kernel@0.6.22`
- `@nextclaw/server@0.15.22`
- `@nextclaw/client-sdk@0.5.22`
- `@nextclaw/companion@0.2.22`
- `@nextclaw/remote@0.3.22`
- `@nextclaw/service@0.3.23`
- `@nextclaw/ui@0.15.23`
- `nextclaw@0.29.0`

`@nextclaw/desktop` 是 private workspace package，只同步内部版本元数据，不进入 NPM publish。
