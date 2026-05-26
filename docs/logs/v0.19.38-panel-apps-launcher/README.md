# v0.19.38 Panel Apps Launcher

## 迭代完成说明

本轮把 Panel Apps 从文件列表推进为轻量应用启动器，并补齐对应方案设计文档：

- 新增设计文档：`docs/designs/2026-05-27-panel-apps-launcher-design.md`。
- kernel 侧由 `PanelAppManager` 统一负责单 HTML 应用发现、manifest 解析、用户偏好状态读写、打开记录和智能排序。
- server 侧只新增薄路由：更新偏好与记录打开。
- client SDK 与 UI 补齐偏好更新、打开记录、模块切换与收藏交互。
- UI 从原生下拉改为胶囊式模块 tabs：智能排序、收藏、最近打开、最近更新、名称。
- Panel App iframe sandbox 收敛为应用级 capability profile，补齐 `allow-same-origin`、`allow-modals`、`allow-popups-to-escape-sandbox`、`allow-downloads`、`allow-pointer-lock` 等能力，避免本地小应用因缺少 iframe capability 而无法正常交互。
- Panel App 图标读取收敛为“emoji shortcut + Web 标准 favicon”：优先 `nextclaw-panel-icon`，其次 `<link rel="icon">` / `<link rel="apple-touch-icon">`，最后默认图标。

这是新增用户能力，不适用“非功能改动生产代码净增 <= 0”的硬门槛；本轮新增代码主要来自新状态 owner、manifest 解析、API 合同、UI 交互和定向测试。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-kernel exec vitest run src/managers/__tests__/panel-app.manager.test.ts`
- `pnpm -C packages/nextclaw-server exec vitest run src/features/panel-apps/controllers/panel-apps.controller.test.ts`
- `pnpm -C packages/nextclaw-kernel exec tsc --noEmit`
- `pnpm -C packages/nextclaw-server exec tsc --noEmit`
- `pnpm -C packages/nextclaw-client-sdk exec tsc --noEmit`
- `pnpm -C packages/nextclaw-ui exec tsc --noEmit`
- 定向 ESLint：
  - kernel Panel Apps manager/state/manifest/test
  - server Panel Apps controller/router/types/test
  - client SDK Panel Apps service/index
  - UI Panel Apps list/item/hooks/view utils/i18n/types
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`

## 发布/部署方式

未发布。本轮只完成本地代码与文档落地；后续跟随统一 beta / desktop 发布流程。

## 用户/产品视角的验收步骤

1. 在 workspace 的 `panels/` 目录放置 `*.panel.html` 单文件应用。
2. 打开面板应用列表，应能看到应用标题、描述、图标、最近打开或更新时间。
3. 点击星标后，应用进入收藏模块，并在智能排序中前置。
4. 点击应用后应打开对应 HTML，同时刷新最近打开时间与打开次数。
5. 切换胶囊 tabs：智能排序、收藏、最近打开、最近更新、名称，列表展示应符合对应模块语义。
6. 带脚本的本地 Panel App 应能响应点击、弹出 `alert/confirm/prompt`、读写浏览器本地状态，并在需要时调用同源 API。
7. 配置 `nextclaw-panel-icon` 的应用应显示 emoji / 短字符图标；配置标准 favicon 的应用应显示图片图标；都未配置时显示默认图标。

## 可维护性总结汇总

- 本次顺手减债：是。纠正了初版 UI 把业务列表继续堆在单组件里的趋势，将列表项和视图排序拆回 feature 内部独立 owner。
- 代码增减报告：源码新增 698 行，删除 33 行，净增 665 行；其中测试新增 132 行，删除 8 行。
- 非测试代码增减报告：新增 566 行，删除 25 行，净增 541 行。
- 可维护性复核结论：通过。该增长来自新增用户能力，且 server 保持薄层，kernel `PanelAppManager` 作为业务 owner，UI 交互拆为 list/item/view utils，未把状态持久化散落到 localStorage 或组件里。
- `post-edit-maintainability-guard` 通过，保留 7 个 warning，主要来自仓库既有目录/类型文件预算接近上限以及本轮无关改动的全量 diff 统计。
- `post-edit-maintainability-review` 已执行主观复核；当前主要后续缝隙是把前端 API 大类型文件继续拆分，避免 `shared/lib/api/types.ts` 逼近预算。

## 红区触达与减债记录

### packages/nextclaw-server/src/shared/types/server-api.types.ts

- 本次是否减债：否。
- 说明：只新增 Panel Apps preference update view 的薄类型出口；文件已接近预算上限。
- 下一步拆分缝：将 server API view types 按 feature 拆分，根出口只做聚合。

### packages/nextclaw-ui/src/shared/lib/api/types.ts

- 本次是否减债：否。
- 说明：只补齐 Panel Apps entry 字段和 preference update view；文件已接近预算上限。
- 下一步拆分缝：将 Panel Apps 类型迁移到 feature 或 API feature type 文件，再由公共入口 re-export。

## NPM 包发布记录

不涉及 NPM 包发布。
