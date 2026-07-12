# v0.22.25-ui-surface-polish

## 迭代完成说明

本次收拢另一 AI 留在工作区中的 UI 表面优化：定时任务卡片改用主题 token 与更紧凑的信息层级，Marketplace 搜索框、文档浏览器地址栏以及共享 Input / Select / Textarea 统一边框和 focus 表达。

这批改动的核心问题是多个表面仍使用固定 gray/white 色值和不一致的 primary focus ring，深浅主题下层级与密度会漂移。修复直接复用现有 `card`、`muted`、`border`、`foreground` 等设计 token，没有增加新的视觉体系或组件分支。

## 测试/验证/验收方式

- `@nextclaw/ui` TypeScript 检查通过。
- `@nextclaw/ui` 完整 ESLint 无 error，仅保留 HEAD 既有的测试文件行数与 cron 复杂度 warning。
- `@nextclaw/ui` 完整 156 个测试文件、658 项测试通过。
- `pnpm lint:new-code:governance`、governance backlog ratchet 与 maintainability guard 通过。

## 发布/部署方式

本次未执行发布或部署。

这是用户可见 UI 增强，已新增 `.changeset/ui-surface-polish.md`，后续随 `@nextclaw/ui` patch 统一发布。

## 用户/产品视角的验收步骤

1. 打开定时任务页面，确认启用/停用卡片、搜索、筛选、空状态和展开详情使用统一主题色，深色主题下不出现固定白底。
2. 打开 Marketplace，确认搜索框与页面主题一致。
3. 打开文档浏览器，确认地址栏 focus 不再出现突兀的双层高亮。
4. 检查常用输入框、下拉框与多行文本框，确认边框和 focus 状态一致且仍有可见反馈。

## 可维护性总结汇总

- 复用现有设计 token 与 shared UI primitive，没有复制新的输入组件。
- 定时任务卡片移除固定色和装饰性左色条，视觉逻辑更少、更容易随主题演进。
- 没有新增文件、目录、wrapper、manager 或 service。
- maintainability guard 无 error；cron 组件仍有既存复杂度 warning，后续应按卡片/筛选/列表 seam 拆分，不应继续向单函数追加分支。

## NPM 包发布记录

本次未发布 NPM 包。

- `@nextclaw/ui`：patch，主题化 UI 表面与共享表单 focus 样式；待后续统一发布。
