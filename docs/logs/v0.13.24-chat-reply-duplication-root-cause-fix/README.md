# v0.13.24-chat-reply-duplication-root-cause-fix

## 迭代完成说明（改了什么）
- 修复 `@nextclaw/agent-chat` 中同一 `messageId` 被重复追加导致的重复回复卡片问题：
  - `AgentChatController.addMessages` 改为按 `id` upsert，已存在则更新、不再重复 append。
  - `AgentEventHandler` 的 `TEXT_DELTA` / `REASONING_DELTA` 处理改为按 `messageId` 全量查找更新，不再依赖“最后一条消息必须命中”。
- 修复 `nextclaw-ui` 自动恢复运行链路中“本地已完成 run 被再次 resume 重放”的问题：
  - 在 `useSessionRunStatus` 增加“最近本地完成 runId”记忆并在自动 resume 时过滤同 runId。
  - 保留原有短暂 suppression，但不再依赖时间窗口避免重复重放。

## 测试/验证/验收方式
- 类型检查：
  - `pnpm --filter @nextclaw/agent-chat tsc`
  - `pnpm --filter @nextclaw/ui tsc`
- Lint：
  - `pnpm --filter @nextclaw/agent-chat lint`
  - `pnpm --filter @nextclaw/ui lint`
- 构建：
  - `pnpm --filter @nextclaw/ui build`
- 冒烟（UI）：
  - Chat 页发送一条消息，确认 assistant 回复只出现一次，不再在完成后追加重复卡片。
  - 回复完成后等待数秒，确认不会再次进入“正在回复中”并重复渲染同 run 内容。

## 发布/部署方式
- 本次为前端与 `@nextclaw/agent-chat` 逻辑修复，按常规前端发布流程执行：
  - 合并后执行 UI 发布流程（如 `pnpm --filter @nextclaw/ui build` + 既有部署管线）。
  - 如需同时发包 `@nextclaw/agent-chat`，走仓库既有 npm 发布流程（changeset/version/publish）。

## 用户/产品视角的验收步骤
1. 打开 Chat 页，任选一个会话发送消息。
2. 观察 assistant 输出过程，确认不会出现“同内容双卡片”。
3. 等待回复彻底结束，再等待 5-10 秒，确认不会再次出现“正在回复中”且不会新增重复卡片。
4. 在有运行中任务的会话间切换，确认只会恢复真正未完成的 run，不会重放刚刚本地已完成的 run。
