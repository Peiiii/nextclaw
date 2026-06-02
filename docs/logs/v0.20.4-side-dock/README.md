# v0.20.4 SideDock 右侧快捷入口

## 迭代完成说明

本次完成 SideDock 第一阶段落地：

- 新增 `features/side-dock`，作为右侧快捷入口的独立 feature root。
- 新增内置不可移除入口：Apps、Service Apps、Help Docs、Start Page。
- 新增 `SideDockManager`，由 `AppPresenter` 应用级装配，负责 open、pin、unpin、reorder。
- 新增 `useSideDockStore`，用 Zustand persist 保存用户 pin 的入口，并在恢复时校验持久化数据形态。
- `DesktopAppShell` 支持在最右侧组合 `SideDock`，DocBrowser 关闭时也保留快捷入口，DocBrowser docked 时内容区、DocBrowser、SideDock 同级排列。
- `AppLayout` 在桌面 shell 中接入 SideDock；移动 shell 暂不接入。
- 新增 SideDock 设计文档，并在右侧栏资源 URI 设计文档中建立关联引用。
- 修复 DocBrowser 关闭后 SideDock 仍默认高亮 Help Docs 的问题。根因是活跃态只判断了残留 `currentTab.kind === 'docs'`，没有以 `isOpen` 作为前置条件；DocBrowser 关闭后 store 仍保留默认 docs tab，导致视觉上误判为文档已选中。
- 将 DocBrowser 默认状态从 Help Docs 改为 Start Page。SideDock 成为右侧资源入口后，关闭态不应再隐含默认文档资源；无显式 URL / kind 的默认打开也不再落到 docs。
- 修复从左下角设置菜单打开帮助文档时额外出现 Start Page tab 的问题。根因是菜单入口用 `newTab: true` 打开 docs，而关闭态默认 Start Page tab 被当成真实 tab 保留；现在帮助文档入口不再强制新建 tab，且 DocBrowser manager 会用第一个真实资源替换关闭态默认 Start Page 占位 tab。
- 从右侧导航页移除 MCP 市场入口，保留更高频的 Apps、Service Apps、Help Docs 和 Skill Marketplace。
- 收敛右侧导航页入口样式：从大磁贴改为紧凑行式入口，移除 hover scale 和阴影，降低单个 item 占用空间。
- 修复从 SideDock 打开 Help Docs 时中文界面 tab 标题仍显示 `Docs` 的问题。根因是 right-panel docs route 与 DocBrowser 默认 docs fallback 都硬编码英文标题，现在统一使用 `t('docBrowserHelp')`。

本次遵守了“不新增 feature-level presenter、不导出 manager singleton、Provider 不 new manager”的约束。SideDock 使用 right-panel-resource URI 作为打开目标，不复制 URI 解析和 DocBrowser tab/history 逻辑。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-ui test -- src/features/side-dock/utils/side-dock-item.utils.test.ts src/features/side-dock/managers/side-dock.manager.test.ts src/features/side-dock/components/side-dock.test.tsx src/platforms/desktop/components/desktop-app-shell.test.tsx src/app/components/layout/app-layout.test.tsx`
- `pnpm -C packages/nextclaw-ui exec eslint src/app/components/layout/app-layout.tsx src/app/components/layout/app-layout.test.tsx src/app/presenters/app.presenter.ts src/platforms/desktop/components/desktop-app-shell.tsx src/platforms/desktop/components/desktop-app-shell.test.tsx src/features/side-dock/index.ts src/features/side-dock/components/side-dock.tsx src/features/side-dock/components/side-dock.test.tsx src/features/side-dock/configs/side-dock-built-in-items.config.ts src/features/side-dock/managers/side-dock.manager.ts src/features/side-dock/managers/side-dock.manager.test.ts src/features/side-dock/stores/side-dock.store.ts src/features/side-dock/types/side-dock.types.ts src/features/side-dock/utils/side-dock-item.utils.ts src/features/side-dock/utils/side-dock-item.utils.test.ts`
- `pnpm -C packages/nextclaw-ui build`
- `pnpm lint:new-code:doc-file-names`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
- `node scripts/governance/eslint-maintainability-report.mjs --fail-on-coverage-gaps`
- 关闭态高亮回归验证：`pnpm -C packages/nextclaw-ui test -- src/features/side-dock/components/side-dock.test.tsx`
- 默认 Start Page 语义验证：`pnpm -C packages/nextclaw-ui test -- src/shared/components/doc-browser/doc-browser-context.test.tsx src/features/side-dock/components/side-dock.test.tsx src/features/right-panel-resources/utils/right-panel-resource-route-resolver.utils.test.ts src/shared/components/doc-browser/doc-browser.test.tsx`
- 左下角菜单打开文档不保留 Start Page 验证：`pnpm -C packages/nextclaw-ui test -- src/shared/components/doc-browser/doc-browser-context.test.tsx src/features/chat/components/layout/chat-sidebar.test.tsx src/features/side-dock/components/side-dock.test.tsx src/shared/components/doc-browser/doc-browser.test.tsx`
- 导航页入口收敛验证：`pnpm -C packages/nextclaw-ui test -- src/features/right-panel-resources/utils/right-panel-resource-route-resolver.utils.test.ts src/shared/components/doc-browser/doc-browser-context.test.tsx`
- 导航页紧凑样式验证：`pnpm -C packages/nextclaw-ui exec eslint src/features/right-panel-resources/components/right-panel-resource-home-page.tsx`
- Help Docs 标题本地化验证：`pnpm -C packages/nextclaw-ui test -- src/features/right-panel-resources/utils/right-panel-resource-route-resolver.utils.test.ts src/shared/components/doc-browser/doc-browser-context.test.tsx src/features/side-dock/components/side-dock.test.tsx src/shared/components/doc-browser/doc-browser.test.tsx`

`pnpm lint:new-code:governance` 已重新运行。本次 SideDock 触达范围已无治理错误，但该命令仍被工作区中既有未纳入本次改动的 `packages/extensions/nextclaw-narp-runtime-opencode` 新目录阻断，错误为该目录内部应使用 `@opencode-narp/` alias 而不是 parent-relative cross-directory imports。

`node scripts/governance/maintainability-hotspots.mjs` 已运行，输出既有热点清单并以 code 1 结束；本次未触达清单中的红区文件。

## 发布/部署方式

本次未执行发布或部署。改动属于前端源码、测试和设计文档，后续随常规前端发布流程带出。

## 用户/产品视角的验收步骤

- 在桌面端打开主界面，右侧应出现窄条 SideDock。
- 点击 Apps 入口，应打开右侧栏 Apps 页面。
- 点击 Service Apps 入口，应打开右侧栏 Apps 页面并进入 Service Apps tab。
- 点击 Help Docs 入口，应打开右侧栏帮助文档。
- 点击 Start Page 入口，应打开右侧栏导航页。
- 打开 docked DocBrowser 时，SideDock 应保持在最右侧；关闭 DocBrowser 后 SideDock 仍可见。

## 可维护性总结汇总

- 本次是新增用户可见能力，非测试生产代码净增为必要增长，不适用“非功能改动生产代码净增 <= 0”门槛。
- SideDock 拆为 `components/configs/managers/stores/types/utils`，符合当前 feature root 和角色目录规则。
- `SideDockManager` 不导出 singleton，由 `AppPresenter` 持有并注入布局组件。
- SideDock 不拥有内容、不直接理解 Apps/Docs 细节，只保存 target URI 并调用 `DocBrowserManager.open`。
- Store 只持久化用户 pin 列表，内置入口来自 config，避免系统态和用户态混写。
- `post-edit-maintainability-guard` 最近一次结果：Errors 0，Warnings 2。Warnings 为既有接近预算文件：`chat-sidebar.test.tsx` 897/900 行、`doc-browser.manager.ts` 434/500 行；本次已在 `chat-sidebar.test.tsx` 净减 1 行，`doc-browser.manager.ts` 因修复关闭态占位替换逻辑增加 19 行，后续继续扩展 DocBrowser manager 时应优先拆分状态迁移 helper。
- `eslint-maintainability-report` 通过，未新增本次触达文件的 maintainability violation。

## NPM 包发布记录

不涉及 NPM 包发布。
