# v0.26.1 移动端聊天工具栏单行布局

## 迭代完成说明

本次修复移动端聊天输入面板在控件实际可以容纳时仍拆成两行的问题。

- 根因：工具栏左侧控制组仍保留 `min-w-[12rem]`，但模型选择器已经迁入右侧尾部控制组。360px 视口下，左组强制最小宽度、组间距和不可收缩右组总计需要 308px，而工具栏实际内容宽度只有 302px，因此外层 `flex-wrap` 把整个右组换到第二行。
- 确认方式：修前在当前源码前端 `http://127.0.0.1:5174/chat/<session>` 的 360px 视口测得左组 `min-width: 192px`、右组宽 108px，左右组 `y` 坐标分别为 699 和 739，工具栏高度为 84px。
- 修复：由共享 `ChatInputBarToolbar` 删除已经失效的左组最小宽度约束，让左组按剩余空间正常收缩；同时补充稳定语义类用于回归测试定位。
- 根因闭合：修复直接移除了造成额外 6px 宽度需求的过期布局合同，没有隐藏控件、修改业务分组或在移动页面增加 CSS 覆盖。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-agent-chat-ui exec vitest run src/components/chat/ui/chat-input-bar/__tests__/chat-input-bar.test.tsx src/components/chat/ui/chat-input-bar/__tests__/chat-input-bar-toolbar.test.tsx`：通过，38 个测试。
- `pnpm -C packages/nextclaw-agent-chat-ui tsc`：通过。
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-agent-chat-ui lint`：通过。
- `pnpm -C packages/nextclaw-agent-chat-ui test`：执行；本次相关测试通过，全包仍有 3 个与当前 diff 无关的既有失败，分别位于公共类型 ReactNode 约束、文件操作预览 class 断言和 Lexical 连续退格选择测试。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet` 与 `git diff --check`：通过。
- 真实页面验收：源码前端 `http://127.0.0.1:5174/chat/<session>`，360px 视口；修后技能、附件、模型、上下文窗口和发送控件的 `y` 坐标全部为 739，左组 `min-width` 为 0px，工具栏高度为 44px。

## 发布/部署方式

不涉及本轮直接部署或发布。改动通过 `@nextclaw/agent-chat-ui` 与 `@nextclaw/ui` 的 patch changeset 等待后续统一发布。

## 用户/产品视角的验收步骤

1. 在 360px 宽度的移动端打开任意聊天会话。
2. 查看输入面板底部工具栏，确认技能、附件、模型、上下文窗口和发送按钮保持在同一行。
3. 确认所有控件仍然可见、顺序不变，输入面板没有多余的第二行高度。
4. 将容器继续缩窄到控件确实无法容纳时，工具栏仍可按既有规则换行。

## 可维护性总结汇总

- 继续由共享 `ChatInputBarToolbar` 统一拥有响应式布局，没有新增宿主覆盖、分支或平行组件。
- 生产代码删除过期最小宽度约束，保持非测试代码 `+1/-1，净增 0`；语义类让测试可以稳定定位真实布局 owner。
- 定向组件测试删除已由其他测试覆盖的重复断言，本次源码与测试合计 `+8/-12，净减 4`；真实页面验收继续覆盖最终消费端的计算样式和行位置。
- `post-edit-maintainability-guard --non-feature`：0 error / 1 warning。测试文件从 883 行降至 879 行，但仍接近 900 行预算；后续拆分缝是将 fixtures/builders 与行为测试分离。
- `post-edit-maintainability-review`：通过；正向减债动作为删除过期约束与重复测试断言，没有新增分支、文件或平行布局路径。

## NPM 包发布记录

本轮不直接发布 NPM 包。已新增 `.changeset/fix-chat-toolbar-mobile-layout.md`，为 `@nextclaw/agent-chat-ui` 与 `@nextclaw/ui` 标记 patch，等待后续统一发布。
