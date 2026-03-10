# Iteration v0.13.3-chat-stream-strictmode-destroy-fix

## 迭代完成说明（改了什么）
- 修复空会话发送时 `optimisticUserEvent` 可能始终为 `null` 的问题。
- 根因：`useChatStreamController` 在 effect cleanup 中调用 `manager.destroy()`，在 React StrictMode 开发重挂载检查时会提前触发 cleanup，导致 stream manager 被永久销毁。
- 修复：cleanup 改为 `manager.resetStreamState()`，仅清理运行态，不销毁 manager 实例。
- 文件：
  - `src/components/chat/useChatStreamController.ts`

## 测试/验证/验收方式
- ESLint（受影响文件）：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui exec eslint src/components/chat/useChatStreamController.ts`
- 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc --noEmit`
- UI 构建：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C . build:ui`

## 发布/部署方式
- 本次为前端运行时行为修复，无后端/数据库变更。
- 按现有前端发布流程发布 UI 即可，无 migration。

## 用户/产品视角的验收步骤
1. 打开开发环境（StrictMode 开启）。
2. 空会话直接回车发送消息。
3. 观察消息列表：用户消息应立刻出现（optimistic），不再出现发送后完全空白直到结束的情况。
