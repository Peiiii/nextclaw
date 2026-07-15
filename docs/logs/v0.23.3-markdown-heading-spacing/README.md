# v0.23.3-markdown-heading-spacing

## 迭代完成说明

本次修复聊天 Markdown 各内容块垂直节奏不一致的问题。根因不只在标题：根容器虽然用相邻选择器声明了 `0.72rem` 基础块间距，但标题、列表、分隔线、代码块、表格和引用又分别声明外部 margin，后置规则按 specificity 覆盖了根节奏。结果是表格或引用附近只有 `2.4–5.6px` 留白，标题则通过 `padding-bottom` 与后继内容制造另一套间距 owner。

修复直接收敛现有 `.chat-markdown` 排版合同：根 flow 统一拥有 `12px` 普通块间距；H1–H6 作为章节边界使用 `20px` 上方留白，并与所属内容保持 `8px`。表格、代码块、引用、列表和分隔线只负责自身内部视觉，不再覆盖外部节奏。首标题通过相邻流规则自然保持 `0`，没有新增宿主覆盖、组件变体或第二套 Markdown 样式路径。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui lint`：通过，0 error；保留一条与本次无关的既有 cron cognitive-complexity warning。
- `pnpm -C packages/nextclaw-ui build`：通过，Vite production build 成功。
- 固定端口 `http://127.0.0.1:4179/` 的当前 worktree Vite 实例验收：修前代码块到引用为 `3.2px`、正文到列表为 `5.6px`；修后普通块组合统一为 `12px`，表格/引用到后续标题为 `20px`，标题到所属内容为 `8px`。
- H1–H6 组合矩阵通过：首标题上方为 `0px`；正文、表格、代码块、引用、列表、分隔线之后的 H1–H6 上方均为 `20px`，六级标题到后继正文均为 `8px`。
- 修前/修后浏览器截图已人工对比，标题章节归属和引用块前后留白符合预期。
- Maintainability guard：CSS 不在 code-like 文件统计口径内，报告不适用；`pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、`pnpm check:generated-clean` 均通过。
- 本次只修改 CSS，没有触达 TypeScript 源码、类型或导入导出边界，因此 `tsc` 不适用。

## 发布/部署方式

本次只交付 ready PR，未执行 merge、release、deploy 或 migration。

## 用户/产品视角的验收步骤

1. 打开同时包含表格、标题、代码块、引用、列表和分隔线的聊天回复。
2. 确认消息开头的标题没有多余顶部空白，正文中的标题与前文形成清晰分节，并明显靠近其所属内容。
3. 确认代码块、引用、列表、表格和分隔线之间保持一致的基础留白，没有局部贴紧或重复叠加。

## 可维护性总结汇总

本次修复复用唯一的 `.chat-markdown` 样式 owner，没有新增文件级样式入口、组件分支、helper 或兼容路径。相对任务基线的生产 CSS 为 `+10/-16`，净减 6 行；正向减债动作为删除五处分散的外部 margin owner、删除标题 padding 间距路径，并让根 flow 与标题语义例外成为唯一节奏合同。Maintainability guard 已执行但 CSS 不在其 code-like 文件口径内；主观复核结论为通过，no maintainability findings。

## NPM 包发布记录

- `@nextclaw/ui`：需要 patch，changeset 已添加，待后续统一发布。
- 本次未执行 NPM 发布。
