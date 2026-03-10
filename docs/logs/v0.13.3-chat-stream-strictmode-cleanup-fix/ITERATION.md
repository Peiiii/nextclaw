# Iteration v0.13.3-chat-stream-strictmode-cleanup-fix

## 迭代完成说明（改了什么）
- 修复 `optimisticUserEvent` 在开发环境可能长期为 `null` 的问题。
- 根因：`useChatStreamController` 的 effect cleanup 调用了 `manager.destroy()`，在 React StrictMode 下会触发开发期额外 cleanup，导致 manager 被永久销毁，后续状态更新被丢弃。
- 修复：cleanup 中改为 `manager.resetStreamState()`，保留 manager 实例与订阅能力，只清理运行态。
- 修改文件：
  - `src/components/chat/useChatStreamController.ts`

## 测试/验证/验收方式
- ESLint（受影响文件）：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui exec eslint src/components/chat/useChatStreamController.ts`
- 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc --noEmit`
- UI 构建：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C . build:ui`

## 发布/部署方式
- 本次仅前端行为修复，无后端/数据库改动。
- 按常规前端发布流程即可，无 migration。

## 用户/产品视角的验收步骤
1. 在空会话输入消息按回车，确认用户消息立即出现（optimistic）。
2. 等待 AI 回复，确认消息链路持续显示，不再出现“先空白后补齐”。
3. 重复发送多轮，确认回归稳定。
