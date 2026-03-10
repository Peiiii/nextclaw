# v0.13.26-chat-auto-resume-single-shot-guard

## 迭代完成说明（改了什么）
- 针对“回复完成后仍显示正在思考中，随后又追加一条重复回复”的链路，新增自动恢复运行（auto-resume）单次资格机制：
  - 仅在“进入会话”时给该会话一次 auto-resume 资格。
  - 一旦本地 run 进入运行态（`isLocallyRunning=true`），立即取消该会话 auto-resume 资格。
  - 执行过一次 auto-resume 后，立即消费并移除资格，避免同会话重复触发 resume。
- 该策略从机制上阻断“本地 run 已完成后再次 resume 同一后端 run”的重放回路。

## 测试/验证/验收方式
- 执行：
  - `pnpm --filter @nextclaw/ui tsc`
  - `pnpm --filter @nextclaw/ui build`
- 结果：均通过。

## 发布/部署方式
- 本次仅前端逻辑调整，按现有 UI 发布流程：
  - 合并后执行 `@nextclaw/ui` 构建并走既有部署流程。

## 用户/产品视角的验收步骤
1. 在会话内发送首条消息。
2. 回复完成后观察底部“正在思考中/正在回复中”是否立即消失。
3. 继续等待 10-20 秒，确认不会出现重复 assistant 卡片。
4. 切换到另一个存在进行中 run 的会话，确认仍可触发一次自动恢复并继续流式显示。
