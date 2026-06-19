# v0.20.95 NPM stable 0.21.10

## 迭代完成说明

本次完成 NextClaw 正式版 NPM-only 发布。目标不是新增功能，而是把已经合入 `master` 的用户可见变更和 public workspace 依赖闭包发布到 NPM `latest`。

发布范围遵循 `npm-release-contract-guard`：`nextclaw` 依赖多个 `workspace:*` runtime 包，因此本次采用 public workspace batch，而不是只发布顶层 `nextclaw`。发布限定为 NPM registry；未触发 NPM runtime update channel、desktop release、GitHub release 或远程部署。

发布 commit：

- `010e0aab2e7f822138a13b4f58797f3236eea4dd` `chore: release npm stable 0.21.10`

## 测试/验证/验收方式

已执行：

- `pnpm release:report:health`
  - version 前：确认存在待发布漂移。
  - version 后：确认 current batch 外无漂移，并列出 49 个 registry missing 版本。
- `pnpm release:version`
  - 生成 `0.21.10` 稳定版版本和 changelog。
- `pnpm release:check`
  - 对 49 个 batch package 执行 build / tsc，结果通过。
- `pnpm release:publish`
  - 执行 readme check、publish guard、release check、changeset publish、registry verify 和 tag。
  - `release:verify:published` 结果：`published 49/49 package versions`。
- `npm view nextclaw version dist-tags dependencies --json`
  - `latest` 指向 `0.21.10`。
  - `nextclaw@0.21.10` 依赖闭包指向本次发布的 runtime 包版本。
- `npm pack nextclaw@0.21.10 --json`
  - tarball 包含 `dist/cli/launcher/index.js`。
  - tarball 包含 `dist/cli/app/index.js`。
  - tarball 包含 `resources/update-bundle-public.pem`。
- 临时目录安装 `nextclaw@latest` 并运行 `nextclaw --version`
  - 输出 `0.21.10`。
- 隔离 `NEXTCLAW_HOME` 运行 `nextclaw update --check --json`
  - `installationKind` 为 `npm-runtime-bundle`。
  - `hostVersion` 和 `currentVersion` 均为 `0.21.10`。
  - `status` 为 `up-to-date`。

## 发布/部署方式

发布方式：

- NPM registry stable publish。
- dist-tag：`latest`。
- 顶层用户安装包：`nextclaw@0.21.10`。

不适用项：

- Runtime update channel：用户限定“仅限 npm”，未触发 runtime workflow。
- Desktop installer / DMG / desktop update manifest：用户限定“仅限 npm”，未触发 desktop release。
- GitHub release：本次只发布 NPM，没有创建 GitHub release。
- Migration / deploy / online API smoke：本次没有后端数据库或线上部署变更。

## 用户/产品视角的验收步骤

用户可通过以下方式验收稳定 NPM 包：

```bash
npm view nextclaw version dist-tags --json
npm install -g nextclaw@latest
nextclaw --version
```

预期：

- `latest` 为 `0.21.10`。
- `nextclaw --version` 输出 `0.21.10`。

## 可维护性总结汇总

本次主要是 release metadata、package version、changelog 和 `packages/nextclaw/ui-dist` 发布资产更新，不是源码逻辑改造。

- 未新增源码逻辑抽象、owner、helper 或 fallback。
- `packages/nextclaw/ui-dist` 是 NPM 包内 UI payload，本次作为发布合同的一部分提交。
- `apps/desktop` 只发生 Changesets 依赖联动版本/changelog 更新，`@nextclaw/desktop` 为 `private: true`，未做 desktop 发布。
- 非功能源码语义净增：不适用，本次没有源码语义实现改动。
- maintainability guard / review：不适用，发布元数据与生成包资产更新不改变源码结构。

## NPM 包发布记录

本次需要 NPM 发布，因为 `nextclaw@0.21.9` 已是旧的 `latest`，当前仓库存在未发布的 public workspace batch，且顶层 `nextclaw` 的 workspace runtime 依赖闭包必须同步发布。

Registry 验证结果：`release:verify:published` 确认 `49/49` 个 package versions 已发布。

已发布：

- `@nextclaw/agent-chat@0.2.15`
- `@nextclaw/agent-chat-ui@0.5.2`
- `@nextclaw/aigen@0.1.7`
- `@nextclaw/app-runtime@0.8.15`
- `@nextclaw/app-sdk@0.2.15`
- `@nextclaw/browser-connector@0.2.5`
- `@nextclaw/feishu-core@0.2.36`
- `@nextclaw/ncp@0.6.5`
- `@nextclaw/ncp-agent-runtime@0.3.46`
- `@nextclaw/ncp-agent-runtime-next@0.0.18`
- `@nextclaw/ncp-http-agent-client@0.3.47`
- `@nextclaw/ncp-http-agent-server@0.3.47`
- `@nextclaw/ncp-react-ui@0.2.47`
- `@nextclaw/ncp-toolkit@0.5.40`
- `@nextclaw/ncp-react@0.4.55`
- `@nextclaw/nextclaw-hermes-acp-bridge@0.2.15`
- `@nextclaw/nextclaw-narp-stdio-runtime-wrapper@0.2.15`
- `@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.2.15`
- `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.1.57`
- `@nextclaw/nextclaw-narp-runtime-claude-code-sdk@0.1.33`
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.56`
- `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.1.34`
- `@nextclaw/nextclaw-ncp-runtime-http-client@0.2.15`
- `@nextclaw/shared@0.3.2`
- `@nextclaw/core@0.14.6`
- `@nextclaw/extension-sdk@0.2.16`
- `@nextclaw/channel-extension-dingtalk@0.1.20`
- `@nextclaw/channel-extension-discord@0.1.20`
- `@nextclaw/channel-extension-email@0.1.20`
- `@nextclaw/channel-extension-feishu@0.1.27`
- `@nextclaw/channel-extension-qq@0.1.24`
- `@nextclaw/channel-extension-slack@0.1.20`
- `@nextclaw/channel-extension-telegram@0.1.20`
- `@nextclaw/channel-extension-wecom@0.1.20`
- `@nextclaw/channel-extension-weixin@0.1.31`
- `@nextclaw/channel-extension-whatsapp@0.1.20`
- `@nextclaw/mcp@0.2.16`
- `@nextclaw/ncp-mcp@0.1.111`
- `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.15`
- `@nextclaw/nextclaw-narp-runtime-opencode@0.1.14`
- `@nextclaw/runtime@0.3.16`
- `@nextclaw/kernel@0.5.2`
- `@nextclaw/server@0.14.6`
- `@nextclaw/client-sdk@0.4.5`
- `@nextclaw/companion@0.1.33`
- `@nextclaw/remote@0.2.16`
- `@nextclaw/service@0.2.16`
- `@nextclaw/ui@0.14.2`
- `nextclaw@0.21.10`
