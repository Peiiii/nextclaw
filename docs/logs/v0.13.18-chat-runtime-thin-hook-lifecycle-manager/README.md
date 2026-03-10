# v0.13.18-chat-runtime-thin-hook-lifecycle-manager

## 迭代完成说明（改了什么）

- Chat runtime 主链路按 agent-kit 思路继续收敛：`AgentChatController -> IAgent.run()`，React hook 仅做订阅与动作转发。
- `@nextclaw/agent-chat` 补齐 run 生命周期通用能力：
  - 新增 `RUN_METADATA` 事件类型。
  - `RUN_STARTED/RUN_FINISHED/RUN_ERROR` 统一支持 `runId`。
  - `AgentChatController` 新增 `activeRunId$ / isAwaitingResponse$ / runCompleted$ / runError$ / runMetadata$`。
- `nextclaw-ui` 中将 run 编排逻辑下沉到 `ChatRunLifecycleManager`，`useChatRuntimeController` 薄化。
- `NextbotRuntimeAgent` 统一通过 `AgentEvent` 通道上报 ready/final 元信息（`RUN_METADATA`），并在 `abortRun()` 内执行本地流中断 + 后端 stop run。
- 继续收敛 `NextbotRuntimeAgent`：将 `run` 主流程拆分为 `createRunObservable/openRunStream/finalizeRunState` 与若干纯函数事件处理器，去除该文件的超长函数告警，同时保持行为不变。
- 修复前端 `Maximum update depth exceeded` 循环更新问题：
  - `historyMessages` 改为 `useMemo` 稳定引用，避免空数据场景每次渲染都生成新数组触发 `applyHistoryMessages` 连锁更新。
  - `ChatRunLifecycleManager` 增加 `clearMessagesIfNeeded()`，避免重复 `setMessages([])` 导致无效消息流更新。
- 方案文档：[`2026-03-10-chat-runtime-agent-align.md`](../../designs/2026-03-10-chat-runtime-agent-align.md)

## 测试/验证/验收方式

- 影响面判定：本次改动触达 chat 运行时主链路（发送、流式、事件、中断），需要执行 `tsc/lint/build` 最小充分验证。
- 已执行：
  - `pnpm --filter @nextclaw/ui tsc`
  - `pnpm --filter @nextclaw/ui lint`
  - `pnpm --filter @nextclaw/ui build`
  - `pnpm --filter @nextclaw/ui dev --host 127.0.0.1 --port 4173` + `curl -s http://127.0.0.1:4173/`
- 说明：
  - `pnpm --filter @nextclaw/agent-chat tsc` 受包内既有 node16 ESM 扩展名基线问题影响失败（非本迭代新增问题）。

## 发布/部署方式

- 本迭代为前端/runtime 逻辑重构，按常规前端发布链路执行：
  1. 合并变更后触发 UI 构建产物发布。
  2. 发布后在目标环境执行 chat 链路冒烟（发送、流式输出、停止运行、恢复运行）。
- 不适用项：
  - 远程 migration：不适用（未涉及后端 schema 或数据库变更）。

## 用户/产品视角的验收步骤

1. 打开 chat 页面，选择一个会话发送消息，确认用户消息立即出现，随后出现流式 assistant 输出。
2. 在运行中点击停止，确认生成停止且无卡死；再次发送消息可正常开始新一轮运行。
3. 对可恢复 run 执行 resume，确认继续输出并在完成后刷新会话历史。
4. 人为触发一次发送错误，确认出现本地错误消息，且输入草稿按预期恢复（当场景要求恢复时）。
