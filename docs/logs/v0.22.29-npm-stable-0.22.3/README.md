# v0.22.29 NPM stable 0.22.3

## 迭代完成说明

本次完成 NextClaw NPM 正式版 patch 发布，发布目标为 `nextclaw@0.22.3`，对应 npm `latest` dist-tag。

发布在隔离 worktree 中完成：

- worktree：`/tmp/nextclaw-npm-stable-20260713-U9pLbC`
- release 分支：`codex/release-npm-stable-20260713`
- 纳入的源码提交：`404acd9e6`、`b58cca38d`、`4aadfe77f`
- release version commit：`c187d41b7`

本次面向用户的主要变化：

- 聊天文件附件可以打开到 workspace preview。
- 消息图片支持全屏 lightbox 预览。
- Claude Code runtime 支持 Runtime 默认模型选择，同时保留显式模型的隔离 provider 路由。
- 工具活动展示、附件操作、焦点控制与多处 UI 表面完成 patch 级优化。
- Codex runtime 默认模型兼容性与 marketplace detail 回填能力进入同批正式发布。

## 测试/验证/验收方式

发布前完成的源码与包级验证：

- `node_modules/.pnpm/node_modules/.bin/vitest run packages/extensions/nextclaw-ncp-runtime-claude-code-sdk/src`
- `node_modules/.pnpm/node_modules/.bin/vitest run packages/extensions/nextclaw-narp-runtime-claude-code-sdk/src`
- `node_modules/.pnpm/node_modules/.bin/tsc -p packages/extensions/nextclaw-ncp-runtime-claude-code-sdk/tsconfig.json`
- `node_modules/.pnpm/node_modules/.bin/tsc -p packages/extensions/nextclaw-narp-runtime-claude-code-sdk/tsconfig.json`
- `node_modules/.pnpm/node_modules/.bin/tsc -p packages/nextclaw-ui/tsconfig.json`
- `node_modules/.bin/eslint` 覆盖本批触达的 runtime、chat UI 与消息列表测试文件
- `../../node_modules/.pnpm/node_modules/.bin/vitest run src/components/chat/ui/chat-message-list/__tests__/chat-message-list.attachments.test.tsx`
- `../../node_modules/.pnpm/node_modules/.bin/tsc -p tsconfig.json`
- `../../node_modules/.bin/eslint "src/**/*.{ts,tsx}" vite.config.ts`
- `CI=true pnpm install --frozen-lockfile`
- `NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:check`
- `git diff --check`

发布后完成的 registry 与安装验收：

- `NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:verify:published` 返回 `published 49/49 package versions`。
- `NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:report:health` 返回 `Repository release health is clean.`。
- `npm view nextclaw version dist-tags --json` 返回 `version: 0.22.3`，`latest: 0.22.3`。
- `npm view @nextclaw/ui version dist-tags --json` 返回 `version: 0.15.3`，`latest: 0.15.3`。
- `npm view @nextclaw/nextclaw-narp-runtime-claude-code-sdk version dist-tags --json` 返回 `version: 0.2.3`，`latest: 0.2.3`。
- 从 registry 打包 `nextclaw@0.22.3`，tarball 检查 `dist/cli/launcher/index.js`、`dist/cli/app/index.js`、`resources/update-bundle-public.pem`、`ui-dist/index.html` 均存在。
- 非仓库临时目录安装 `nextclaw@0.22.3` 后，`nextclaw --version` 返回 `0.22.3`。
- 非仓库临时目录执行 `NEXTCLAW_HOME=<tmp>/home nextclaw update --check --json` 返回 `status: up-to-date`。

## 发布/部署方式

本次为 NPM-only 正式版 patch 发布，不包含 desktop installer、GitHub release、桌面 update manifest 或线上服务部署。

实际发布链路：

- `pnpm release:auto:changeset && pnpm release:version`
- `pnpm release:check`
- `pnpm release:publish`
- `pnpm release:verify:published`
- `pnpm release:report:health`

本次共发布并验证 49 个 public package versions，相关 package tag 均指向 release commit `c187d41b7`。

## 用户/产品视角的验收步骤

用户可按以下方式验证本次正式版：

1. 在任意非仓库目录执行 `npm install nextclaw@latest`。
2. 执行 `npx nextclaw --version` 或安装目录中的 `nextclaw --version`，应返回 `0.22.3`。
3. 执行 `nextclaw update --check --json`，NPM runtime bundle 应显示当前版本 `0.22.3` 且状态为 `up-to-date`。
4. 打开聊天页面，验证文件附件可进入 workspace preview，图片消息可全屏预览，工具活动展示仍可正常折叠与查看。
5. 在 runtime 配置中使用 Claude Code 的 Runtime 默认模型配置，确认未显式选择模型时可以走默认模型，显式模型仍走对应 provider 路由。

## 可维护性总结汇总

本次发布本身主要由 changeset version、changelog、官网 release notes 与 `ui-dist` 构建产物组成；语义源码改动已在前序提交中完成并分别验证。

发布收口时保持了以下边界：

- 使用隔离 worktree 发布，避免混入后续未确认 WIP。
- 只执行 NPM stable patch 发布，不扩大到 desktop 或 GitHub release。
- 发布记录使用可复现命令与 registry 事实，不把临时过程判断写成长期产品说明。
- `release:report:health` 在发布后为 clean，说明仓库声明版本与 npm registry 发布状态一致。

## NPM 包发布记录

- 发布时间：2026-07-13
- 发布渠道：NPM `latest`
- 主包：`nextclaw@0.22.3`
- 发布账号：`peiiii`
- 发布数量：49 个 package versions
- 发布结果：`published 49/49 package versions`
- 健康检查：`Repository release health is clean.`
- tarball/install smoke 临时目录：`/tmp/nextclaw-npm-0.22.3-verify-0H5ytn`
- 桌面端发布：不适用，本次用户目标为 NPM 正式版
- GitHub release：不适用，本次用户目标为 NPM 正式版
- migration/deploy：不适用，本次无后端或数据库变更
