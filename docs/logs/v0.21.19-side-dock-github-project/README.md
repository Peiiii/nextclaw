# v0.21.19 SideDock GitHub Project And Visibility

## 迭代完成说明

- 在右侧 SideDock 底部新增 GitHub 项目入口，链接到 `https://github.com/Peiiii/nextclaw`。
- 新增 `external-url` 类型的 SideDock target，由 `SideDockManager` 统一调用 `hostCapabilityManager.openExternalUrl`，避免把 GitHub 放进 iframe。
- 在 SideDock 右下角新增隐藏按钮，点击前显示确认弹窗，并提示可从 `设置 > 外观` 重新打开。
- 新增 Appearance 设置页，提供 `显示快捷栏` 开关；设置导航按核心性/使用频率排序，Appearance 位于 Search Channels 之后，Security 紧随其后，`/settings` 桌面默认仍进入核心 Model 设置。
- 保持内置资源入口和用户 pin 项的原有链路不变；外部链接不进入 pin 持久化资源模型，隐藏 SideDock 也不清空已有 pin 项。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-ui test -- src/features/side-dock/components/__tests__/side-dock.test.tsx src/features/side-dock/managers/__tests__/side-dock.manager.test.ts src/features/side-dock/utils/__tests__/side-dock-item.utils.test.ts src/features/settings/pages/__tests__/appearance-settings-page.test.tsx src/app/components/layout/__tests__/app-layout.test.tsx src/app/components/layout/__tests__/sidebar.layout.test.tsx src/app/components/layout/__tests__/settings-entry-page.test.tsx`：7 个文件、31 个用例通过。
- `pnpm -C packages/nextclaw-ui lint`：通过。
- `pnpm -C packages/nextclaw-ui build`：通过；保留既有 Browserslist、大 chunk 与 ineffective dynamic import 警告。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`：无阻塞、无警告。
- `pnpm lint:new-code:governance -- ...`：通过。
- `pnpm check:governance-backlog-ratchet`：OK。
- Playwright 冒烟：在 `http://127.0.0.1:5191/` 确认 GitHub 按钮位于 SideDock 底部 utility 区域，`aria-label` 为 `GitHub Project`，点击打开 `https://github.com/Peiiii/nextclaw`；确认隐藏按钮会打开提示弹窗，确认后 dock 消失，进入 `/appearance` 后可通过 `Show SideDock` 开关恢复。
- `pnpm clean:generated`：生成产物 clean。

## 发布/部署方式

- 本次未执行部署、推送、GitHub Release 或 NPM 发布。
- 已新增 `.changeset/side-dock-github-project.md`，后续统一发布时应给 `@nextclaw/ui` patch 版本。

## 用户/产品视角的验收步骤

1. 打开 NextClaw UI 桌面宽度页面。
2. 查看右侧 SideDock 底部，应看到 GitHub 图标入口和隐藏入口。
3. 悬停入口，应显示 GitHub 项目的 tooltip。
4. 点击入口，应在系统浏览器或新标签页打开 NextClaw GitHub 项目页。
5. 点击隐藏入口，应看到提示：隐藏后可在设置外观中重新打开。
6. 确认隐藏后，SideDock 消失；进入 `Settings > Appearance`，打开 `Show SideDock` 后 SideDock 恢复。
7. 打开 Settings 导航，应看到顺序为 `Model`、`Providers`、`Channels`、`Search Channels`、`Appearance`、`Security`。

## 可维护性总结汇总

- 本次是新增用户可见入口，非测试代码净增为必要增长；没有套用非功能改动的净增限制。
- Owner 边界保持清晰：内置项在 SideDock config，跳转动作在 SideDockManager，可见性状态在 SideDock store，恢复入口在 Appearance settings page。
- 没有新增并行资源打开链路；外部链接复用已有 host external-link capability，显示/隐藏复用已有 Zustand persist 模型。
- `post-edit-maintainability-review` 已使用，复核结论为通过；无 maintainability findings。

## NPM 包发布记录

- 需要进入后续统一 NPM 发布：`@nextclaw/ui` patch。
- 当前状态：仅新增 changeset，未发布。
