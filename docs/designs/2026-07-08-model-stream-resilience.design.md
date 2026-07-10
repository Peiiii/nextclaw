# 模型流式中断韧性设计

## 背景

用户在会话中遇到 AI 输出到一半中断，怀疑可能来自上游模型 API、网络或我们自己的流式判断。参考 OpenCode 和 Codex 的实现后，成熟客户端并不假设流式响应一定自然完成，而是显式处理“断流、未收到终端事件、可重试错误、用户取消”这些正常故障形态。

这项改动服务 NextClaw 的自感知与可靠编排：系统必须知道一次模型运行最终使用了什么关键参数、流式响应是否看到了协议终端事件、失败是否可重试，以及错误应该被记录为调试事实还是误判成成功。

## 现状依据

- `packages/nextclaw-core/src/shared/lib/core-utils/features/openai/utils/stream.utils.ts` 的 Chat Completions 流已经要求看到 `finish_reason`，否则抛出错误。
- `packages/nextclaw-core/src/shared/lib/core-utils/features/openai/utils/responses-stream.utils.ts` 的 Responses 流会在 SSE EOF 后直接 `finalizeStreamingResponse`，没有要求看到 `response.completed`。这会让“已收到部分 delta 但上游断流”的场景被当成成功。
- `packages/nextclaw-core/src/features/llm-providers/providers/openai.provider.ts` 现有 `withRetry` 只包住请求创建；开始消费 stream 后若已经外泄 delta，provider 层不能安全地静默重试。
- `packages/nextclaw-kernel/src/services/ncp-agent-runtime-wrapper.service.ts` 是外部 NARP/Codex/OpenCode-like runtime 的统一 wrapper。外部 runtime 已经是独立 agent runtime owner，wrapper 不应再复刻一套 retry，否则会形成两层不一致的恢复语义。
- `packages/ncp-packages/nextclaw-ncp-agent-runtime-next/src/runtime/agent-runtime.service.ts` 是当前 native runtime 的默认实现。它不经过外部 runtime wrapper，因此同一套 attempt 恢复必须落到 native 模型 round 消费层，不能只修 wrapper。
- `packages/nextclaw-kernel/src/managers/agent-run-request.manager.ts` 已经把最终 resolved 的 `run_spec` 写进用户消息 metadata，包括 `runId`、`agentRuntimeId`、`agentId`、`model`、`maxTokens`、`thinkingEffort`、`projectRoot`、`workingDir` 和 `correlationId`。这是轻量调试信息的正确落点，不需要新增平行 metadata owner。

外部参考：

- OpenCode `packages/opencode/src/session/processor.ts` 在 session processor 的 `llm.stream(streamInput)` 外层使用 `Effect.retry(SessionRetry.policy(...))`，并把 session status 设为 `{ type: "retry", attempt, message, action, next }`。
- OpenCode `packages/opencode/src/session/retry.ts` 的无 header 退避策略是 2s 起步、指数退避、30s 封顶；这一层没有额外最大尝试次数。
- OpenCode 的 retry owner 是 session processor，不是 transport wrapper；它发布 retry 状态并重新执行同一个模型 stream，而不是引入 `message.recalled` 这类 NextClaw 专属协议。

## 核心判断

Responses API 的 `response.completed` 是流式成功的终端合同。没有看到它，就不能把累积到的部分文字包装成最终成功结果。

provider 层只能在没有向上游 yield 任何 delta / reasoning / tool call 前做静默重试；一旦输出已经外泄，provider 没有 session 状态，也不能发布 retry 状态，继续静默重跑会造成重复内容。

native runtime 的模型 round 消费层对应 OpenCode 的 session processor：这里可以观察到 NCP session/run/message 事件，因此应该在 retryable stream failure 上发布 `run.metadata({ type: "retry", ... })`，按 2s 指数退避重跑模型 stream。已经外泄的部分输出不撤回，后续 attempt 继续以同一个 assistant message 追加新的 part，保持失败和 retry 过程可观察。

外部 NARP/Codex/OpenCode-like runtime wrapper 不做二次 retry。外部 runtime 如果有自己的 OpenCode/Codex 式 retry，应由它内部负责；NextClaw wrapper 只转发事件，避免同一个 stream failure 被两层 owner 重试。

## 推荐方案

1. 在 Responses 流解析层增加终端合同：
   - text/event-stream 必须看到 `response.completed` 才能产出 `done`；
   - text/plain 但内容形似 SSE 的路径同样适用；
   - 非流式 JSON 保持原有按完整响应解析的行为。
2. 在 OpenAI-compatible provider 增加 stream-consumption 级安全重试：
   - 可重试错误沿用现有 transient 判定：`429`、`5xx`、`ECONNRESET`、`ETIMEDOUT`、`EAI_AGAIN`、`ENOTFOUND`、`UND_ERR_SOCKET`、fetch/socket/timeout/unavailable 等；
   - 新增“未看到 Responses 终端事件”的错误类型也属于可重试；
   - 只有当前 attempt 未向上游消费者 yield 任何 delta / reasoning_delta / tool_call_delta 时才自动重试；
   - 一旦已产生可见输出，失败直接抛出，由 NCP runtime 产出 `run.error`。
3. 在 native runtime 增加 OpenCode-style 模型 stream retry：
   - 共享 runtime stream retry 工具，统一 attempt 状态、可重试判定、`run.metadata({ type: "retry" })` 事件生成和 2s/4s/8s...30s 退避；
   - native runtime 在模型 round 消费层捕获 transient stream failure；
   - 只对 transient stream / network / timeout / provider unavailable 类失败重试；
   - 用户取消不触发 retry；
   - 不设置本层最大尝试次数，保持和 OpenCode session retry policy 一致。
4. 外部 runtime wrapper 保持转发：
   - 不新增 wrapper 级 retry；
   - 不新增 `message.recalled`；
   - 外部 runtime 的失败事件按真实结果进入 session 状态。
5. 在 conversation state manager 中确保同一 assistant message 的多次 `message.text.start` 会追加新的 text part，而不是把下一次 attempt 的 delta 拼进上一段已失败的 partial text part。
6. 在用户消息 `run_spec` 中补一个轻量 `execution` 字段：
   - `contractVersion`
   - `modelProtocol: "ncp-agent-run"`
   - `terminalContracts`
   - `retryPolicy`
   - 只记录非敏感策略，不写 API key、完整 headers 或请求正文。

## Owner 与数据流

- provider owner：`OpenAICompatibleProvider` 和 OpenAI stream utils 负责 OpenAI-compatible wire contract、终端事件识别和 provider 内“未外泄前”重试。
- retry owner：`@nextclaw/ncp-agent-runtime` 暴露共享 runtime stream retry 工具，统一 attempt 状态、可重试判定、retry metadata 和退避时间。
- wrapper owner：`NcpAgentRuntimeWrapper` 负责外部 NARP/Codex/OpenCode-like runtime 事件转发，不做二次 retry。
- runtime owner：`DefaultNcpAgentRuntime` 负责 native 主链路的模型 round retry；它不通过 wrapper，因此必须在 native 消费层调用共享 retry 工具。
- state owner：`DefaultNcpAgentConversationStateManager` 负责同一 assistant message 多次 text start 的 part 边界，保证 retry attempt 不把新 delta 拼到旧 partial part 上。
- request owner：`AgentRunRequestManager` 继续负责把本次运行的 resolved spec 写进用户消息 metadata；本次只扩展现有 `run_spec`，不新增第二套记录路径。
- UI owner：本轮不改 UI。UI 继续消费 `run.error` / message status，不直接理解 provider 的内部错误类型。

数据流：

```text
user message -> AgentRunRequestManager attaches run_spec
  -> native: DefaultNcpAgentRuntime builds model input
  -> native: model round attempt
  -> external: NcpAgentRuntimeWrapper forwards external runtime events
  -> provider / external runtime stream
  -> terminal contract or transient failure
  -> success: message.completed + run.finished
  -> native retryable model stream failure:
       run.metadata(type="retry") + backoff + next model stream attempt
  -> non-retryable failure: message.failed/run.error
```

## 兼容与迁移

这是 bugfix，不保留“Responses EOF 后直接成功”的旧行为。旧行为会掩盖真实断流，是错误合同。

不会对已经完整返回 `response.completed` 的流造成行为变化。Chat Completions 原有“看到 `finish_reason` 即成功，不强依赖 `[DONE]`”的兼容继续保留，因为这是已有真实 provider 行为，并且已由测试覆盖。

## 非目标

- 不做大型 UI retry 状态、消息 reset 或 replay 协议。
- 不把已经产生可见 delta 的 provider stream 在 provider 层静默重放。
- 不在 wrapper 层为外部 runtime 增加二次 retry。
- 不引入 `message.recalled` 恢复协议。
- 不记录敏感请求信息、API key、完整 headers 或完整上下文。
- 不把用户主动终止当错误。
- 不改 legacy NCP runtime 主链路之外的旧实现。

## 验收标准

- Responses SSE 输出部分 delta 后 EOF 且没有 `response.completed`：不能产出 `done`，应抛出 “ended before response.completed” 类错误。
- 同一场景若第一次在产生任何可见输出前失败、第二次完整完成：provider 应自动重试并只产出第二次成功结果。
- 同一场景若 native runtime 第一次已经产生文本输出后遇到 retryable stream failure：native 模型 round 应发出 `run.metadata({ type: "retry", attempt, message, action, next })`，按 2s 起步指数退避后重跑模型 stream。
- 同一场景若外部 runtime 中途失败：wrapper 不新增二次 retry，应透传外部 runtime 的真实失败事件。
- 用户取消不触发自动重试。
- Chat Completions 既有“finish_reason 后无 [DONE] 也能成功”测试继续通过。
- 用户消息 metadata 的 `run_spec` 包含轻量 `execution` 诊断字段。
- 触达 TypeScript 运行链路，必须跑对应 package 测试、`tsc`、lint、治理与可维护性检查。

## 后续实现顺序

1. 增加 Responses stream terminal contract error。
2. 给 OpenAI-compatible stream consumption 增加“未外泄输出前可重试”的 attempt 循环。
3. 扩展 `run_spec.execution` 轻量诊断字段和测试。
4. 补 provider 定向测试覆盖 EOF、retry、no-duplicate-retry。
5. 抽出共享 runtime stream retry 工具。
6. 在 `DefaultNcpAgentRuntime` 模型 round 增加 OpenCode-style retry。
7. 确认 `NcpAgentRuntimeWrapper` 不新增二次 retry。
8. 跑定向测试、package tsc/lint、governance 与可维护性检查。
