# v0.23.2 Current Version Release Notes Link

## 迭代完成说明

本迭代修复左上角版本号没有稳定提供当前版本更新笔记入口的问题，并保留可用更新目标版本的更新说明入口。

根因：之前的实现把版本号 hover/click 入口绑定到 runtime update snapshot 的 `releaseNotesUrl`。这个字段只在“有可用更新”或“已下载更新”时描述目标更新版本；当用户已经运行 `v0.23.0` 且更新状态为 up-to-date 时，snapshot 不再携带 `releaseNotesUrl`，于是当前版本自己的更新笔记入口消失。

修复方式：

- 左上角显示的版本号现在按当前 `productVersion` 读取 `https://docs.nextclaw.io/release-notes/nextclaw-v<version>.json`。
- 结构化 JSON 中的 `links.html` 作为人类可读 release note 链接来源，并按当前 UI 语言选择中文或英文页面。
- 版本号入口只打开当前显示版本自己的说明；可用更新版本的说明由更新按钮旁的独立外链入口打开，避免 `v0.23.0` 链接到别的版本，也不破坏下载/应用更新的主动作。

## 测试/验证/验收方式

已完成：

- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-ui test -- src/shared/components/common/__tests__/brand-header.test.tsx`：通过，`6/6`。
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-ui tsc`：通过。
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-ui lint`：通过，仍有既有 `cron-config.tsx` cognitive complexity warning，非本次触达。
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm lint:new-code:governance`：通过。
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`：通过，源码触达范围无 maintainability findings。
- 浏览器验收：Playwright 打开 `http://127.0.0.1:5174`，hover 左上角 `v0.23.0` 后 tooltip 显示 `Current version v0.23.0 / Click to view v0.23.0 release notes`，点击后打开 `https://docs.nextclaw.io/en/notes/2026-07-15-nextclaw-v0-23-0`。
- 浏览器验收：Playwright 拦截 `/api/runtime/update` 模拟 `availableVersion=v0.23.1`，确认下载按钮仍存在，旁边 release note 入口 tooltip 显示 `View v0.23.1 release notes`，点击打开 `https://docs.nextclaw.io/en/notes/2026-07-16-nextclaw-v0-23-1`。
- 线上结构化说明校验：`https://docs.nextclaw.io/release-notes/nextclaw-v0.23.0.json` 返回 `200`，并允许跨域拉取。

## 发布/部署方式

本轮只完成源码、测试、changeset 和迭代记录，不执行发布或部署。

后续统一发布时，`.changeset/current-version-release-notes.md` 会为 `@nextclaw/ui` 生成 patch 版本说明。

## 用户/产品视角的验收步骤

1. 打开本地 NextClaw UI。
2. 等左上角版本号显示为当前版本，例如 `v0.23.0`。
3. hover 版本号，应看到“当前版本”和“点击查看该版本更新说明”的 tooltip。
4. 点击版本号，应打开当前版本对应的 docs release note 页面。
5. 当存在可用更新时，更新按钮旁的外链入口应打开可用更新版本对应的 docs release note 页面；下载/更新按钮本身仍执行下载或应用更新。

## 可维护性总结汇总

本次把当前版本 release note 链接来源收敛到既有结构化 release notes JSON，没有新增版本号到日期 slug 的硬编码映射，也没有让当前版本号继续依赖“可用更新”的 snapshot 字段；可用更新目标版本则继续使用 update snapshot 自带的 `releaseNotesUrl`。

可维护性结果：

- 复用既有 `fetchReleaseNotesData` / release notes JSON 合同。
- 通过 `features/system-status` 公共出口暴露 release note 工具，避免 shared component deep import feature 内部路径。
- 当前版本入口和更新目标入口的职责边界更清楚，下载/应用按钮的原有主动作保持不变。
- Maintainability guard 无阻塞和警告；本次为用户可见能力修复，非测试源码净增是为了补齐 current-version release note 查找与可访问交互。

## NPM 包发布记录

本轮不执行 NPM 发布。

已新增待发布 changeset：

- `@nextclaw/ui`：patch，说明当前版本号和可用更新目标都可打开对应 release notes。
