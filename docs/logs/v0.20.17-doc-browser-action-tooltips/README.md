# v0.20.17 Doc Browser Action Tooltips

## 迭代完成说明

- 为 doc-browser 顶部纯图标操作补齐统一 Tooltip 与 `aria-label`，覆盖返回、前进、新建标签、固定/移出 SideDock、浮动/停靠切换、关闭窗口和关闭标签。
- 将顶部操作收敛为 `DocBrowserIconActionButton` 局部组件，统一 tooltip、按钮语义、禁用态 hover trigger 和尺寸变体。
- 新增 `frontend-interaction-quality` skill，用于沉淀前端交互体验、tooltip/popover、操作可理解性、键盘可达性和状态反馈规范。
- 在 `AGENTS.md` 增加轻量路由，并调整 `frontend-style-encapsulation` 中关于紧凑入口的规则，避免继续把原生 `title` 当作纯图标按钮的主要解释机制。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui test src/shared/components/doc-browser/doc-browser.test.tsx`：通过，13 个测试通过。
- `pnpm tsc:ui`：通过。
- `pnpm -C packages/nextclaw-ui exec eslint src/shared/components/doc-browser/doc-browser-tab-strip.tsx src/shared/components/doc-browser/doc-browser.test.tsx`：通过。
- `pnpm -C packages/nextclaw-ui lint`：未通过，阻塞项为既有无关错误，主要分布在 chat、marketplace、system-status、i18n 测试等文件；本次 touched-file ESLint 已通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/shared/components/doc-browser/doc-browser-tab-strip.tsx packages/nextclaw-ui/src/shared/components/doc-browser/doc-browser.test.tsx`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`：按非功能口径失败，非测试净增 +63；本次最终按用户可见交互能力补齐处理，未使用该口径作为通过条件。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- Vite 替代冒烟：`curl http://127.0.0.1:5174/` 返回 `200 text/html`；`curl http://127.0.0.1:5174/src/shared/components/doc-browser/doc-browser-tab-strip.tsx` 返回 `200 text/javascript`，转换后模块包含 `TooltipProvider` 和 `aria-label`。

## 发布/部署方式

- 未发布。
- 本次是源码与项目 AI 规则改动，不涉及远程 migration、线上部署、桌面安装包或 runtime update channel。

## 用户/产品视角的验收步骤

- 打开右侧 dock/doc-browser 顶部操作区。
- 悬停返回、前进、新建标签、固定/移出 SideDock、浮动/停靠、关闭等纯图标按钮，应看到明确 tooltip。
- 使用键盘或读屏查看这些图标按钮时，应能获取对应操作名称。
- 对禁用态历史按钮或不可移除的内置 SideDock 项，悬停区域仍应能解释按钮含义。

## 可维护性总结汇总

- 默认 maintainability guard 通过，touched-file ESLint、定向测试、UI tsc、治理和 backlog ratchet 均通过。
- 本次通过局部 `DocBrowserIconActionButton` 收敛重复按钮语义，避免在每个 icon button 上散写 tooltip、`aria-label` 和 disabled wrapper。
- 代码增减报告：新增 326 行，删除 180 行，净增 146 行。
- 非测试代码增减报告：新增 180 行，删除 117 行，净增 63 行。
- `--non-feature` 行数门槛未通过；判断依据是本次补齐了用户可见交互能力并新增自动触发的体验规范，不是纯重构。后续若其他 header/action 区域继续补齐 tooltip，应优先复用共享 primitive 或抽取更通用的 icon action 组件，而不是复制本地实现。

## NPM 包发布记录

不涉及 NPM 包发布。
