# v0.12.91 chat stream class-file kebab alignment

## 迭代完成说明（改了什么）
- 按“一类一文件 + 文件名与类名对齐（kebab-case）”重构 chat stream 控制层。
- 拆分并落地：
  - `StreamRunController` -> `chat-stream/stream-run-controller.ts`
  - `ChatStreamFlowController` -> `chat-stream/chat-stream-flow-controller.ts`
  - `ChatStreamRuntimeController` -> `chat-stream/chat-stream-runtime-controller.ts`
- 删除旧聚合文件 `chat-stream/controller.ts`，更新依赖导入到新文件路径。
- `chat-stream.manager.ts` 的 runtime 引用同步改为新路径。

## 测试/验证/验收方式
- 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc --noEmit`
- Lint（受影响文件）：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui exec eslint src/components/chat/chat-stream/chat-stream-runtime-controller.ts src/components/chat/chat-stream/chat-stream-flow-controller.ts src/components/chat/chat-stream/stream-run-controller.ts src/components/chat/managers/chat-stream.manager.ts`
- 构建验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm build:ui`

## 发布/部署方式
- 本次仅内部结构重构，不涉及发布流程变更。
- 如需发布 UI，按既有前端发布流程执行并补充冒烟记录。

## 用户/产品视角的验收步骤
1. 进入 chat 页面发送消息，确认消息即时显示并正常返回回复。
2. 运行中连续发送两条消息，确认进入队列并按顺序处理。
3. 运行中执行停止，再发送新消息，确认状态切换与发送逻辑正常。
4. 刷新页面回到同一会话，确认历史消息和运行状态一致。
