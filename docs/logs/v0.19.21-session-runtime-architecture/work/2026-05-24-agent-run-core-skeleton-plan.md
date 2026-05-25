# Agent Run 核心运行态骨架临时方案

关联大方案：[会话运行态与持久化架构设计草案](../../../designs/2026-05-23-session-runtime-architecture-design.md)。

## 当前目标

本轮先不改 session summary event、context-window API，也不接管现有 agent run 主链路。

目标是先在 kernel 内部建立一套新的核心运行态骨架，让后续迁移有稳定形状可对齐：

- `SessionRun`：纯运行态 owner，内部持有现有 `ConversationStateManager`，暴露 `inbox`、`beginRun()`、`abortRun(...)`、`applyEvents(...)` 和 `getSnapshot()`。
- `MessageInbox`：通用 FIFO 队列，供用户新消息进入运行中的 agent loop。
- `SessionRunManager`：管理 `sessionId -> SessionRun`，通过 `SessionRepository` 读取初始化 messages，不发布 eventBus、不创建 runtime。
- 拥有 `start()` / `dispose()` 的长期 owner 使用 `cleanups` collection 管理订阅生命周期，不额外引入公共 lifecycle interface。
- `AgentRunRequest` / `AgentRunSpec`：区分系统请求原料和 agent loop 必需参数。
- `ContextProviderManager`：按 request 构造 prompt context blocks。
- `ToolProviderManager`：按 request 构造本轮可用 tools。
- `AgentRuntimeManager`：注册制 runtime owner，按 `agentRuntimeId` 解析并缓存新形态 runtime 实例。
- `agentRuntimeId` 是新架构 contract 字段；当前旧系统的 `engine` / `runtime` / `session_type` 只作为迁移映射来源。默认 runtime id 由 session 创建侧解析并写入 manifest，`AgentRuntimeManager.getOrCreate(...)` 必须显式传入 `agentRuntimeId`，不能在 manager 内手写或兜底默认值。
- `AgentRunRequestManager`：作为未来上层编排者，先保留 contract 形状，后续再接 ingress 和旧链路替换。

## 非目标

- 不修改旧 `packages/nextclaw-kernel/src/managers/session-run.manager.ts`。
- 不修改旧 `packages/nextclaw-kernel/src/managers/agent-run-request.manager.ts`。
- 不改 `NcpAgentRuntime` 公共协议。
- 不迁移持久化格式。
- 不把 `contextWindow` 放入 `SessionRun` 或 `ConversationStateManager`。
- 不新增临时兼容 alias。

## 落点

新增隔离 feature root：

```text
packages/nextclaw-kernel/src/features/agent-run/
  index.ts
  types/agent-run.types.ts
  managers/session-run.manager.ts
  managers/agent-runtime.manager.ts
  managers/context-provider.manager.ts
  managers/tool-provider.manager.ts
  managers/agent-run-request.manager.ts
```

暂不从 `packages/nextclaw-kernel/src/index.ts` 导出，避免和旧 manager 公共入口冲突。

## 第一批验收

当前设计仍在快速讨论期，第一批先用 TypeScript、lint 和治理检查约束基本形状，不写大量细粒度行为测试，避免过早把不稳定 API 冻住。

第一批只要求：

- `SessionRun` / `SessionRunManager` / `MessageInbox` 的类型边界能表达纯运行态职责。
- `AgentRuntimeManager` 是注册制 owner，而不是 constructor 注入单个 factory。
- 业务 manager 直接持有稳定依赖，不使用 `options` / `params` / `deps` 容器隐藏真实 owner 拓扑。
- `ContextProviderManager` / `ToolProviderManager` 都采用 `register(...) -> unregister` 形态。
- `AgentRunRequestManager` 保留未来上层编排者形状，但暂不接管旧 ingress 主链路。
- `AgentRunRequestManager` 直连 `Ingress`、`EventBus` 和当前 session owner，不使用 `loadSessionRunSeed` / `publishEvent` 这类流程 callback。
- `AgentRunRequestManager.send` 保持主流程直写：session get/create、SessionRun get/create、inbox 入队、`sessionRun.beginRun()`、spec 构造、runtime 获取、context/tools 构造、启动后台 RxJS 管道后立即返回；不要拆出 `resolveSessionRunSeed` / `toRunSpec` 这类只用一次且无稳定边界的小私有函数。
- runtime event pipeline 作为 RxJS 试点：不要单独命名成 `runtimeEvents` 变量，也不要拆私有函数；用 `from(runtime.run(...))` 承接 async iterable，`tap(...)` 桥接 event bus，`catchError(...)` 转换为 `run.error`。
- abort request 只是控制信号，不是持久化事件；`AgentRunRequestManager.abort` 只调用 `sessionRun.abortRun(...)`，不写 session event，不发布 eventBus。aborted 事实必须由 agent runtime 自己 yield，再走 runtime event pipeline 持久化和广播。
- `AgentRunRequestManager` 只在 ingress 边界做请求转换；内部 manager/runtime/session 之间按明确 contract 协作，不做多套 metadata alias fallback，不在 runtime event payload 上补字段，不用调用方层层防卫掩盖 contract owner 的责任。
- `AgentRunRequest.model` / `maxTokens` 是请求者可选材料，不是 request 必填项；最终 `AgentRunSpec` 在 `AgentRunRequestManager` 内结合系统配置解析，默认 model 来自 `config.agents.defaults.model`，默认 max tokens 优先来自当前模型的 `agents.defaults.models[model].params.max_tokens`，再落到运行态默认值。
- `SessionRun` 拥有当前 run 的 abort controller；`AgentRunRequestManager` 不维护 `activeRuns` map，也不直接 new `AbortController`。
- `AgentRunRequestManager.send` 不创建 `resolvedRequest`，不把 `firstMessage` 塞进 session 创建 API；request、session 和本次入队 message 保持分离。
- 新骨架暂不从 kernel 根入口导出，避免对外形成未稳定合同。

等 `AgentRunRequest`、`AgentRunSpec`、provider 输入、runtime 事件 apply 归属讨论稳定后，再补少量合同测试。

## 后续迁移顺序

1. 用新 `AgentRunRequestManager` 接一条测试用 ingress 链路。
2. 新增独立的 native runtime next package，按新运行态 contract 重写 native runtime。
3. 将旧 `AgentRunRequestManager` 的核心 run 流程迁到新 request manager。
4. 将旧 `SessionRunManager` 中的运行态职责迁入新 `SessionRunManager`。
5. 删除旧 `liveSession / activeExecution` 混合职责。

## Native Runtime Next Package 方案

旧 `DefaultNcpAgentRuntime` 不是适合直接包装的对象。它的构造和运行模型绑定旧 `NcpAgentRunInput.metadata`、旧 context builder、旧 tool registry 和旧 state manager。继续做 `NcpAgentRuntime -> AgentRuntime` adapter，会把旧边界重新带进新架构。

本轮改为新增一个临时隔离包：

```text
packages/ncp-packages/nextclaw-ncp-agent-runtime-next/
  src/
    index.ts
    runtime/
      agent-runtime.service.ts
```

包名使用 `@nextclaw/ncp-agent-runtime-next` 表达临时隔离；包内文件和 class 使用终态命名，不使用 `V2`：

```ts
export class DefaultNcpAgentRuntime { ... }
```

这个包可以临时依赖旧 `@nextclaw/ncp-agent-runtime`，但只复用稳定 primitives；不导入旧 `DefaultNcpAgentRuntime`，不复用旧 runtime class 的 state manager / metadata / context builder 边界。

当前已从旧包拆出并导出的可复用 primitive：

- `ncpMessageToOpenAiMessages(...)`：把 NCP message 转成 OpenAI message，供旧 context builder 和新 runtime 共同使用。
- `DefaultNcpRoundCollector`：从 OpenAI chunk 收集本轮 assistant text/reasoning/tool calls，供旧 runtime 和新 runtime 共同使用。
- `executeCollectedToolCall(...)`：统一 tool-call args parse、schema validation、tool custom validation、执行异常转失败结果。
- 既有 `DefaultNcpStreamEncoder`、`buildOpenAiFunctionTool`、`ToolResultContentManager`、`parseToolArgs` / `validateToolArgs` 等继续作为底层 primitive 复用。

模型输入组装不属于 agent runtime loop 本体。新 runtime 只依赖外部传入的 `AgentModelInputBuilder` contract：

```ts
interface AgentModelInputBuilder {
  build(request: AgentModelInputBuildRequest): NcpLLMApiInput;
}
```

`DefaultNcpAgentRuntime` 每轮从 `SessionRun` snapshot 读取 messages 后调用该 builder。预算裁剪、context compaction projection、agent profile context tokens、reserved context tokens 等 NextClaw 产品语义不放进 `@nextclaw/ncp-agent-runtime-next`，也不允许该协议层包依赖 `@nextclaw/core`。后续具体 builder 应由 kernel/native-runtime 或更低层的独立 runtime-context owner 提供，并在其中复用现有 `InputBudgetPruner` 与 `projectNcpMessagesWithContextCompaction(...)`。

新 runtime contract 只接受 agent loop 必要信息：

```ts
type AgentRunSpec = {
  runId: string;
  model: string;
  maxTokens: number;
  thinkingEffort?: string | null;
};

type AgentRuntimeSessionState = {
  readonly sessionId: string;
  readonly inbox: {
    drain(): NcpMessage[];
    isEmpty(): boolean;
  };
  getSnapshot(): { messages: readonly NcpMessage[] };
  applyEvents(events: readonly NcpEndpointEvent[]): Promise<void>;
};
```

运行流程：

```text
DefaultNcpAgentRuntime.run(spec, options)
  -> drain inbox
  -> apply/yield message.sent
  -> apply/yield run.started
  -> build model input through AgentModelInputBuilder
  -> llmApi.generate(...)
  -> streamEncoder.encode(...)
  -> apply/yield assistant stream events
  -> collect tool calls from OpenAI stream chunks
  -> execute tools from options.tools
  -> apply/yield tool result events
  -> drain inbox again
  -> if tool calls or drained messages exist, continue next round
  -> apply/yield run.finished
```

边界约束：

- 不接入 `AgentRunRequestManager`。
- 不导入 kernel，也不依赖 `SessionRun` 具体 class；kernel 后续只需要让 `SessionRun` 满足结构 contract。
- 不做 legacy compat bridge。
- 不把 agent/project/model/thinking/tools 重新塞回 metadata 大包。
- 确认新实现后，把该包内容合并回 `@nextclaw/ncp-agent-runtime`，删除旧 runtime 实现和临时 next package。

## 当前推进记录

- 已先把 `SessionRepository` 从 throwing skeleton 推进为当前存储适配 owner：它不直接读写 journal 文件，而是依赖现有 `NcpSessionManager` 完成 create/get/list messages/append event。
- 该适配只服务新 agent-run 骨架闭环，不迁移最终文件存储格式，也不接管旧主链路。
- runtime events 的持久化归属校准为：`AgentRunRequestManager -> eventBus.emit(eventKeys.ncpEvent)`，`SessionRepository.start()` 监听 event bus 后调用私有 `appendSessionEvent(...)`。
- branch-local provider contributions 已按第一批策略落地：
  - `ContextProviderContribution` 复用旧 `ContextBuilder` 和共享的 `resolveNextclawNcpRunContext(...)`，先不拆 agent profile/project/bootstrap/memory/skills 多个 provider，避免复制旧 prompt 规则。
  - `ToolProviderContribution` 复用旧 `ToolManager.createRuntimeRegistry(...)` 和既有 `ToolContribution`，通过 `prepareForRun(...) -> listTools()` 输出新链路 tools。
  - provider class 放在 contribution 内部的 `providers/*.provider.ts`；contribution root `index.ts` 只保生命周期装配入口。
  - 旧 `buildCurrentTurnState(...)` 的 time hint 和 requested skills 前缀不迁入新链路；附件/asset parts 转换继续由 `AgentRunModelInputBuilder -> ncpMessageToOpenAiMessages(...)` 负责。

## Runtime Entries 与旧 Runtime Contract 接入方案

当前新分支只注册了 `native` entry。旧主链路已经具备 `native`、`narp-http`、`narp-stdio` 三类 runtime provider，并且通过 `agents.runtimes.entries` 决定具体 session type。新分支要替换旧链路，不能长期只识别 `native`，也不能把 Codex、Claude、Hermes 等具体 runtime 身份硬编码进 kernel branch。

下一步目标是把新分支的 runtime owner 从 `id -> runtime factory` 提升为 `entry + provider kind -> AgentRuntime`：

```ts
type AgentRuntimeReuseScope = "global" | "session";

type AgentRuntimeProviderRegistration = {
  kind: string;
  label: string;
  defaultReuseScope?: AgentRuntimeReuseScope;
  createRuntime(params: AgentRuntimeCreateParams): AgentRuntime;
};

type AgentRuntimeCreateParams = {
  entry: AgentRuntimeEntry;
  session: SessionDetail;
  sessionRun: SessionRun;
};
```

`AgentRuntimeReuseScope` 表达 runtime 实例复用粒度：

- `global`：同一个 runtime entry 复用同一个 runtime 实例。适合当前 native runtime 这类没有 session 子进程、没有 session-local protocol connection、内部状态可跨 session 安全复用的实现。
- `session`：同一个 session 复用同一个 runtime 实例。适合 `narp-stdio` 这类内部持有 child process / ACP session / cancel state 的实现，也适合 `narp-http` 这类远端 session 可能和 NextClaw session 绑定的实现。

复用粒度应允许 provider 给出默认值，也允许 entry config 覆盖：

```json
{
  "agents": {
    "runtimes": {
      "entries": {
        "native": { "type": "native", "config": { "reuseScope": "global" } },
        "codex": { "type": "narp-stdio", "config": { "reuseScope": "session" } }
      }
    }
  }
}
```

第一版默认策略：

- `native` 默认 `global`。
- `narp-stdio` 默认 `session`。
- `narp-http` 默认先按 `session` 处理，避免远端 runtime 把不同 NextClaw session 混到同一个 remote session 中；如果后续证明某个 HTTP runtime 是无状态 request/response 型，再允许 entry 显式配置为 `global` 或其它更细粒度策略。

### 旧 NCP Runtime Contract Wrapper

旧 runtime client（例如 `HttpRuntimeNcpAgentRuntime` / `StdioRuntimeNcpAgentRuntime`）实现的是旧 `NcpAgentRuntime.run(input, options)` contract。新分支的 runtime contract 是：

```ts
run(spec: AgentRunSpec, options: AgentRuntimeRunOptions): AsyncIterable<NcpEndpointEvent>;
```

为了不破坏旧链路，也避免复制 NARP client 逻辑，第一版新增一个可组合的 wrapper，用来把旧 `NcpAgentRuntime` 适配成新 `AgentRuntime`。这个 wrapper 不属于旧主链路，不改旧 `AgentRuntimeContribution`，只由新 branch 的 runtime provider 在需要时组合使用。

推荐落点：

```text
packages/nextclaw-kernel/src/features/agent-run/
  services/
    ncp-agent-runtime-wrapper.service.ts
```

命名倾向用 `NcpAgentRuntimeWrapper`，不要叫 legacy bridge。它表达的是“把 NCP runtime contract 包装成新 AgentRuntime contract”的可组合能力；旧链路删掉后，如果 NARP client 仍然保留旧 contract，这个 wrapper 仍然有合理存在空间。

wrapper 职责：

- 从 `SessionRun.inbox` drain 本次用户消息，并先 apply/yield `message.sent`。
- 构造旧 `NcpAgentRunInput`：
  - `sessionId` 来自 `sessionRun.sessionId`。
  - `runId` 来自 `AgentRunSpec.runId`。
  - `messages` 使用本次 drain 出来的用户消息。
  - `correlationId` 来自 `AgentRunSpec.correlationId`。
  - `metadata` 只放旧 runtime client 真实需要的 session/runtime/provider 信息，例如 model、thinking effort、agentId、session metadata。
- 调用旧 `ncpRuntime.run(input, { signal })`。
- 对旧 runtime yield 的事件逐个 `sessionRun.applyEvents([event])` 后再 yield 给新 `AgentRunRequestManager` 的 event bus pipeline。
- dispose 时转调旧 runtime 的 dispose。

wrapper 不负责：

- 不解析 runtime entry config。
- 不创建 `HttpRuntimeNcpAgentRuntime` / `StdioRuntimeNcpAgentRuntime`。
- 不决定 provider route。
- 不处理 contextBlocks / tools 的 prompt 注入；NARP client 需要 tools 时，应通过旧 client 既有 `resolveTools` 或 prompt metadata 机制获得。
- 不在 abort request 时写日志；abort 仍然只通过 signal 传递，aborted 事实由 runtime 事件产生。

第一版需要明确的限制：

- wrapper 只支持“一次 run 消费一次 inbox drain”。如果 run 过程中又有新用户消息进入 inbox，native runtime 可以在下一轮 drain；NARP wrapper 第一版不承诺同一个 remote prompt 内追加消息。后续如要支持，需要 NARP 协议侧明确追加 prompt / interrupt / follow-up 的语义，而不是在 wrapper 里偷偷循环。
- 如果 inbox drain 后没有消息，wrapper 不应伪造空 prompt。这个场景应回到 `AgentRunRequestManager` 的 send/start 语义讨论。

### Runtime Contribution 形状

`AgentRunRuntimeContribution` 应从 native-only 改成 branch-local runtime entries contribution：

- 读取 `resolveAgentRuntimeEntries(config)`。
- 对每个 enabled entry，根据 `entry.type` 找 provider registration。
- 注册 native provider。
- 注册 narp-http provider。
- 注册 narp-stdio provider。
- `listSessionTypes` 继续由 branch `AgentRuntimeManager` 从 entries 和 provider descriptor 生成。

NARP provider 可以复用旧 `BuiltinNarpRuntimeProviderService` 中已经稳定的配置解析、probe、provider route 解析逻辑，但不应直接复用旧 kernel `AgentRuntimeManager`，也不应让新 branch 通过旧 manager 间接创建 runtime。旧 manager 属于旧链路生命周期，当前只是被 disable，不应成为新链路的隐藏依赖。

### 接入顺序

1. 先调整新 `AgentRuntimeManager`：支持 runtime entries、provider kind 和 reuse scope。
2. 再调整 `AgentRunRuntimeContribution`：注册 native / narp-http / narp-stdio provider。
3. 新增 `NcpAgentRuntimeWrapper`，让 NARP provider 能组合旧 NCP runtime client。
4. 跑 `listSessionTypes` 验证：配置中的 `narp-stdio` entry 不再显示 provider unavailable。
5. 再做 NARP 的真实 run smoke：先验证文本，再验证工具和 abort。
6. 最后单独讨论 active run 期间 inbox 追加消息的语义，不和 NARP 接入混在同一批。

## 待办

- `context-window.updated` 不应长期属于 NCP endpoint event。它是 NextClaw 的 context-window projection / 观察状态，不是 agent runtime 的 NCP 事实。后续单独开迁移切块：新增独立 app event contract，迁移 `SessionContextWindowContribution` 发布路径，迁移前端 live context-window 消费路径，再从 `NcpEventType` / `NcpEndpointEvent` 和 `ncp-event` SSE 里删除旧入口。
