# Iteration v0.13.5-stream-run-controller-uses-manager

## 迭代完成说明（改了什么）
- `StreamRunController` 不再通过“上下文对象”间接使用 manager。
- 构造函数直接持有 manager（`this.manager.xxx`），并通过 `manager.getParams/getRunIdRef/getActiveRunRef/getSetters` 取依赖。
- `ChatStreamManager` 暴露上述 getter，保持调用点不变。

## 测试/验证/验收方式
- ESLint（受影响文件）：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui exec eslint src/components/chat/chat-stream/stream-run-controller.ts src/components/chat/managers/chat-stream.manager.ts`
- 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc --noEmit`
- UI 构建：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C . build:ui`

## 发布/部署方式
- 本次为前端结构调整，无后端/数据库变更。
- 按常规前端发布流程即可，无 migration。

## 用户/产品视角的验收步骤
1. 空会话回车发送消息，确认即时显示与流式回复正常。
2. 运行中再次发送，确认中断/入队策略不变。
3. 停止生成，确认状态与队列行为正常。
