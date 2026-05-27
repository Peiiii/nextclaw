# v0.19.45 DocBrowser State Persistence

## 迭代完成说明

本次为全局右侧栏 DocBrowser 增加刷新后的状态恢复能力。DocBrowser 原本已经维护 `isOpen`、`mode`、`tabs`、`activeTabId` 和每个 tab 的 `currentUrl/history/dedupeKey`，本次将这组可序列化状态收敛到 Zustand store，并通过 Zustand `persist` middleware 持久化到 `localStorage`，刷新后可以恢复右侧栏是否打开、当前激活 tab、Docs / Apps / Panel App 等 tab 内容。

应用面板内部的“面板应用 / 服务应用”子 tab 改为由隐藏 URL 表达：默认是 `nextclaw://apps`，服务应用页是 `nextclaw://apps?tab=service-apps`。这样 Apps 面板刷新后能尽量回到上一次展示的内部位置，而不是只恢复到外层“应用”入口。

最终结构采用 store + manager 配对：`useDocBrowserStore` 负责 snapshot、持久化子集、版本与 rehydrate 校验；`DocBrowserManager` 负责 `open/close/navigate/syncUrl/closeTab` 等意图级状态迁移；`DocBrowserProvider` 只做 React Context 适配和订阅连接。类型与无状态 URL/default-state 逻辑分别进入 `types/`、`utils/` 子目录，避免 `doc-browser` 根目录继续膨胀。

用户纠偏后，同步将“前端可恢复状态优先使用 Zustand store + persist，并与 manager/presenter 动作 owner 配对”的规则沉淀到 `mvp-view-logic-decoupling` skill 及其 agent 索引，确保后续类似前端状态/刷新恢复/localStorage 任务会自动触发读取。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui test -- src/shared/components/doc-browser/doc-browser-context.test.tsx src/shared/components/doc-browser/doc-browser.test.tsx src/features/panel-apps/utils/panel-app-doc-browser.utils.test.ts`：3 个测试文件、14 个用例通过。
- `pnpm --filter @nextclaw/ui exec eslint src/shared/components/doc-browser/doc-browser-context.tsx src/shared/components/doc-browser/types/doc-browser.types.ts src/shared/components/doc-browser/utils/doc-browser-url.utils.ts src/shared/components/doc-browser/utils/doc-browser-state.utils.ts src/shared/components/doc-browser/stores/doc-browser.store.ts src/shared/components/doc-browser/managers/doc-browser.manager.ts src/shared/components/doc-browser/doc-browser-context.test.tsx src/features/apps/index.ts src/features/apps/components/apps-panel.tsx src/features/panel-apps/index.ts src/features/panel-apps/utils/panel-app-doc-browser.utils.tsx src/features/panel-apps/utils/panel-app-doc-browser.utils.test.ts`：通过。
- `pnpm --filter @nextclaw/ui tsc`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`：通过，0 errors / 1 warning；warning 为 `doc-browser-context.test.tsx` 本次增长较多，后续可按 seam 拆 fixtures/builders。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm --filter @nextclaw/ui lint`：未通过，阻塞来自既有无关 lint 错误；本次触达文件的 targeted ESLint 已通过。
- `pnpm lint:new-code:governance`：未通过，当前仅剩阻塞来自当前工作区已有改动 `packages/nextclaw-ui/src/app/managers/app.manager.ts` deep import `features/panel-apps/managers/panel-app-bridge.manager`，不属于本次右侧栏恢复改动。

## 发布/部署方式

本次未执行发布、部署或 NPM 发版。改动位于 `@nextclaw/ui`，后续进入统一 beta 批次时随 UI 包一起发布。

## 用户/产品视角的验收步骤

1. 打开全局右侧栏的“应用”。
2. 切换到“服务应用”或打开某个 Panel App。
3. 刷新页面。
4. 右侧栏应保持打开，并尽量恢复到刷新前的 active tab / Apps 子 tab / Panel App 内容。
5. 主动关闭右侧栏后刷新，右侧栏应保持关闭。

## 可维护性总结汇总

本次是新增用户可见体验能力。可维护性 guard 口径代码增减：总计新增 809 行、删除 454 行、净增 355 行；非测试代码新增 662 行、删除 453 行、净增 209 行。增长主要来自 Zustand store + persist 合同、DocBrowser manager 状态迁移、隐藏 Apps URL 合同、刷新恢复测试，以及将前端状态持久化规范落入 skill。

正向减债动作：职责收敛与目录拆分。第一次实现把持久化逻辑留在 provider/localStorage util 路径里，已按用户纠偏收敛为 store + manager：store 维护状态与 persist，manager 维护业务状态迁移，provider 回到连接层。同时将新增类型与无状态工具移入 `types/` / `utils/`，避免 `doc-browser` 根目录越过直接文件预算。剩余观察点是 `doc-browser-context.test.tsx` 增长明显，后续若继续扩展恢复场景，应优先拆测试 fixtures/builders。

## NPM 包发布记录

不涉及 NPM 包发布；本次处于本地实现与验收阶段。
