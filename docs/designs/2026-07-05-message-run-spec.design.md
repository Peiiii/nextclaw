# Message Run Spec 轻量记录设计

## 背景

会话列表能通过 session summary 的 `last_activity_preview` 看到失败状态，但失败发生后，详情页和消息本体缺少“这次到底用什么参数运行”的轻量事实。实际排查 `ncp-mr6pdux2-f8ddbd11` 时，只能从配置文件和 panel app 请求路径反推模型来源，无法直接从触发消息知道最终使用的模型、agent、runtime、max tokens 或 thinking effort。

这会削弱 NextClaw 的自感知能力：系统知道任务失败了，却没有把“失败的是哪一次运行、按什么参数运行”记录在最贴近触发点的位置。

## 设计判断

运行参数不应作为新的全局日志系统，也不应塞进会话级错误展示。它是某条用户消息触发一次 agent run 的运行事实，因此最合适的归属是触发消息的 `message.metadata.run_spec`。

这个判断基于三点：

1. `NcpMessage.metadata` 本来就是 transport/application-level metadata。
2. `AgentRunRequestManager.send` 是最终解析 session、model、agent、runtime 并启动运行的 owner。
3. 非 assistant 消息的 metadata 已经会通过 `MessageSent`、journal 和 legacy bridge 被保存；不需要新增旁路持久化。

## 字段合同

`message.metadata.run_spec` 使用轻量对象，记录排查失败最需要的事实：

```ts
{
  version: 1,
  runId: string,
  startedAt: string,
  sessionId: string,
  agentRuntimeId: string,
  agentId: string,
  model: string,
  modelSource: "request" | "session" | "default",
  requestedModel?: string,
  maxTokens?: number,
  thinkingEffort?: string | null,
  projectRoot?: string,
  workingDir?: string,
  correlationId?: string
}
```

`modelSource` 用来解释最终模型来自哪里。比如 panel app 没传 model 时，失败消息上仍能看到最终模型，以及它来自 session 还是默认配置。

## 数据流

1. `agent-run.send` 或 `agent-run.sessionMessageRequest` 进入 `AgentRunRequestManager.send`。
2. manager 获取或创建 session，并创建 `SessionRun`。
3. manager 调用 `beginRun()` 得到 `runId`。
4. manager 解析最终 `AgentRunSpec`。
5. manager 在入队前把 `run_spec` 合并到触发 user message 的 metadata。
6. runtime wrapper drain inbox，生成 `MessageSent` 事件。
7. journal 和 legacy bridge 按现有主链路持久化这条 message metadata。
8. session metadata 恢复时跳过 `run_spec`，避免把单次运行事实膨胀成会话级状态。

## 非目标

- 不展示新的 UI 调试面板。
- 不把 provider API key、完整 prompt、工具参数、上下文块写入 metadata。
- 不把 runtime input metadata 反向当作消息持久化事实源。
- 不新增并行日志、sidecar 或独立 debug store。

## 实现计划

1. 在 `AgentRunRequestManager` 内部新增窄 helper，构造 `run_spec` 并合并到 message metadata。
2. 调整 `send` 的顺序：先 `beginRun` 和解析 spec，再入队带 `run_spec` 的 message。
3. 保持 context/tool/runtime 使用同一条带 metadata 的 `providerRequest.message`。
4. 保持 session metadata 提取逻辑忽略 `run_spec`。
5. 补充 `AgentRunRequestManager` 测试：无请求 model 时记录 default 模型来源，并验证 session metadata 不被 `run_spec` 污染。
6. 更新本次迭代记录和 changeset。

## 验收标准

- 触发消息被 enqueue 前已经包含 `metadata.run_spec`。
- runtime 收到的 `AgentRunSpec` 与 message metadata 中的核心字段一致。
- 原始 message metadata 不丢失。
- `run_spec` 不污染 session metadata，也不改变 session summary 错误展示主链路。
- `@nextclaw/kernel` 定向测试、tsc、lint 与治理检查通过。
