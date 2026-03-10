# Iteration v0.13.2-chat-merge-events-stateless-function

## 迭代完成说明（改了什么）
- 将消息合并逻辑从 `useMergedEvents` 中拆分为无状态纯函数 `mergeChatEvents`。
- 新增文件：
  - `src/components/chat/chat-merged-events.ts`
- `useMergedEvents` 现在仅负责 `useMemo` 包装，不再承载具体合并算法。
- 行为保持不变：仍按 history + optimistic + streaming 合并，并继续忽略后端 streamed user event 对用户消息展示的干扰。

## 测试/验证/验收方式
- 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc --noEmit`
- ESLint（受影响文件）：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui exec eslint src/components/chat/chat-merged-events.ts src/components/chat/chat-page-runtime.ts`
- UI 构建：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C . build:ui`

## 发布/部署方式
- 本次仅前端内部结构调整，无后端/数据库变更。
- 按常规前端发布流程即可，无 migration。

## 用户/产品视角的验收步骤
1. 新会话回车发送消息，确认用户消息可立即显示。
2. 等待 AI 流式回复，确认消息顺序与显示无异常。
3. 重复发送多轮，确认历史消息与实时消息合并稳定。
