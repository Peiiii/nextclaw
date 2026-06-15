# v0.20.74-npm-beta-release

## 迭代完成说明

- 完成一次全量 public workspace NPM beta 发布，`nextclaw@beta` 更新到 `0.21.9-beta.0`。
- 本次发布使用仓库 release owner 流程推进；原始 `pnpm release:beta` 在预发布检查阶段暴露两个真实阻塞点，修复后继续完成 `pnpm release:publish`。
- 根因与确认：
  - `@nextclaw/nextclaw-narp-runtime-opencode` 的 release tsc 失败，是 `@nextclaw/nextclaw-ncp-runtime-stdio-client` 内部 utils 使用包内 alias 导致跨包构建无法解析；改为同包相对导入后，stdio client 与 opencode 定向 tsc 均通过。
  - `@nextclaw/companion` 的 release tsc 失败，是 package tsc 把 `src/**/*.test.ts` 纳入发布编译，而 companion 包发布依赖里不提供 `vitest`；在 package tsconfig 中排除测试文件后，companion tsc 与 build 均通过。
- 本次修复针对发布阻塞根因，没有绕过 release check，也没有跳过 publish verification。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client tsc`：通过。
- `pnpm --filter @nextclaw/nextclaw-narp-runtime-opencode tsc`：通过。
- `pnpm --filter @nextclaw/companion tsc`：通过。
- `pnpm --filter @nextclaw/companion build`：通过。
- `git diff --check`：通过。
- `pnpm release:publish`：通过，包含 `release:sync-readmes`、`release:check-readmes`、`release:check:groups`、`release:check`、`changeset publish`、`release:verify:published`、`changeset tag`。
- `pnpm release:verify:published`：通过，NPM registry 确认 `published 49/49 package versions`。
- `npm view nextclaw@beta version`：`0.21.9-beta.0`。
- `npm view nextclaw dist-tags --json`：`beta=0.21.9-beta.0`，`latest=0.21.8`。
- `pnpm release:beta:runtime -- --version 0.21.9-beta.0`：通过，runtime workflow 成功，release assets 与 gh-pages manifest 已发布。
- 公网 manifest 验证：`darwin-arm64`、`darwin-x64`、`linux-x64`、`win32-x64` 均为 `latestVersion=0.21.9-beta.0`、`hostKind=npm-runtime-bundle`、`minimumLauncherVersion=0.18.11`。
- `pnpm -C packages/nextclaw validation:npm-update -- --published-beta`：通过，临时 prefix 安装的 `nextclaw@beta` 版本为 `0.21.9-beta.0`，发布包依赖闭包中的 `InputBudgetPruner.estimate/prune` 均可用。
- 真实 runtime update smoke：临时 prefix 安装 `nextclaw@latest` `0.21.8`，隔离 `NEXTCLAW_HOME` 下执行 `update --channel beta --check --json`、`update --channel beta --download-only --json`、`update --apply --json`，最终 `nextclaw --version` 输出 `0.21.9-beta.0`，runtime pointer 为 `0.21.9-beta.0`。

## 发布/部署方式

- NPM 发布：全量 public workspace beta batch。
- Release commit：`f8dfffac4 chore: release beta batch`。
- Prerelease mode commit：`07761c2de chore: enter beta prerelease mode`。
- Package tags：49 个 package tag 已重锚并推送到 release commit `f8dfffac4`。
- Runtime workflow：`https://github.com/Peiiii/nextclaw/actions/runs/27567333310`。
- Runtime release：`https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.21.9-beta.0`。
- Public manifest base：`https://peiiii.github.io/nextclaw/npm-runtime-updates/beta/`。

## 用户/产品视角的验收步骤

1. 使用真实 NPM registry 安装 `nextclaw@beta`。
2. 运行 `nextclaw --version`，预期输出 `0.21.9-beta.0`。
3. 从旧的 `nextclaw@latest` `0.21.8` 安装态运行 `nextclaw update --channel beta --check --json`，预期看到 `status=update-available` 且 `availableVersion=0.21.9-beta.0`。
4. 运行 `nextclaw update --channel beta --download-only --json`，预期看到 `status=downloaded` 且 `downloadedVersion=0.21.9-beta.0`。
5. 运行 `nextclaw update --apply --json`，预期看到 `status=restart-required` 且 `currentVersion=0.21.9-beta.0`。
6. 再运行 `nextclaw --version`，预期输出 `0.21.9-beta.0`。

## 可维护性总结汇总

- 本次发布没有引入新的 release 抽象；优先复用现有 `pnpm release:beta`、`pnpm release:publish`、`pnpm release:beta:runtime` 和发布验证脚本。
- 发布过程中修复的两个阻塞点均收敛在真实 owner：
  - stdio runtime client 的同包内部 import 回到相对路径，避免把包内 tsconfig alias 泄漏给下游 release tsc。
  - companion package 的发布 tsconfig 明确排除测试文件，避免发布编译依赖测试框架。
- `packages/nextclaw/ui-dist` 是发布包内容，本次已随 release commit 提交，没有留在工作区。
- 自动 changeset 已写入 `.changeset/pre.json`，同步随 release commit 提交，避免 prerelease 状态引用不存在的 changeset id。
- 代码净增来自版本/changelog/发布资产与两处 release 阻塞修复；作为发布闭环改动，不适用非功能语义代码净增小于等于 0 的优化目标。

## NPM 包发布记录

- 发布范围：全量 public workspace beta batch，49 个 package versions。
- 发布状态：NPM registry 已验证 `published 49/49 package versions`。
- `nextclaw`：`0.21.9-beta.0`，`beta` dist-tag 已指向该版本。
- Runtime update channel：`beta` 已发布，四个平台 runtime bundle assets 已上传，公网 manifest 已指向 `0.21.9-beta.0`。
- 具体包版本：
  - `@nextclaw/agent-chat@0.2.14-beta.0`
  - `@nextclaw/agent-chat-ui@0.5.1-beta.0`
  - `@nextclaw/aigen@0.1.6-beta.0`
  - `@nextclaw/app-runtime@0.8.14-beta.0`
  - `@nextclaw/app-sdk@0.2.14-beta.0`
  - `@nextclaw/browser-connector@0.2.4-beta.0`
  - `@nextclaw/channel-extension-dingtalk@0.1.19-beta.0`
  - `@nextclaw/channel-extension-discord@0.1.19-beta.0`
  - `@nextclaw/channel-extension-email@0.1.19-beta.0`
  - `@nextclaw/channel-extension-feishu@0.1.26-beta.0`
  - `@nextclaw/channel-extension-qq@0.1.23-beta.0`
  - `@nextclaw/channel-extension-slack@0.1.19-beta.0`
  - `@nextclaw/channel-extension-telegram@0.1.19-beta.0`
  - `@nextclaw/channel-extension-wecom@0.1.19-beta.0`
  - `@nextclaw/channel-extension-weixin@0.1.30-beta.0`
  - `@nextclaw/channel-extension-whatsapp@0.1.19-beta.0`
  - `@nextclaw/client-sdk@0.4.4-beta.0`
  - `@nextclaw/companion@0.1.32-beta.0`
  - `@nextclaw/core@0.14.5-beta.0`
  - `@nextclaw/extension-sdk@0.2.15-beta.0`
  - `@nextclaw/feishu-core@0.2.35-beta.0`
  - `@nextclaw/kernel@0.5.1-beta.0`
  - `@nextclaw/mcp@0.2.15-beta.0`
  - `@nextclaw/ncp@0.6.4-beta.0`
  - `@nextclaw/ncp-agent-runtime@0.3.45-beta.0`
  - `@nextclaw/ncp-agent-runtime-next@0.0.17-beta.0`
  - `@nextclaw/ncp-http-agent-client@0.3.46-beta.0`
  - `@nextclaw/ncp-http-agent-server@0.3.46-beta.0`
  - `@nextclaw/ncp-mcp@0.1.110-beta.0`
  - `@nextclaw/ncp-react@0.4.54-beta.0`
  - `@nextclaw/ncp-react-ui@0.2.46-beta.0`
  - `@nextclaw/ncp-toolkit@0.5.39-beta.0`
  - `@nextclaw/nextclaw-hermes-acp-bridge@0.2.14-beta.0`
  - `@nextclaw/nextclaw-narp-runtime-claude-code-sdk@0.1.32-beta.0`
  - `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.1.33-beta.0`
  - `@nextclaw/nextclaw-narp-runtime-opencode@0.1.13-beta.0`
  - `@nextclaw/nextclaw-narp-stdio-runtime-wrapper@0.2.14-beta.0`
  - `@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.2.14-beta.0`
  - `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.1.56-beta.0`
  - `@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.55-beta.0`
  - `@nextclaw/nextclaw-ncp-runtime-http-client@0.2.14-beta.0`
  - `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.14-beta.0`
  - `@nextclaw/remote@0.2.15-beta.0`
  - `@nextclaw/runtime@0.3.15-beta.0`
  - `@nextclaw/server@0.14.5-beta.0`
  - `@nextclaw/service@0.2.15-beta.0`
  - `@nextclaw/shared@0.3.1-beta.0`
  - `@nextclaw/ui@0.14.1-beta.0`
  - `nextclaw@0.21.9-beta.0`
