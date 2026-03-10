# Iteration v0.13.4-chat-stream-controller-depend-on-manager

## 迭代完成说明（改了什么）
- `StreamRunController` 不再接收完整 `ExecuteStreamRunParams`，改为依赖 `ChatStreamManager`：
  - 构造时传入 `manager + payload`，运行时从 manager 获取上下文（refs、params、setters）。
  - 减少参数透传，收敛职责。
- 新增 `StreamRunManagerLike` 与 `StreamRunPayload` 类型，明确 controller 依赖边界。
- `ChatStreamManager` 新增 `getRunContext()` 供 controller 读取运行上下文。
- `ChatStreamManager` 调用点改为 `new StreamRunController(this, payload).execute()`。

## 测试/验证/验收方式
- ESLint（受影响文件）：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui exec eslint src/components/chat/chat-stream/stream-run-controller.ts src/components/chat/managers/chat-stream.manager.ts`
- 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc --noEmit`
- UI 构建：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C . build:ui`

## 发布/部署方式
- 本次仅前端结构调整，无后端/数据库变更。
- 按常规前端发布流程即可，无 migration。

## 用户/产品视角的验收步骤
1. 空会话回车发送消息，确认即时显示与流式回复正常。
2. 运行中再次发送，确认中断/入队策略不变。
3. 停止生成，确认状态与队列行为正常。
