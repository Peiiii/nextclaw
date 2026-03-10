# v0.13.33-chat-enter-session-auto-scroll-bottom

## 迭代完成说明（改了什么）
- 修复“进入会话后展示在最早内容而不是最新内容”的滚动问题。
- 在 `ChatThreadManager` 增加“会话切换后一次性强制滚到底部（instant）”机制：
  - 当 `selectedSessionKey` 变化时，重置 `isUserScrolling`，并标记该会话为 `pendingInitialScrollSessionKey`。
  - 当该会话历史加载完成且有消息时，立即 `scrollTop = scrollHeight`，确保首屏显示最新内容。
  - 正常增量更新仍走原自动滚动逻辑，并保留用户上滑后的防打断行为。

## 测试/验证/验收方式
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/ui build`
- 结果：均通过。

## 发布/部署方式
- 本次仅涉及 `@nextclaw/ui` 前端。
- 按现有前端部署流程发布即可。

## 用户/产品视角的验收步骤
1. 进入一个历史消息较多的会话。
2. 观察首屏位置，应直接定位到最底部的最新消息（非平滑动画，instant）。
3. 切换到另一个会话重复验证。
4. 手动上滑后等待新消息，确认不会被强制打断滚动位置。
