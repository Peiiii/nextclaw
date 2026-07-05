# v0.22.8 NPM patch release

## 迭代完成说明

本次完成 NextClaw NPM stable patch 发布。发布目标是把当前已提交的用户可见修复与增强，通过 NPM `latest` 推到 `nextclaw@0.22.1`，同时保护主工作区未提交 WIP。

关键处理：

- 在隔离 worktree `codex/release-npm-patch-20260706-015844` 发布，避免主工作区未提交的 landing / screenshot 改动进入发布包。
- 将待发布的 `structured-update-release-notes` changeset 从 minor 调整为 patch，使本次发布符合用户明确要求的 patch 版本目标。
- 执行 Changesets version，消费 8 个 changeset，并生成 `nextclaw@0.22.1` 与公共 workspace 依赖闭包版本。
- 新增中英文用户更新笔记和结构化 release notes JSON：
  - `apps/docs/zh/notes/2026-07-06-nextclaw-v0-22-1.md`
  - `apps/docs/en/notes/2026-07-06-nextclaw-v0-22-1.md`
  - `apps/docs/public/release-notes/nextclaw-v0.22.1.json`

## 测试/验证/验收方式

已执行：

- `NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc npm whoami`
  - 结果：`peiiii`
- `pnpm install --frozen-lockfile`
  - 结果：通过；隔离 worktree 安装依赖。
- `pnpm release:report:health`
  - 结果：仓库外部发布健康状态干净。
- `pnpm release:version`
  - 结果：生成 `nextclaw@0.22.1`、`@nextclaw/ui@0.15.1` 等 patch 版本。
- `node -e "JSON.parse(...nextclaw-v0.22.1.json...)"`
  - 结果：结构化 release notes JSON 可解析。
- `pnpm -C packages/extensions/nextclaw-feishu-core build`
  - 结果：通过；为干净 worktree 补齐非本批依赖的类型产物。
- `pnpm release:check`
  - 结果：通过；覆盖本批 build 和 `tsc`。第一次因干净 worktree 缺少 `@nextclaw/feishu-core` dist 失败，补构建后重跑通过。
- `git diff --check`
  - 结果：通过。
- `NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:publish`
  - 结果：发布成功；`release:verify:published` 确认 `published 43/43 package versions`。
- `NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc npm view nextclaw version dist-tags dependencies --json`
  - 结果：`latest` 为 `0.22.1`，依赖闭包指向同批 `@nextclaw/*@*.1`。
- `NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc npm pack nextclaw@0.22.1 --json`
  - 结果：tarball 包含：
    - `dist/cli/launcher/index.js`
    - `dist/cli/app/index.js`
    - `resources/update-bundle-public.pem`
    - `ui-dist/index.html`
- 临时目录安装真实 published 包：
  - `npm install --prefix <tmp> nextclaw@0.22.1`
  - `<tmp>/node_modules/.bin/nextclaw --version`
  - `NEXTCLAW_HOME=<tmp-home> <tmp>/node_modules/.bin/nextclaw update --check --json`
  - 结果：`--version` 返回 `0.22.1`；update check 返回 `installationKind: "npm-runtime-bundle"`、`status: "up-to-date"`。

## 发布/部署方式

发布方式：

- NPM stable patch release。
- 发布命令：`NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:publish`
- Release commit：`f770cc501 chore: release npm patch 0.22.1`
- NPM dist-tag：`nextclaw@latest -> 0.22.1`

不适用项：

- 数据库 migration：不涉及后端数据库结构变更。
- 远程 deploy：本次仅发布 NPM 包，不部署服务。
- runtime update channel：本次用户要求 NPM patch，未触发 runtime manifest 发布；真实安装 update check 返回 up-to-date。
- desktop release：不涉及。
- GitHub release：不涉及。
- docs 站部署：本次只随 release commit 增加 docs 源文件和结构化 JSON，未执行 docs deploy。

## 用户/产品视角的验收步骤

用户可以通过 NPM 安装或更新到 stable patch：

```bash
npm install -g nextclaw@latest
nextclaw --version
```

期望结果：

- `nextclaw --version` 显示 `0.22.1`。
- 已安装的 NPM 包包含 launcher、app runtime 入口、UI assets 和 update bundle public key。
- `nextclaw update --check --json` 在 isolated `NEXTCLAW_HOME` 下返回 up-to-date，不需要额外设置 public key 环境变量。

## 可维护性总结汇总

本次 release commit 主要是版本、CHANGELOG、用户更新笔记、结构化 release notes JSON 和 NPM package payload 更新，不包含新的源码实现逻辑。

可维护性判断：

- 通过隔离 worktree 发布，避免主工作区 WIP 与 release metadata 混在一起。
- 使用 repo 标准 Changesets + `pnpm release:publish` 链路，没有手工 raw `npm publish`。
- `packages/nextclaw/ui-dist` 属于本次发布包 payload，hash 资产变更随 release commit 提交。
- 未运行 maintainability guard；原因是本次无新增源码实现逻辑，主要验证口径是 release contract、build/tsc、registry、tarball 和真实安装烟测。

## NPM 包发布记录

需要发布，原因：用户明确要求发布 NPM patch 版本；当前 `nextclaw@0.22.0` 之后存在已提交且带 changeset 的用户可见修复与增强。

发布状态：

- Registry：`https://registry.npmjs.org/`
- `release:verify:published`：`published 43/43 package versions`
- `nextclaw@latest`：`0.22.1`
- `@nextclaw/ui@latest`：`0.15.1`

已发布包：

- `@nextclaw/agent-chat-ui@0.6.1`
- `@nextclaw/channel-extension-dingtalk@0.2.1`
- `@nextclaw/channel-extension-discord@0.2.1`
- `@nextclaw/channel-extension-email@0.2.1`
- `@nextclaw/channel-extension-feishu@0.2.1`
- `@nextclaw/channel-extension-qq@0.2.1`
- `@nextclaw/channel-extension-slack@0.2.1`
- `@nextclaw/channel-extension-telegram@0.2.1`
- `@nextclaw/channel-extension-wecom@0.2.1`
- `@nextclaw/channel-extension-weixin@0.2.1`
- `@nextclaw/channel-extension-whatsapp@0.2.1`
- `@nextclaw/client-sdk@0.5.1`
- `@nextclaw/companion@0.2.1`
- `@nextclaw/core@0.15.1`
- `@nextclaw/extension-sdk@0.3.1`
- `@nextclaw/kernel@0.6.1`
- `@nextclaw/mcp@0.3.1`
- `@nextclaw/ncp-agent-runtime-next@0.1.1`
- `@nextclaw/ncp-agent-runtime@0.4.1`
- `@nextclaw/ncp-http-agent-client@0.4.1`
- `@nextclaw/ncp-http-agent-server@0.4.1`
- `@nextclaw/ncp-mcp@0.2.1`
- `@nextclaw/ncp-react-ui@0.3.1`
- `@nextclaw/ncp-react@0.5.1`
- `@nextclaw/ncp-toolkit@0.6.1`
- `@nextclaw/ncp@0.7.1`
- `@nextclaw/nextclaw-hermes-acp-bridge@0.3.1`
- `@nextclaw/nextclaw-narp-runtime-claude-code-sdk@0.2.1`
- `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.2.1`
- `@nextclaw/nextclaw-narp-runtime-opencode@0.2.1`
- `@nextclaw/nextclaw-narp-stdio-runtime-wrapper@0.3.1`
- `@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.3.1`
- `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.2.1`
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.2.1`
- `@nextclaw/nextclaw-ncp-runtime-http-client@0.3.1`
- `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.1`
- `@nextclaw/remote@0.3.1`
- `@nextclaw/runtime@0.4.1`
- `@nextclaw/server@0.15.1`
- `@nextclaw/service@0.3.1`
- `@nextclaw/shared@0.4.1`
- `@nextclaw/ui@0.15.1`
- `nextclaw@0.22.1`
