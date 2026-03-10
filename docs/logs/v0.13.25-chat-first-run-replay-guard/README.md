# v0.13.25-chat-first-run-replay-guard

## 迭代完成说明（改了什么）
- 继续修复“首条消息回复完成后仍显示正在回复中，随后又追加一条重复回复”的问题。
- 在 `useSessionRunStatus` 增加更强的自动 `resume` 防重放策略：
  - 新增 `locallySettledAtBySessionRef`，记录本地 run 刚结束时间。
  - 自动 `resume` 前新增 `requestedAt` 判定：若远端活跃 run 的 `requestedAt` 不晚于本地刚结束窗口，判定为同一 run 重放，跳过 `resume`。
  - 对无可解析 `requestedAt` 的情况增加短冷却保护，避免旧 run 状态滞后导致重放。
  - 在本地 run 结束时，若 `ready.runId` 未拿到，回退使用 `activeRunBySessionKey` 的当前 `runId` 作为 completed run 记录，覆盖“首条消息无 runId”场景。

## 测试/验证/验收方式
- 执行：
  - `pnpm --filter @nextclaw/ui tsc`
  - `pnpm --filter @nextclaw/ui build`
- 结果：均通过。

## 发布/部署方式
- 本次仅涉及前端逻辑修复，按现有 UI 发布流程执行即可：
  - 合并后执行 `@nextclaw/ui` 构建并走既有部署管线。

## 用户/产品视角的验收步骤
1. 在新会话发送第一条消息。
2. 等待 assistant 回复结束，观察“正在回复中”是否立即消失。
3. 继续等待 10 秒，确认不会再次追加一条完全相同的 assistant 卡片。
4. 在会话切换后再返回，确认不会触发同一 run 的重复恢复。
