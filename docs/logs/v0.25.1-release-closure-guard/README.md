# v0.25.1 Release Closure Guard

## 迭代完成说明

本次迭代先处理发布机制性问题，再补发漏发包。

根因分为两层：

- 直接根因：`@nextclaw/core` 在 `nextclaw@0.25.0` 发布后仍有变更进入主线，但发布范围没有用阻塞式检查确认 package closure，导致依赖发布范围靠人工判断。
- 系统根因：`0.25.0` 的 release metadata、版本号、changelog、docs release notes 和生成产物停留在 release 分支，没有回流到目标主线；后续发布前也没有硬性校验“当前 package version 是否落后已发布稳定 tag”和“release 分支是否包含目标分支 release-relevant 变化”。

确认方式：

- `pnpm release:check:health` 在当前主线能明确发现多个公开包本地版本落后已发布稳定 tag，其中包括 `nextclaw`、`@nextclaw/core`、`@nextclaw/ui`、`@nextclaw/server`、`@nextclaw/kernel`。
- `pnpm release:check:branch-closure -- --target master --release codex/release-npm-minor-0.25.0` 能明确发现目标主线与 0.25.0 release 分支互相缺失 release-relevant 文件。

修复方式：

- 新增阻塞式 release health gate，发布 version / publish 前必须检查未发布 drift 和本地版本落后 stable tag 的问题。
- 新增 release branch closure gate，基于 merge-base 对比目标分支与 release 分支的 release-relevant 变化，防止 registry 已发布但主线未闭合。
- 将两个闸门沉淀到 NPM release flow 与 isolated worktree release skill，后续不能只靠口头流程或人工记忆。

## 测试/验证/验收方式

- `node --check scripts/release/report-release-health.mjs`
- `node --check scripts/release/check-release-branch-closure.mjs`
- `git diff --check`
- `pnpm release:check:health`：预期失败，用于证明当前坏状态会被阻塞。
- `pnpm release:check:branch-closure -- --target master --release codex/release-npm-minor-0.25.0`：预期失败，用于证明 0.25.0 release 分支未回流会被阻塞。

0.25.1 release worktree 补充验证：

- `pnpm release:version`
- `pnpm --filter @nextclaw/docs build`
- `pnpm release:check`
- `pnpm release:check:health`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `pnpm --filter @nextclaw/core test -- src/features/agent/features/tests/skills.test.ts`
- `pnpm --filter @nextclaw/service test -- src/services/runtime/npm-runtime-update-host.service.test.ts`
- `pnpm --filter @nextclaw/ui test -- src/shared/components/common/__tests__/brand-header.test.tsx src/features/system-status/components/__tests__/desktop-update-config.test.tsx src/features/chat/features/input/hooks/__tests__/use-chat-input-surface-state.test.tsx`

0.25.1 发布后验证：

- `pnpm release:publish`：发布完成，`release:verify:published` 确认 `27/27` package versions 已发布。
- `pnpm release:stable:runtime -- --version 0.25.1 --release-tag nextclaw@0.25.1 --branch codex/release-npm-patch-0.25.1`：GitHub Actions workflow `29576939861` 成功，public stable manifest 验证通过。
- `npm view nextclaw version dist-tags dependencies --json`：确认 `nextclaw@latest = 0.25.1`，且 `nextclaw@0.25.1` 依赖 `@nextclaw/core@0.15.6`。
- 隔离安装 `nextclaw@0.25.0` 后执行 `nextclaw update --channel stable --check`：确认输出 `Runtime update available: 0.25.0 -> 0.25.1`。
- 同一隔离安装继续执行 `nextclaw update --channel stable --download-only` 与 `nextclaw update --apply`：确认可下载并应用 `0.25.1` runtime bundle。
- `wrangler pages deploy apps/docs/.vitepress/dist --project-name nextclaw-docs --branch master`：文档站部署成功，部署地址 `https://91314afd.nextclaw-docs.pages.dev`。
- `curl -s -I https://docs.nextclaw.io/zh/notes/2026-07-17-nextclaw-v0-25-1`：确认公开中文 release note 返回 `HTTP/2 200`。
- `curl -s -I https://docs.nextclaw.io/en/notes/2026-07-17-nextclaw-v0-25-1`：确认公开英文 release note 返回 `HTTP/2 200`。
- `curl -s -I https://docs.nextclaw.io/release-notes/nextclaw-v0.25.1.json`：确认结构化 release notes JSON 返回 `HTTP/2 200`。

## 发布/部署方式

机制修复本身先提交到代码库，不单独部署。

补发流程已完成：

- 从主线创建隔离 release worktree：`/private/tmp/nextclaw-release-0.25.1`。
- 回流 `codex/release-npm-minor-0.25.0` 的 release metadata。
- 补齐 `@nextclaw/core` 与安装入口 `nextclaw` 的 patch release 范围。
- 发布 `0.25.1` NPM patch，并更新 stable runtime update channel。
- NPM release commit：`52abc9c7c release: publish nextclaw 0.25.1`。
- runtime workflow：`https://github.com/Peiiii/nextclaw/actions/runs/29576939861`。
- runtime release：`https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.25.1`。
- 产品更新笔记：`apps/docs/zh/notes/2026-07-17-nextclaw-v0-25-1.md`、`apps/docs/en/notes/2026-07-17-nextclaw-v0-25-1.md`、`apps/docs/public/release-notes/nextclaw-v0.25.1.json`。
- 文档站已部署，公开 URL：`https://docs.nextclaw.io/zh/notes/2026-07-17-nextclaw-v0-25-1`、`https://docs.nextclaw.io/en/notes/2026-07-17-nextclaw-v0-25-1`、`https://docs.nextclaw.io/release-notes/nextclaw-v0.25.1.json`。
- 0.25.1 是 patch 版本，不默认发 X 帖；本批以修复和补漏为主，不配图。

## 用户/产品视角的验收步骤

- 使用 NPM 安装的旧版本能够检查到新的 stable runtime update。
- 发布后的 `nextclaw` 入口依赖的 runtime 包版本与本次补发的 `@nextclaw/core` 版本一致。
- 后续发布如果 release branch 没有回流、主线版本落后已发布 tag、或公开包有未纳入 batch 的 meaningful drift，发布命令会在 version / publish 前失败。

实际验收结果：

- `nextclaw@0.25.0 --version` 输出 `0.25.0`。
- `nextclaw@0.25.0` 的依赖闭包显示 `@nextclaw/core@0.15.5`、`@nextclaw/service@0.3.7`、`@nextclaw/kernel@0.6.7`。
- 公开 stable update check 输出 `Runtime update available: 0.25.0 -> 0.25.1`。
- `download-only` 输出 `Runtime update downloaded: 0.25.1`。
- `--apply` 输出 `Runtime update applied: 0.25.1`。

## 可维护性总结汇总

本次改动把发布范围判断从人工流程升级为可执行闸门，减少了依赖口头记忆的隐性复杂度。

- release health 和 branch closure 分别由专门脚本承载，职责清晰。
- 没有新增用户产品逻辑，也没有改变 runtime 行为。
- skill 更新只保留强制触发点和关键命令，不把长篇事故复盘塞回常驻规则。
- 补发完成后，本记录已补齐实际发布包、版本、workflow 和旧版安装态验证结果。

## NPM 包发布记录

机制修复本身不涉及 NPM 包发布。

本次任务已补发 NPM patch，状态为 `已发布 27/27`：

- `nextclaw@0.25.1`
- `@nextclaw/core@0.15.6`
- `@nextclaw/ui@0.15.8`
- `@nextclaw/agent-chat-ui@0.6.8`
- `@nextclaw/kernel@0.6.8`
- `@nextclaw/service@0.3.8`
- `@nextclaw/shared@0.4.5`
- `@nextclaw/server@0.15.8`
- `@nextclaw/runtime@0.4.6`
- `@nextclaw/client-sdk@0.5.8`
- `@nextclaw/remote@0.3.8`
- `@nextclaw/extension-sdk@0.3.5`
- `@nextclaw/mcp@0.3.6`
- `@nextclaw/ncp-mcp@0.2.6`
- `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.7`
- `@nextclaw/nextclaw-narp-runtime-opencode@0.2.7`
- `@nextclaw/channel-extension-dingtalk@0.2.6`
- `@nextclaw/channel-extension-discord@0.2.6`
- `@nextclaw/channel-extension-email@0.2.6`
- `@nextclaw/channel-extension-feishu@0.2.6`
- `@nextclaw/channel-extension-qq@0.2.5`
- `@nextclaw/channel-extension-slack@0.2.6`
- `@nextclaw/channel-extension-telegram@0.2.6`
- `@nextclaw/channel-extension-wecom@0.2.6`
- `@nextclaw/channel-extension-weixin@0.2.6`
- `@nextclaw/channel-extension-whatsapp@0.2.6`
- `@nextclaw/companion@0.2.8`

发布依据：`@nextclaw/core` 漏发后，Changesets 自动把依赖它或本次 changeset 涉及的公开包纳入 patch closure；这次不再人工手挑少数包。
