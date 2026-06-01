# v0.20.3 右侧栏资源 URI

## 迭代完成说明

本次完成右侧栏资源 URI 的第一阶段落地：

- 新增业务无关 `shared/lib/resource-uri` resolver 基础层，只负责 URI 解析、route definition 匹配、归一化和等价判断。
- 新增 `features/right-panel-resources`，集中 NextClaw 右侧栏可展示资源的 route definitions、home page 和 route resolver。
- `DocBrowserManager` 保持右侧栏 tab/history/store 状态迁移 owner，不再拥有 docs/apps/panel-app 业务 route 事实。
- `AppPresenter` 作为应用级装配根持有 `RightPanelResourceRouteResolver` 与 `DocBrowserManager`，`DocBrowserProvider` 只接收已装配 manager，不创建 manager。
- 删除旧 `doc-browser-route-registry.utils.ts`，避免业务 route 规则继续散在 shared DocBrowser 内部。

本次纠偏后未新增独立 presenter、未新增 feature-level manager singleton、未新增 `registries/` 目录。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-ui test -- src/shared/lib/resource-uri/utils/resource-uri-resolver.utils.test.ts src/features/right-panel-resources/utils/right-panel-resource-route-resolver.utils.test.ts src/shared/components/doc-browser/doc-browser-context.test.tsx src/shared/components/doc-browser/doc-browser.test.tsx src/features/panel-apps/utils/panel-app-doc-browser.utils.test.ts`
- `pnpm -C packages/nextclaw-ui exec eslint <本次触达文件列表>`
- `pnpm -C packages/nextclaw-ui build`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `rg -n "export const .* = new .*Manager|export const .* = new .*Registry|rightPanelResourceRegistry|RightPanelResourceRegistry|ResourceUriRegistry|registries|routeResolver=|managers/resource-uri|managers/right-panel-resource" <本次触达范围>`

补充说明：`pnpm -C packages/nextclaw-ui lint` 仍被既有无关 UI lint 债务阻断，失败点位于 chat、marketplace、system-status、i18n 等非本次触达文件。本次触达文件的定向 eslint 已通过。

## 发布/部署方式

本次未执行发布或部署。改动属于前端源码与文档设计落地，后续随常规前端发布流程一起带出。

## 用户/产品视角的验收步骤

- 打开右侧栏新标签页，能看到 Apps、Service Apps、Help Docs 等入口。
- 打开 `nextclaw://apps` 与 `nextclaw://apps?tab=service-apps`，仍能复用 Apps tab 并保留 tab 内状态。
- 从 Apps 面板打开 panel app 时，使用稳定 `panel-app:<id>` 去重，iframe 仍加载真实 `contentPath`。
- docs URL 与 `nextclaw://docs/...` 可解析为 docs tab，不影响主工作区 React Router 页面。

## 可维护性总结汇总

- 本次使用 `mvp-view-logic-decoupling`、`collapsible-feature-root-architecture`、`role-first-file-organization`、`file-naming-convention`、`classic-software-design-principles` 与 `nextclaw-clean-implementation` 约束 owner、目录与命名。
- 业务无关 URI 机制放在 `shared/lib/resource-uri/utils`，不依赖 NextClaw 业务、React、Zustand 或 DocBrowser。
- 右侧栏业务资源放在 `features/right-panel-resources`，不把主工作区页面强制接入，也不引入全局 app navigation。
- `DocBrowserManager` 只保留状态迁移职责；默认 fallback resolver 拆入 `utils/doc-browser-route-resolver.utils.ts`，降低 manager 文件增长。
- `post-edit-maintainability-guard` 结果：Errors 0，Warnings 1；`doc-browser.manager.ts` 当前 415 行，接近 500 行预算，下一步若继续扩展右侧栏状态迁移，应优先拆分同责任链 helper。
- 代码增减属于新增右侧栏资源 URI 能力的必要增长；已删除旧 route registry 文件并避免新增伪 manager / singleton / 非白名单目录。

## NPM 包发布记录

不涉及 NPM 包发布。
