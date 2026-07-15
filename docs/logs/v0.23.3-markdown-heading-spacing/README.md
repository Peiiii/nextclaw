# v0.23.3-markdown-heading-spacing

## 迭代完成说明

本次修复聊天 Markdown 标题上方缺少分节间距的问题。根因是通用 Markdown 块间距虽然设置为 `0.72rem`，但后置的标题规则又把 `margin-top` 覆盖成 `0.2rem`；此前新增的 `0.5em` 下方留白只改善了标题之后的节奏，没有解决标题与前文过近的问题。

修复直接调整现有 `.chat-markdown` 排版合同：正文后的 H1–H6 标题统一获得 `1.2rem` 上方留白，消息首个标题显式保持 `0`，既有下方留白继续由标题自身承担。标题 selector 同时收敛为已有的 `:is(...)` 形式，没有引入宿主覆盖、组件变体或第二套 Markdown 样式路径。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui lint`：通过，0 error；保留一条与本次无关的既有 cron cognitive-complexity warning。
- `pnpm -C packages/nextclaw-ui build`：通过，Vite production build 成功。
- 固定端口 `http://127.0.0.1:4179/chat` 的当前 worktree Vite 实例验收：修前 H1–H6 上方均为 `3.2px`；修后正文中的 H1–H6 均为 `19.2px`，首标题为 `0px`，标题下方保持 `7.68–9.76px`，后继正文额外 margin 保持 `0px`。
- 浏览器截图已人工检查，首标题贴合消息起点，后续标题与前文形成稳定分节。
- 本次只修改 CSS，没有触达 TypeScript 源码、类型或导入导出边界，因此 `tsc` 不适用。

## 发布/部署方式

本次只交付 ready PR，未执行 merge、release、deploy 或 migration。

## 用户/产品视角的验收步骤

1. 打开包含多段正文和多个 Markdown 标题的聊天回复。
2. 确认消息开头的标题不会产生多余顶部空白。
3. 确认正文之后的各级标题与前文之间有清晰留白，标题后的段落仍保持紧凑且稳定。

## 可维护性总结汇总

本次修复复用唯一的 `.chat-markdown` 样式 owner，没有新增文件级样式入口、组件分支、helper 或兼容路径。生产 CSS 为 `+6/-7`，净减 1 行；正向减债动作为将六个重复 heading selector 收敛到已有 `:is(...)` 表达，同时明确首标题例外。Maintainability guard 已执行，但 CSS 不在其 code-like 文件口径内，因此报告不适用；`lint:new-code:governance`、governance backlog ratchet 和 generated-clean 检查均通过。主观复核结论为通过，no maintainability findings。

## NPM 包发布记录

- `@nextclaw/ui`：需要 patch，changeset 已添加，待后续统一发布。
- 本次未执行 NPM 发布。
