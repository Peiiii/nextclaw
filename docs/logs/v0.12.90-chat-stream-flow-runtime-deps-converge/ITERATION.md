# v0.12.90 chat stream flow/runtime deps converge

## 迭代完成说明（改了什么）
- 收敛 `ChatStreamRuntimeController` 与 `ChatStreamFlowController` 的调用边界：
  - runtime 不再在每次调用时传入大对象（`runSend/stopCurrentRun/setters/ref` 等）。
  - flow 改为 constructor 一次性注入依赖，运行期调用仅保留业务参数（`payload/run/options`）。
- 调整调用签名：
  - `executeSendMessagePolicy(payload)`
  - `executeResumePendingRun(run)`
  - `executeStopActiveRun(options?)`
  - `executeSendPendingMessage(item, options?)`
  - `resetStreamingState()`
- 将发送策略逻辑收敛到 `ChatStreamFlowController.executeSendMessagePolicy`，减少函数对象在模块间传递。
- `ChatStreamRuntimeController` 内部实例方法统一为箭头函数，规避 `this` 绑定歧义并保持 manager/controller 风格一致。

## 测试/验证/验收方式
- 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc --noEmit`
- Lint（受影响文件）：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui exec eslint src/components/chat/chat-stream/controller.ts src/components/chat/chat-stream/runtime-controller.ts src/components/chat/useChatStreamController.ts src/components/chat/managers/chat-stream.manager.ts`
- 构建验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm build:ui`

## 发布/部署方式
- 本次为前端内部重构，无发布动作。
- 如需发布 UI：按既有流程执行前端发布命令并记录版本与冒烟结果。

## 用户/产品视角的验收步骤
1. 在 chat 页发送消息，确认消息立即显示，AI 正常回复。
2. AI 运行中连续发送两条消息，确认进入队列并按顺序发送。
3. AI 运行中点击发送（中断策略），确认会先停止当前运行，再发送新消息。
4. AI 回复结束后确认“运行中”状态及时退出，停止按钮不可用。
5. 刷新页面后进入同一会话，确认消息与运行状态一致。
