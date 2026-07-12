# v0.22.23 NPM 统一正式版发布

## 迭代完成说明

本次迭代完成 2026-07-12 的 NextClaw NPM 统一正式版发布闭环。主入口包 `nextclaw` 从 `0.22.1` 发布到 `0.22.2`，并将本轮已累积的公开 workspace 包统一提升到对应 patch 版本。

发布源码在隔离 worktree `/tmp/nextclaw-npm-unified-20260712-G1SRqO` 完成，release 分支为 `codex/release-npm-unified-20260712`，release 源提交为 `9713713e3`。

本次同时更新了：

- 各公开包 `package.json` 与 `CHANGELOG.md`
- `packages/nextclaw/ui-dist` NPM 包载荷
- 中英文官网 release note 与公开 JSON release note
- `scripts/release/release-auto-changeset.mjs` 的自动 changeset 文案，避免稳定版 changelog 继续出现 beta 专属措辞

## 测试/验证/验收方式

已完成的验证：

- `pnpm install --frozen-lockfile`
- `pnpm release:auto:changeset`
- `pnpm release:version`
- `node --check scripts/release/release-auto-changeset.mjs`
- `git diff --check`
- release note JSON parse 校验
- `test -s packages/nextclaw/resources/update-bundle-public.pem`
- `pnpm release:check`
- `pnpm release:publish`
- `pnpm release:report:health`

关键结果：

- `release:check` 覆盖本批 49 个公开包的 build 与 tsc。
- `release:verify:published` 返回 `published 49/49 package versions`。
- `release:report:health` 返回 `Repository release health is clean.`。

已发布包体冒烟：

- `npm view nextclaw version dist-tags --json` 确认 `latest` 为 `0.22.2`。
- `npm view @nextclaw/core version dist-tags --json` 确认 `latest` 为 `0.15.2`。
- `npm view @nextclaw/ui version dist-tags --json` 确认 `latest` 为 `0.15.2`。
- `npm pack nextclaw@0.22.2 --json` 确认 tarball 包含 `dist/cli/launcher/index.js`、`dist/cli/app/index.js`、`resources/update-bundle-public.pem`、`ui-dist/index.html`。
- 临时目录 `npm install nextclaw@0.22.2` 成功。
- 临时安装的 `nextclaw --version` 输出 `0.22.2`。
- `NEXTCLAW_HOME=<temp> nextclaw update --check --json` 返回 `status: up-to-date`。

## 发布/部署方式

发布命令：

```bash
NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:publish
```

发布脚本执行链路：

```text
release:sync-readmes
release:check-readmes
release:check:groups
release:check
changeset publish
release:verify:published
changeset tag
```

本次是 NPM 正式版发布，不包含桌面端 installer、桌面 update manifest、GitHub desktop release 或官网桌面下载链接更新。

## 用户/产品视角的验收步骤

用户可通过以下方式验证本次 NPM 正式版：

```bash
npm view nextclaw version
npm install -g nextclaw@0.22.2
nextclaw --version
nextclaw update --check --json
```

期望结果：

- `npm view nextclaw version` 返回 `0.22.2`。
- `nextclaw --version` 返回 `0.22.2`。
- 稳定 channel update check 返回 `status: up-to-date`。

## 可维护性总结汇总

本次发布主要是 release 元数据、changelog、官网 release note 与 NPM 包载荷更新。非测试语义代码只包含一处发布自动化文案修正：将自动 changeset 的默认说明从 beta 专属文案改为中性 release 文案，防止后续稳定版 changelog 再出现渠道污染。

本次没有修改产品运行逻辑、数据模型或迁移脚本；不涉及数据库 migration、线上服务 deploy 或服务端 API 冒烟。

## NPM 包发布记录

本次 `release:publish` 发布并验证了 49 个公开包版本：

- `nextclaw@0.22.2`
- `@nextclaw/agent-chat@0.3.1`
- `@nextclaw/agent-chat-ui@0.6.2`
- `@nextclaw/aigen@0.2.1`
- `@nextclaw/app-runtime@0.9.1`
- `@nextclaw/app-sdk@0.3.1`
- `@nextclaw/browser-connector@0.3.1`
- `@nextclaw/channel-extension-dingtalk@0.2.2`
- `@nextclaw/channel-extension-discord@0.2.2`
- `@nextclaw/channel-extension-email@0.2.2`
- `@nextclaw/channel-extension-feishu@0.2.2`
- `@nextclaw/channel-extension-qq@0.2.2`
- `@nextclaw/channel-extension-slack@0.2.2`
- `@nextclaw/channel-extension-telegram@0.2.2`
- `@nextclaw/channel-extension-wecom@0.2.2`
- `@nextclaw/channel-extension-weixin@0.2.2`
- `@nextclaw/channel-extension-whatsapp@0.2.2`
- `@nextclaw/client-sdk@0.5.2`
- `@nextclaw/companion@0.2.2`
- `@nextclaw/core@0.15.2`
- `@nextclaw/extension-sdk@0.3.2`
- `@nextclaw/feishu-core@0.3.1`
- `@nextclaw/kernel@0.6.2`
- `@nextclaw/mcp@0.3.2`
- `@nextclaw/ncp@0.7.2`
- `@nextclaw/ncp-agent-runtime@0.4.2`
- `@nextclaw/ncp-agent-runtime-next@0.1.2`
- `@nextclaw/ncp-http-agent-client@0.4.2`
- `@nextclaw/ncp-http-agent-server@0.4.2`
- `@nextclaw/ncp-mcp@0.2.2`
- `@nextclaw/ncp-react@0.5.2`
- `@nextclaw/ncp-react-ui@0.3.2`
- `@nextclaw/ncp-toolkit@0.6.2`
- `@nextclaw/nextclaw-hermes-acp-bridge@0.3.2`
- `@nextclaw/nextclaw-narp-runtime-claude-code-sdk@0.2.2`
- `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.2.2`
- `@nextclaw/nextclaw-narp-runtime-opencode@0.2.2`
- `@nextclaw/nextclaw-narp-stdio-runtime-wrapper@0.3.2`
- `@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.3.2`
- `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.2.2`
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.2.2`
- `@nextclaw/nextclaw-ncp-runtime-http-client@0.3.2`
- `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.2`
- `@nextclaw/remote@0.3.2`
- `@nextclaw/runtime@0.4.2`
- `@nextclaw/server@0.15.2`
- `@nextclaw/service@0.3.2`
- `@nextclaw/shared@0.4.2`
- `@nextclaw/ui@0.15.2`
