# Chat Scroll To Bottom

## 迭代完成说明

本轮补齐聊天会话里的常规滚动能力：当用户向上查看历史消息、不在消息列表底部时，会出现一个浮动的滚动到底部按钮；点击后回到最新消息位置。

实现上没有新增平行滚动 owner，而是扩展已有 `useStickyBottomScroll`，由它继续拥有“是否在底部”和“滚动到底部”的 DOM 同步合同。`ChatConversationContent` 只负责在真实会话消息区域展示按钮，按钮复用 `IconActionButton`，文案进入 chat i18n。

## 测试/验证/验收方式

- `pnpm --dir packages/nextclaw-agent-chat-ui exec vitest run src/components/chat/hooks/use-sticky-bottom-scroll.test.tsx`：通过，覆盖离开底部状态和主动滚动到底部。
- `pnpm --dir packages/nextclaw-ui exec vitest run src/features/chat/components/conversation/__tests__/chat-conversation-content.test.tsx`：通过，覆盖按钮显示和点击调用。
- `pnpm --dir packages/nextclaw-ui exec vitest run src/features/chat/components/conversation/__tests__/chat-conversation-content.test.tsx src/features/chat/features/conversation/components/__tests__/session-conversation-area.test.tsx`：通过，覆盖会话区域相邻路径。
- `pnpm --dir packages/nextclaw-agent-chat-ui exec vitest run src/components/chat/hooks/use-sticky-bottom-scroll.test.tsx src/components/chat/ui/chat-message-list/chat-message-list.test.tsx`：通过，覆盖共享聊天 UI 相邻路径。
- `pnpm --dir packages/nextclaw-agent-chat-ui run tsc`：通过。
- `pnpm --dir packages/nextclaw-agent-chat-ui run lint`：通过。
- `pnpm --dir packages/nextclaw-ui run lint`：通过，有既有 doc-browser max-lines warning，无新增错误。
- `pnpm --dir packages/nextclaw-ui run tsc`：未通过，阻塞点是既有 `doc-browser.test.tsx` 的 `toHaveValue` / `toHaveAttribute` matcher 类型声明问题，不在本次触达路径。
- `pnpm --dir packages/nextclaw-agent-chat-ui run build`：通过。
- `pnpm --dir packages/nextclaw-ui run build`：通过，有既有 Vite chunk / dynamic import warning。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`：通过，无阻塞和警告。
- `pnpm lint:new-code:governance`：未通过，阻塞点是工作区已有 NCP WIP 文件的 role-boundary 命名问题，不在本次触达范围。
- `node scripts/governance/checks/lint-new-code-governance.mjs -- <本次触达路径>`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm clean:generated`：通过，生成产物保持干净。

## 发布/部署方式

本轮没有执行部署或发布。

已新增 `.changeset/chat-scroll-to-bottom-action.md`，记录 `@nextclaw/agent-chat-ui` 与 `@nextclaw/ui` 的 patch 级用户可见变更，后续随统一 NPM 发布流程进入 changelog。

## 用户/产品视角的验收步骤

1. 打开一个有较长消息历史的聊天会话。
2. 向上滚动，离开消息底部。
3. 观察消息区域底部中央出现滚动到底部按钮。
4. 点击按钮后，消息列表回到最新消息位置。
5. 回到底部后按钮隐藏；继续流式输出时仍保持原有自动粘底体验。

## 可维护性总结汇总

本次是新增用户可见能力，生产代码允许必要增长。改动没有新增 manager、service 或平行 helper，而是复用并扩展既有滚动 hook owner；页面层只做展示与交互接线。

代码增减报告：总计新增 251 行、删除 35 行、净增 216 行；非测试新增 91 行、删除 31 行、净增 60 行。增长主要来自公开滚动状态/动作、浮动按钮接线、i18n 文案和共享按钮 tooltip 方向参数；测试增长覆盖行为合同。

`post-edit-maintainability-review` 已使用，结论为通过。没有发现新增抽象膨胀、重复滚动链路或样式 owner 外逃；保留债务是未做真实浏览器截图烟测，当前以组件 DOM 测试和 Vite build 作为最小可信替代。

## NPM 包发布记录

涉及 NPM 包发布记录，但本轮不直接发布：

- `@nextclaw/agent-chat-ui`：需要 patch，原因是公开 hook 合同新增 `isAtBottom` 与 `scrollToBottom`。
- `@nextclaw/ui`：需要 patch，原因是聊天会话新增用户可见的滚动到底部按钮。

状态：待后续统一发布流程处理。
