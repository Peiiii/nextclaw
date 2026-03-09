# v0.12.92 chat stream flow remove pass-through methods

## 迭代完成说明（改了什么）
- 清理 `ChatStreamFlowController` 内“仅转发到当前类私有方法”的中间商方法。
- 将以下公开方法改为直接内联业务逻辑，不再 `this.xxx()` 套壳：
  - `reorderQueuedMessageToFront`
  - `executeSendPendingMessage`
  - `executeResumePendingRun`
  - `executeStopActiveRun`
- 删除对应私有转发实现，减少无效层级与调用跳转。

## 测试/验证/验收方式
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc --noEmit`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui exec eslint src/components/chat/chat-stream/chat-stream-flow-controller.ts src/components/chat/chat-stream/chat-stream-runtime-controller.ts src/components/chat/chat-stream/stream-run-controller.ts`
- `PATH=/opt/homebrew/bin:$PATH pnpm build:ui`

## 发布/部署方式
- 本次为前端内部结构优化，无额外发布动作。
- 如需发布，按既有前端发布流程执行并补冒烟记录。

## 用户/产品视角的验收步骤
1. 正常发送消息，确认消息可见且回复正常。
2. 运行中继续发送，确认队列与中断策略行为不变。
3. 点击停止当前运行，确认停止与状态切换正常。
4. 刷新后重进会话，确认消息与运行状态一致。
