# v0.13.40 Chat Thread Sticky Autoscroll Threshold

## 迭代完成说明（改了什么）

- 修复聊天流式输出时“已在底部但不自动贴底”的问题。
- 在 `ChatConversationPanel` 中强化 sticky 自动滚动策略：
  - 新增 `STICKY_BOTTOM_THRESHOLD_PX = 10` 常量并统一用于 sticky 判定；
  - 当用户滚动位置距离底部 `<= 10px` 时保持 sticky；
  - 在 `uiMessages` 流式更新期间，若仍是 sticky，则每次更新后执行 `scrollToBottom()`，确保最新内容持续可见；
  - 仍保留“用户手动向上滚动超过阈值后脱离 sticky”的行为。

## 测试/验证/验收方式

- 影响面：`packages/nextclaw-ui`（Chat 页面滚动体验）。
- 执行命令：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui build`
- 结果：`tsc` 与 `build` 均通过。
- 冒烟验收建议：
  - 打开 chat 会话，确保滚动条处于底部（或底部 10px 内）；
  - 触发流式输出，观察是否持续自动跟随到底部；
  - 手动上滑超过 10px 后，确认自动贴底停止；
  - 再次回到底部，确认 sticky 跟随恢复。

## 发布/部署方式

- 本次为前端 UI 行为修复，不涉及后端/数据库变更，无需 migration。
- 按前端发布流程执行 `/release-frontend`（或等效流程）。

## 用户/产品视角的验收步骤

1. 在聊天中发送一条会持续流式输出的消息。
2. 保持滚动条在底部或距离底部 10px 内。
3. 预期：新 token 到来时界面会持续自动滚动，底部内容始终可见。
4. 手动向上滚动超过 10px。
5. 预期：自动滚动停止，直到用户手动回到底部阈值内后恢复。
