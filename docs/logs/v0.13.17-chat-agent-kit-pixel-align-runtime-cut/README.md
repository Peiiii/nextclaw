# v0.13.17-chat-agent-kit-pixel-align-runtime-cut

## 迭代完成说明

本次迭代按“尽可能像素级对齐 agent-kit”执行了 chat 核心链路重构，只覆盖发消息、流式输出、事件处理、中断与 run 生命周期。

- 删除 `nextclaw-ui` 里的重状态机类：`nextbot-chat-runtime.ts`。
- 主链路切到 `AgentChatController -> IAgent.run()`，发送与恢复统一走 controller：
  - `handleSendMessage(..., { runOptions })`
  - `runAgent({ runId, metadata })`
  - `abortAgentRun()`
- `NextbotRuntimeAgent` 聚焦为 IAgent 适配器（SSE -> AgentEvent），并保留 nextbot 必需的 ready/final/transport side-channel。
- `NextbotRuntimeAgent.abortRun()` 现在内建后端 stop run 语义（ready 后记录 runId 并调用 stop API）；外部统一调用 `AgentChatController.abortAgentRun()`。
- `ChatPresenter` 改为按 agent-kit 方式注入 agent provider（`runtimeAgent + getToolDefs/getContexts/getToolExecutor`）。
- `useChatRuntimeController` 保留薄接线与宿主差异桥接（history hydrate、stop run、session/refetch 同步）。
- `@nextclaw/agent-chat` 的 run lifecycle 事件补充 `runId?: string`（`RUN_STARTED/RUN_FINISHED/RUN_ERROR`）。

设计文档：

- [Chat Runtime / Agent Alignment](../../designs/2026-03-10-chat-runtime-agent-align.md)

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui tsc`：通过。
- `pnpm --filter @nextclaw/ui lint`：通过（0 error，存在仓库级 warning）。
- `pnpm --filter @nextclaw/ui build`：通过（`tsc + vite build` 成功）。

链路验收关注点：

1. 发送消息后用户消息先出现，assistant 按流式事件持续更新。
2. stop 时本地可立即 abort，且在拿到后端 runId 时会触发后端 stop API。
3. resume 走同一 `runAgent(metadata.mode=resume)` 链路。
4. history hydrate 后消息、reasoning、tool 调用可正确回填。

## 发布/部署方式

本次为前端内部重构，未触达后端/数据库，不涉及 migration。发布按常规前端包流程执行即可；若本次不发版，此项标记为“不适用（内部重构验证完成）”。

## 用户/产品视角的验收步骤

1. 进入 chat 页面，发送一条新消息，确认消息链路正常（用户消息 -> assistant 流式输出）。
2. 在输出进行中点击停止，确认 UI 立即停止；可停止场景下后端 run 同步停止。
3. 进入有运行中的会话，验证 resume 可继续接收流式输出。
4. 切换到已有历史会话，确认历史消息（含 tool/reasoning）渲染正确。
