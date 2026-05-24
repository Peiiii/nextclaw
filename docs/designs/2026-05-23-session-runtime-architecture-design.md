# 会话运行态与持久化架构设计草案

## 背景

NextClaw 的会话系统需要承载长期对话、运行事件、会话列表、项目上下文、模型偏好、子会话关系和后续可搜索/可恢复能力。当前讨论先不以现有实现为约束，也暂不把多进程并发作为第一优先级，而是从第一性原理出发，设计一套更简洁、可理解、低出错概率的会话运行态、事件流和文件化持久化模型。

设计目标不是堆更多 sidecar、index 或 manager，而是让会话事实源、派生状态和业务 owner 的边界自然清楚。

## 设计目标

- 会话数据全部使用文件存储。
- 第一版优先单进程正确性和结构简洁，不专门设计多进程锁协议。
- 会话当前态和事件历史职责清晰，不让多个文件都变成事实源。
- 会话列表不依赖复杂全局 index；第一版允许通过读取每个会话 manifest 得到列表。
- 事件历史保留 append-only 特征，便于审计、恢复和调试。
- 持久化会话事实和 agent loop 运行时状态必须解耦，避免把内存状态 owner 变成第二套存储入口。
- 抽象必须少而完整，避免空心 owner、重复 wrapper 和多套写入口。
- 后续可以按真实性能压力再引入 cache/derived 文件，但第一版不预设 projection 目录。

## 核心原则

### 单一当前态事实源

`manifest.json` 是会话当前态的唯一事实入口。会话 label、project root、agent runtime id、preferred model、message count、last message preview 等当前态字段都由它表达。

其他文件不得把 manifest 中的当前态复制成另一份可写事实。

### 事件历史只追加

`events.jsonl` 是会话历史事实源。它记录发生过什么，不承担当下 metadata 的可写 owner。

事件追加时可以驱动 manifest 更新，但事件本身不夹带整份 manifest 或 metadata 快照。

### 派生文件默认不存在

第一版不引入 `projections/`、`summary.json` 或全局 summary index。会话列表先读取所有 `manifest.json`。

未来如果出现真实性能压力，可以引入 `cache/` 或 `derived/`，但它必须满足一条铁律：删除 cache 后系统仍然完全正确，只是变慢。

### 唯一写入口

所有写入都通过 `SessionRepository`。其他对象不能直接修改 manifest 或 events。

这条规则比文件布局更重要，因为它防止业务规则散落在 runtime、UI adapter、event appender 和 list builder 中。

### 运行态不暴露内部投影器

agent loop 需要一个按 session 维度存在的运行时状态对象，但这个对象不应该把内部 `NcpAgentConversationStateManager` 裸露给外部，也不应该把 UI 展示状态或一次 invocation 的完整控制信息塞进 conversation state。

`SessionRun` 对外只暴露 `inbox`、`getSnapshot()`、`applyEvents(...)` 和订阅能力。现成的 `DefaultNcpAgentConversationStateManager` 是它的内部实现细节，用来把 NCP events 投影成 agent runtime 真正依赖的 conversation messages。

这样可以保留现有 conversation state manager 的成熟消息投影语义，同时防止调用方绕过 `SessionRun` 直接依赖内部字段、hydrate 细节或具体实现类。

### 运行标识不等于运行控制

`SessionRun` 可以维护一个最小 `activeRunId`，用于表达“这个 session 当前是否有一个正在推进的 run”。但 `abortDisabledReason`、完整 abort controller、排队、重试、恢复、stream attach 等 invocation 控制语义不属于 `SessionRun`。

如果未来需要完整取消、排队或恢复能力，应单独设计 invocation owner，而不是把这些状态塞进 conversation state 或 `SessionRunManager`。

### Inbox 是 SessionRun 的内部输入队列

用户在一个 session 上继续发送消息时，消息先进入该 `SessionRun` 的 inbox。inbox 本质上是一个内存消息队列，负责承接“下一轮 agent loop 要消费的用户输入”。

agent loop 每一轮开始都从 inbox drain 当前积压消息，并把这些消息纳入本轮模型输入。只有当模型没有继续输出 tool call，且 inbox 也已经为空时，agent loop 才真正结束。

inbox 不负责持久化，不发布 event bus，也不替代 `events.jsonl`。它只是运行中把用户新输入交给 agent loop 的最小 owner。`SessionRun` 直接暴露 `inbox`，不再重复包装 enqueue/drain/isEmpty 方法。

### Context Window 是观察状态

context-window 占用信息不参与 agent runtime 构造模型输入，也不影响 conversation messages。它只是前端展示和配套观测功能需要的 live snapshot。

因此 context-window 不属于 `SessionRun`，也不属于 conversation state manager 的终态职责。它应该由独立的 context-window owner 或 event bus consumer 维护，并通过独立事件供前端展示。

## 文件结构

推荐第一版结构：

```text
sessions/
  <sessionId>/
    manifest.json
    events.jsonl
    artifacts/
```

未来可选扩展：

```text
sessions/
  <sessionId>/
    manifest.json
    events.jsonl
    cache/
      messages.snapshot.json
    artifacts/
```

`cache/` 只在证明 replay 或列表读取慢到影响体验后再加。

## Manifest 模型

`manifest.json` 表达会话当前态：

```json
{
  "schemaVersion": 1,
  "sessionId": "ncp-xxx",
  "agentId": "main",
  "createdAt": "2026-05-23T00:00:00.000Z",
  "updatedAt": "2026-05-23T00:01:00.000Z",
  "eventSeq": 42,
  "metadata": {
    "label": "修复会话 project 信息",
    "projectRoot": "/Users/peiwang/Projects/nextbot",
    "agentRuntimeId": "native",
    "preferredModel": "openai/gpt-5"
  },
  "stats": {
    "messageCount": 12,
    "lastMessageAt": "2026-05-23T00:01:00.000Z",
    "lastMessagePreview": "已完成修复。"
  }
}
```

字段分层：

- `schemaVersion`：持久化格式版本。
- `sessionId` / `agentId`：会话身份。
- `createdAt` / `updatedAt`：当前会话列表和排序需要的时间语义。
- `eventSeq`：下一次事件追加的序列基准。
- `metadata`：用户和运行时可感知的当前会话上下文。
- `stats`：会话列表直接需要的轻量摘要。

`stats` 放在 manifest 中，而不是放进 `summary.json`，是为了第一版减少同步关系。

## Event Log 模型

`events.jsonl` 每行一个事件：

```json
{"seq":1,"at":"2026-05-23T00:00:00.000Z","type":"message.user","payload":{"messageId":"user-1","text":"hello"}}
{"seq":2,"at":"2026-05-23T00:00:01.000Z","type":"run.started","payload":{"runId":"run-1"}}
{"seq":3,"at":"2026-05-23T00:00:02.000Z","type":"message.assistant.completed","payload":{"messageId":"assistant-1","text":"hi"}}
```

事件规则：

- `seq` 由 `SessionRepository` 基于 manifest 分配。
- `at` 由写入 owner 生成或校验。
- `type` 使用领域语义，而不是底层 UI 或 provider 临时语义。
- `payload` 只记录事件事实，不记录整份 manifest/metadata。
- 坏行策略需要单独讨论：第一版倾向于读会话时显式报错，后续可以增加 repair。

## 最小代码结构

第一版持久化层只保留两个真正的 owner；运行态层保留 session run 和 agent runtime 两类生命周期 owner，并由 `SessionRun` 封装单个 session 的 conversation runtime state。其余无状态逻辑全部落到 `utils`。这里故意不用 `SessionReducer`、`SessionReader` 这类 class 名称，避免把纯计算误建模成 owner。

推荐目录结构：

```text
features/session/
  managers/
    session-run.manager.ts
    agent-run-request.manager.ts
    agent-runtime.manager.ts
    context-provider.manager.ts
    tool-provider.manager.ts
    session-context-window.manager.ts
  repositories/
    session.repository.ts
  stores/
    session-file.store.ts
  utils/
    session-manifest.utils.ts
    session-view.utils.ts
    session-event-codec.utils.ts
  types/
    session.types.ts
```

第一版如果事件 codec 还很简单，可以先不拆 `session-event-codec.utils.ts`，把 encode/decode 作为 `session-file.store.ts` 的私有函数或 `session-event.utils.ts` 中的少量纯函数。只有当事件格式迁移、坏行策略或 schema 校验变复杂时，再独立成 utils 文件。

角色判断：

- `managers/session-run.manager.ts`：session 维度运行时状态 owner；文件内可声明 `SessionRunManager`、`SessionRun` 和内部 inbox owner。
- `managers/agent-run-request.manager.ts`：agent run 上层编排 owner，负责请求触发、前置条件准备和 runtime 输出事件对接 event bus。
- `managers/agent-runtime.manager.ts`：agent runtime 实例生命周期 owner，根据 `agentRuntimeId` 获取或创建 `AgentRuntime`。
- `managers/context-provider.manager.ts`：上下文 provider 注册与上下文块组装 owner。
- `managers/tool-provider.manager.ts`：tool provider 注册与本轮可用工具组装 owner。
- `managers/session-context-window.manager.ts`：context-window 占用信息 owner；它维护观察状态，供 `SessionRepository.getSession(...)` 聚合读取。
- `repositories/session.repository.ts`：业务写入口和一次会话操作的协调 owner。
- `stores/session-file.store.ts`：文件系统状态访问 owner。
- `utils/session-manifest.utils.ts`：manifest 当前态演进的纯函数。
- `utils/session-view.utils.ts`：manifest/events 到业务读取结果的纯函数。
- `types/session.types.ts`：纯类型。

### SessionRun

单个 session 的运行时 conversation state owner。它不是一次 execution，不是持久化 session，也不是对 `NcpAgentConversationStateManager` 的裸转发对象。

职责：

- 持有现成的 `NcpAgentConversationStateManager` 实例。
- 暴露 inbox owner。
- 对外提供 agent runtime 依赖的 conversation snapshot。
- 按顺序批量应用 runtime events。
- 提供订阅 snapshot 变化的能力。
- 维护最小 `activeRunId`。

不负责：

- 读写 `manifest.json` 或 `events.jsonl`。
- 加载初始 messages。
- 发布 event bus。
- 创建 agent runtime。
- 管理一次 agent 调用的 abort controller。
- 维护 `abortDisabledReason`、完整 run control state 或 invocation queue。
- 维护 context-window 占用信息。
- 决定哪些事件需要持久化。

示例接口：

```ts
type SessionRunSnapshot = {
  messages: readonly NcpMessage[];
  activeRunId: string | null;
};

class SessionRun {
  readonly sessionId: string;
  readonly inbox: MessageInbox;

  getSnapshot(): SessionRunSnapshot;
  applyEvents(events: readonly NcpEndpointEvent[]): Promise<void>;
  subscribe(listener: (snapshot: SessionRunSnapshot) => void): () => void;
}
```

实现约束：

- `NcpAgentConversationStateManager` 是 `private readonly` 字段。
- 外部不得通过 `sessionRun.stateManager` 访问内部 state manager。
- inbox 是 `SessionRun` 直接暴露的输入队列 owner；外部通过 `sessionRun.inbox.enqueue(...)`、`sessionRun.inbox.drain()`、`sessionRun.inbox.isEmpty()` 表达意图。
- `applyEvents` 是唯一事件应用入口，必须保持事件顺序；单事件场景也使用 `applyEvents([event])`。
- `applyEvents` 负责先按事件类型更新 `activeRunId`，再把会影响 messages 的事件交给 state manager；对于连续的 conversation events 可以调用 state manager 的 `dispatchBatch`，但不能把 run lifecycle、context-window 等非 conversation 状态塞进 state manager。
- `getSnapshot()` 只返回 agent runtime 需要的 messages，以及 `SessionRun` 自己维护的 `activeRunId`。
- `activeRunId` 由 `run.started` / `run.finished` / `run.error` / `message.abort` 等事件更新；它不携带 `abortDisabledReason`。
- context-window 事件不改变 `SessionRun` snapshot。

### MessageInbox

`MessageInbox` 是通用消息队列 owner。它当前由 `SessionRun` 持有并通过 `sessionRun.inbox` 暴露，但它本身不是 session 专属概念。

第一版可以作为 `session-run.manager.ts` 中的私有 class，不单独建文件。只有当其它运行时或模块也需要复用同样的消息队列语义时，再移动到更通用的 manager/utils 边界。

职责：

- 接收用户输入消息。
- 保持 FIFO 顺序。
- 支持 drain 当前积压消息。
- 支持判断当前是否为空。

不负责：

- 写事件日志。
- 发布 event bus。
- 做消息去重以外的业务判断。
- 维护模型输入上下文。

示例接口：

```ts
class MessageInbox {
  enqueue(message: NcpMessage): void;
  drain(): NcpMessage[];
  isEmpty(): boolean;
}
```

`MessageInbox` 作为 `SessionRun.inbox` 直接暴露给上层对象。它的 API 已经足够小，不需要 `SessionRun` 再包一层同义方法。

### SessionRunManager

按 session 维度管理 `SessionRun` 的生命周期。

职责：

- 维护 `sessionId -> SessionRun`。
- 基于 `sessionId` 和 `messages` 创建 `SessionRun`。
- 返回已有 `SessionRun`。
- 删除不再需要的 `SessionRun`。
- dispose 时清理所有运行态对象。

不负责：

- 从文件加载 messages。
- 写入 session events。
- patch metadata。
- 维护会话列表。
- 发布 `ncp.event`。
- 管理 agent loop 内部流程。
- 管理一次 invocation 的取消或恢复。

示例接口：

```ts
class SessionRunManager {
  getSessionRun(sessionId: string): SessionRun | null;
  createSessionRun(params: {
    sessionId: string;
    messages: readonly NcpMessage[];
  }): SessionRun;
  deleteSessionRun(sessionId: string): void;
  dispose(): void;
}
```

创建规则：

```text
SessionRunManager.createSessionRun
  -> new DefaultNcpAgentConversationStateManager()
  -> stateManager.hydrate({ sessionId, messages })
  -> new SessionRun(sessionId, stateManager)
```

这里 `hydrate` 只是初始化内存 conversation state，不代表 `SessionRunManager` 知道持久化格式。

查询和创建必须严格分离：

- `getSessionRun(sessionId)` 只返回已有对象或 `null`，绝不创建。
- `createSessionRun(...)` 只创建新对象；如果同一个 `sessionId` 已存在，应显式报错或由调用方先决定是否复用。
- 不提供 `getOrCreateSessionRun`，避免读取路径暗中产生运行态对象。

### AgentRunRequestManager

agent run 的上层编排 owner。它负责“什么时候触发一次 run”，不负责 agent loop 内部怎么推理。

职责：

- 在 `start()` 时订阅 ingress 上的 agent run request 和 abort request。
- 将 ingress request 分发给内部 `send(...)` / `abort(...)` handler。
- 准备运行前置条件，例如 session 存在性、模型偏好、thinking effort、context/tool provider 输入、必要的持久化写入。
- 获取或显式创建 `SessionRun`。
- 把用户消息放入 `SessionRun` inbox。
- 根据会话 manifest 中的 `agentRuntimeId`，通过 `AgentRuntimeManager` 获取 agent runtime 实例。
- 调用 `ContextProviderManager` 组装上下文块。
- 调用 `ToolProviderManager` 组装本轮可用工具。
- 调用 `agentRuntime.run(...)`。
- 接收 runtime 输出事件，并对接 `eventBus`、持久化和其它配套消费者。

不负责：

- 构造模型输入的每一轮循环。
- 执行 tool call 后的 agent loop 决策。
- 维护 conversation messages。
- 直接操作 `NcpAgentConversationStateManager`。
- 直接创建、缓存或管理具体 agent runtime 实例。
- 让 `AgentRuntime` 直接读取 agentId、projectRoot 这类上下文原料。
- 对外暴露可被任意调用方直接调用的 `send(...)` / `abort(...)` API。

示例接口：

```ts
class AgentRunRequestManager {
  start(): void;
  dispose(): void;

  private send(request: AgentRunRequest): Promise<NcpRunHandle>;
  private abort(request: AgentRunAbortRequest): Promise<void>;
}
```

它是 agent run 的上层编排者，而不是 session runtime state owner。外部调用方不直接调用它的 `send(...)` / `abort(...)`；外部只向 ingress 发送 request，由 `AgentRunRequestManager` 的生命周期订阅负责接收。

### AgentRuntimeManager

agent runtime 实例生命周期 owner。它根据 `agentRuntimeId` 返回可执行的 `AgentRuntime` 实例，隐藏 runtime provider、adapter、进程连接或 lazy init 细节。

职责：

- 维护 `agentRuntimeId -> AgentRuntime` 的实例映射。
- 在需要时创建 runtime 实例。
- 复用已经存在的 runtime 实例。
- 维护 runtime 级别的 dispose / reload 生命周期。

不负责：

- 决定本次 run 使用哪个 session。
- 读写 `manifest.json` 或 `events.jsonl`。
- 维护 conversation messages。
- 组装 context blocks 或 tools。
- 发布 event bus。

示例接口：

```ts
class AgentRuntimeManager {
  getOrCreate(agentRuntimeId: string): AgentRuntime;
}
```

这里允许 `getOrCreate`，因为它表达的是“按 runtime id 获取一个可用 runtime 实例”的生命周期 acquire 语义。它不同于 `SessionRunManager.getOrCreateSessionRun(...)`：session run 的创建需要上层先完成 session 持久化读取和 messages 初始化，不能被读取路径暗中创建。

### AgentRunRequest 与 AgentRunSpec

`AgentRunRequest` 和 `AgentRunSpec` 必须区分。

`AgentRunRequest` 表达“请求者希望系统跑一次 agent run”时携带的全部请求信息。它可以包含 session、用户消息、请求追踪、agent runtime id、agent、项目和渠道等原料。这些信息不一定由 agent loop 亲自消费，也可能只给 session 创建、context providers、tool providers、事件关联或持久化链路使用。

示例结构：

```ts
type AgentRunRequest = {
  sessionId?: string;
  message: NcpMessage;
  agentRuntimeId?: string;
  correlationId?: string;
  agentId?: string;
  projectRoot?: string;
  channel?: string;
  model?: string;
  thinkingEffort?: ThinkingEffort | null;
};

type AgentRunAbortRequest = {
  sessionId: string;
  runId: string;
  correlationId?: string;
};
```

`agentRuntimeId` 是 runtime 身份，不是 runtime 实例。创建新 session 时，`AgentRunRequestManager` 使用 request 里的 `agentRuntimeId` 写入新 session manifest；读取已有 session 时，会话 manifest 中的 `agentRuntimeId` 是事实源。若已有 session 请求同时携带不同的 `agentRuntimeId`，应显式拒绝，而不是静默切换 runtime。

`AgentRunSpec` 表达 agent loop 本次运行的规格。它不携带上下文原料，也不携带消息历史；消息历史来自 `SessionRun`，上下文和工具来自 runtime options。

```ts
type AgentRunSpec = {
  runId: string;
  model: string;
  maxTokens: number;
  thinkingEffort?: ThinkingEffort | null;
};
```

`correlationId` 不属于 `AgentRunSpec`。它用于请求追踪、eventBus 关联、API 响应匹配或持久化关联，由 `AgentRunRequestManager` 在发布/持久化 runtime events 时附加，不参与 agent loop 决策。

`maxTokens` 属于 `AgentRunSpec`。它是本次模型输出预算，直接影响 agent loop 的模型调用。具体值可以由 `AgentRunRequestManager` 从请求、agent profile 或默认配置解析，但进入 `AgentRuntime` 时必须已经确定。

转换关系：

```text
AgentRunRequest
  -> AgentRunRequestManager
      -> resolve/create session
      -> SessionRepository.listSessionMessages(sessionId)
      -> SessionRunManager.getSessionRun(sessionId)
      -> if missing, SessionRunManager.createSessionRun({ sessionId, messages })
      -> SessionRun.inbox.enqueue(request.message)
      -> read session.manifest.metadata.agentRuntimeId
      -> AgentRuntimeManager.getOrCreate(agentRuntimeId)
      -> ContextProviderManager.buildContext(resolved request)
      -> ToolProviderManager.buildTools(resolved request)
      -> AgentRunSpec { runId, model, maxTokens, thinkingEffort }
      -> agentRuntime.run(agentRunSpec, { sessionRun, contextBlocks, tools, signal })
```

这条边界的核心目的，是避免 `AgentRuntime` 直接依赖请求者大包字段或 `metadata?: Record<string, unknown>`。

### AgentRuntime

agent loop owner。它负责内部循环：读 session messages、drain inbox、调用模型、处理 tool call、产生 agent events，并把事件应用回 `SessionRun`。

推荐 API 依赖 `SessionRun`，并只接收 agent loop 核心运行参数：

```ts
class AgentRuntime {
  run(agentRunSpec: AgentRunSpec, options: {
    sessionRun: SessionRun;
    contextBlocks: readonly ContextBlock[];
    tools: readonly AgentTool[];
    signal?: AbortSignal;
  }): AsyncIterable<NcpEndpointEvent>;
}
```

`AgentRuntime` 通过 `sessionRun.getSnapshot().messages` 读取已确认的 conversation history，通过 `sessionRun.inbox.drain()` 获取本轮新输入，通过 `sessionRun.applyEvents(events)` 把 agent events 应用回运行态。

它不直接依赖 `SessionRunManager`，也不直接依赖 `SessionRepository`、`eventBus`、`agentId`、`projectRoot` 或任意 metadata 大包。

命名约束：

- 统一使用 `thinkingEffort`。
- 不再同时保留 `thinking`、`thinkingLevel`、`reasoningEffort`、`reasoningLevel` 等多组 alias。
- 旧输入 alias 只能在 `AgentRunRequestManager` 或更外层 adapter 中归一化。

agent loop 终止条件：

```text
while true:
  drainedMessages = sessionRun.inbox.drain()
  for each drained message:
    emit/apply message.sent

  build model input from sessionRun.getSnapshot().messages
  run model round
  apply/yield assistant/tool events

  if model requested tool call:
    execute tools
    drainedMessages = sessionRun.inbox.drain()
    for each drained message:
      emit/apply message.sent
    continue
  else if !sessionRun.inbox.isEmpty():
    continue
  else:
    finish
```

这里的关键点是：inbox 不只在普通模型轮次开始时 drain，也必须在 tool execution 结束、进入下一轮模型调用之前再次 drain。drain 出来的消息不能只存在局部变量里，必须先转成 `message.sent` events 并通过 `sessionRun.applyEvents(...)` 应用到 `SessionRun`，这样下一轮 `sessionRun.getSnapshot().messages` 才包含这些用户消息。agent loop 只有在“没有 tool call 且 inbox 为空”时结束。

### ContextProviderManager

上下文 provider 体系负责把 agent loop 核心输入之外的环境事实转换成 prompt/context block。`AgentRuntime` 不直接读取这些原料。

示例接口：

```ts
type ContextBlock = string;

interface ContextProvider {
  provide(request: AgentRunRequest): Promise<readonly ContextBlock[]>;
}

class ContextProviderManager {
  register(provider: ContextProvider): () => void;
  buildContext(request: AgentRunRequest): Promise<readonly ContextBlock[]>;
}
```

`ContextProviderManager.buildContext(...)` 直接消费 `AgentRunRequest`，不再新增一层 `AgentContextProviderInput` 映射类型。调用时传入的 request 应该是 `AgentRunRequestManager` 解析 session 后的 request：如果原始请求没有 `sessionId`，创建 session 后需要把实际 `sessionId` 补回再交给 providers。

具体 provider 不由 `ContextProviderManager` 硬编码创建，而是通过 contribution 在系统装配阶段注册进来。`ContextProviderManager` 只负责保存 provider 列表、按顺序调用 provider、聚合 context blocks，以及返回 unregister 函数。

典型 provider：

- `AgentProfileContextProvider`：根据 `agentId` 注入 agent instructions、memory、bootstrap files。
- `ProjectContextProvider`：根据 `projectRoot` 注入项目路径、项目规则或项目说明。
- `ChannelContextProvider`：根据 `channel` 注入渠道相关上下文。

### ToolProviderManager

tool provider 体系负责为本轮 agent loop 提供可调用工具。`AgentRuntime` 只消费已经组装好的 tools，不直接读取工具发现细节、agent profile、project root 或其它 metadata。

MCP 也通过 tool provider 接入。`McpToolProvider` 在 `ToolProviderManager.buildTools(...)` 阶段读取已安装、已启用或当前上下文可用的 MCP / plugin tools，并转换为统一的 `AgentTool[]` 交给 `AgentRuntime`。

因此 MCP 不进入 `AgentRunRequest`，也不是 `AgentRuntime` 的特殊依赖。agent loop 只知道“本轮有哪些 tools 可调用”，不需要知道这些 tools 来自内置实现、MCP server、plugin 还是项目目录。

示例接口：

```ts
interface ToolProvider {
  provide(request: AgentRunRequest): Promise<readonly AgentTool[]>;
}

class ToolProviderManager {
  register(provider: ToolProvider): () => void;
  buildTools(request: AgentRunRequest): Promise<readonly AgentTool[]>;
}
```

`ToolProviderManager.buildTools(...)` 和 `ContextProviderManager.buildContext(...)` 保持同一输入模型：直接消费解析后的 `AgentRunRequest`，不再新增一层 provider input 映射类型。

具体 provider 不由 `ToolProviderManager` 硬编码创建，而是通过 contribution 在系统装配阶段注册进来。`ToolProviderManager` 只负责保存 provider 列表、按顺序调用 provider、聚合 tools，以及返回 unregister 函数。

典型 provider：

- `BuiltinToolProvider`：提供内置工具。
- `McpToolProvider`：把 MCP / plugin tools 适配成统一 `AgentTool[]`。
- `ProjectToolProvider`：根据 `projectRoot` 收敛工具执行边界。

### Provider Contributions

context provider 和 tool provider 的注册通过 contribution 提供。contribution 是具体能力接入点，负责创建 provider 实例并注册到对应 manager；manager 不感知具体 provider 列表，也不依赖 MCP、project、agent profile 等具体来源。

这里复用现有 kernel contribution 生命周期，不新增一套 provider contribution 协议。contribution 在 `start()` 里调用 `contextProviderManager.register(...)` / `toolProviderManager.register(...)`，保存 unregister 函数，并在 `dispose()` 里统一释放。

示例形态：

```ts
class McpProviderContribution implements KernelContribution {
  private unregister: (() => void) | null = null;

  constructor(
    private readonly toolProviders: ToolProviderManager,
    private readonly mcpToolProvider: McpToolProvider,
  ) {}

  start = (): void => {
    this.unregister ??= this.toolProviders.register(this.mcpToolProvider);
  };

  dispose = (): void => {
    this.unregister?.();
    this.unregister = null;
  };
}
```

典型 contributions：

- `AgentProfileProviderContribution`：注册 `AgentProfileContextProvider`。
- `ProjectProviderContribution`：注册 `ProjectContextProvider` 和 `ProjectToolProvider`。
- `McpProviderContribution`：注册 `McpToolProvider`。

如果一个 contribution 同时注册多个 providers，它自己聚合多个 unregister 函数。这样扩展能力的生命周期清晰归 contribution，provider manager 不需要知道 provider 从哪里来。

SessionRun 相关命名和落位：

- 文件：`managers/session-run.manager.ts`
- 使用 `.manager.ts`，因为它拥有按 session 维度的运行时对象生命周期。
- `SessionRun` 可以先和 `SessionRunManager` 放在同一文件中，避免为单个运行时 handle 发明新的文件角色。
- 如果后续 `SessionRun` 明显膨胀，再重新评估是否需要独立文件；在当前命名规则下，不应新增 `session-run.state.ts` 这类未批准角色后缀。

AgentRunRequestManager 命名和落位：

- 文件：`managers/agent-run-request.manager.ts`
- 使用 `.manager.ts`，因为它拥有 agent run 请求订阅、前置条件准备和输出事件对接的生命周期。
- 它是上层编排者，不应命名为 runtime。

### SessionRepository

业务层唯一入口，也是会话写入事务边界。

职责：

- 创建会话目录和初始 manifest。
- 追加事件并更新 manifest。
- patch metadata 并更新 manifest。
- 读取单个会话详情。
- 列出会话当前态。
- 单独列出会话 messages。
- 在 `getSession(...)` 中聚合 context-window 观察字段。
- 统一发布 session summary update 事件。
- 删除会话。

不负责：

- 具体文件读写细节。
- JSONL 编解码细节。
- runtime 运行状态编排。
- UI 展示组件逻辑。
- 发布 session summary update 之外的 session 派生事件。

示例接口：

```ts
class SessionRepository {
  createSession(input: CreateSessionInput): Promise<SessionSummary>;
  getSession(sessionId: string): Promise<SessionDetail | null>;
  listSessions(query?: SessionListQuery): Promise<SessionSummary[]>;
  listSessionMessages(sessionId: string): Promise<readonly NcpMessage[]>;
  appendEvents(sessionId: string, events: SessionEventInput[]): Promise<SessionSummary>;
  patchMetadata(sessionId: string, patch: SessionMetadataPatch): Promise<SessionSummary>;
  deleteSession(sessionId: string): Promise<void>;
}
```

`SessionRepository` 持有 `eventBus`，并由它统一负责发布 session summary update 事件。创建、追加事件导致 manifest 当前态变化、patch metadata 导致 summary 变化时，都发布同一种 update 事件；不再额外设计 upsert/delete/metadata-patched 等 eventBus session summary 事件。

```ts
type SessionSummaryUpdatedEvent = {
  type: "session.summary.updated";
  summary: SessionSummary;
};
```

`SessionSummary` 不是极简列表 DTO，而是 manifest 当前态。所有不 expensive / heavy、且已经存在于 `manifest.json` 的字段，都应该随 `listSessions(...)` 一起返回。

示例结构：

```ts
type SessionSummary = {
  schemaVersion: number;
  sessionId: string;
  agentId?: string;
  createdAt: string;
  updatedAt: string;
  eventSeq: number;
  metadata: SessionMetadata;
  stats: SessionStats;
};
```

`getSession(...)` 返回 `SessionDetail`。`SessionDetail` 不包含 messages，但可以包含不属于 summary / metadata 的轻量观察字段。当前第一类就是 context-window 占用信息。

```ts
type SessionDetail = {
  summary: SessionSummary;
  contextWindow: SessionContextWindowSnapshot | null;
};
```

context-window 占用信息不属于 session summary，也不属于 session metadata；它不写入 `manifest.json`，不参与 `listSessions(...)`，也不由 `patchMetadata(...)` 修改。`SessionRepository.getSession(...)` 需要依赖 context-window 相关 owner，在读取 manifest 后补充该观察字段。这个依赖只服务 `getSession(...)` 的读取聚合，不让 context-window 进入 repository 的写入事实源。

`messages` 是重集合，必须单独通过 `listSessionMessages(sessionId)` 读取。这个 API 内部可以 replay `events.jsonl` 并调用 `session-view.utils.ts` 派生 messages，但 replay 逻辑仍然收在 repository 内部，外部调用方不直接读 `SessionFileStore.readEvents(...)` 自己拼。

命名和落位：

- 文件：`repositories/session.repository.ts`
- 可以是 class，因为它拥有业务流程和写入顺序。
- 它不应暴露底层文件路径、JSONL 行格式或 manifest 写入细节。

### SessionFileStore

文件系统边界，只负责 IO，不理解业务语义。

职责：

- 路径解析。
- 目录创建。
- 读写 `manifest.json`。
- 追加和读取 `events.jsonl`。
- 原子写 manifest：`write temp -> rename`。
- 删除会话目录。

不负责：

- 决定 metadata 怎么合并。
- 决定 message count 怎么计算。
- 决定哪些事件推进 updatedAt。

示例接口：

```ts
class SessionFileStore {
  readManifest(sessionId: string): Promise<SessionManifest | null>;
  writeManifest(sessionId: string, manifest: SessionManifest): Promise<void>;
  appendEventLines(sessionId: string, entries: SessionEvent[]): Promise<void>;
  readEvents(sessionId: string): AsyncIterable<SessionEvent>;
  listSessionIds(): Promise<string[]>;
  deleteSessionDir(sessionId: string): Promise<void>;
}
```

命名和落位：

- 文件：`stores/session-file.store.ts`
- 可以是 class，因为它拥有持久状态访问、路径解析和文件写入原语。
- 它不应知道 `projectRoot`、`lastMessagePreview` 或 message count 的业务含义。

### session-manifest.utils.ts

manifest 当前态演进工具。它不是完整 session owner，也不是文件 reader/writer，只是纯计算。

职责：

- `manifest + event -> next manifest`。
- 决定哪些事件增加 message count。
- 决定 last message preview 的生成规则。
- 决定哪些事件推进 updatedAt。
- 合并 metadata patch。

不负责：

- 读写文件。
- 生成路径。
- 组装 UI view。

示例接口：

```ts
export function applySessionEventToManifest(
  manifest: SessionManifest,
  event: SessionEvent,
): SessionManifest;

export function applySessionEventsToManifest(
  manifest: SessionManifest,
  events: readonly SessionEvent[],
): SessionManifest;

export function patchSessionManifestMetadata(
  manifest: SessionManifest,
  patch: SessionMetadataPatch,
): SessionManifest;
```

命名和落位：

- 文件：`utils/session-manifest.utils.ts`
- 不建 class；不命名为 `.service.ts`。
- 如果未来它开始拥有缓存、恢复、迁移或多步流程，才重新评估是否升级为 owner。

### session-view.utils.ts

读模型组装工具。它不读文件，只把已经读出来的 manifest 或 events 转成业务读取结果。

职责：

- `manifest -> SessionSummary`。
- `events -> messages`。

不负责：

- 修改 manifest。
- 写 cache。
- 决定事件序列。

示例接口：

```ts
export function toSessionSummary(manifest: SessionManifest): SessionSummary;

export function toSessionMessages(events: readonly SessionEvent[]): NcpMessage[];
```

命名和落位：

- 文件：`utils/session-view.utils.ts`
- 不叫 `SessionReader`，因为它不负责 IO。
- 不建 class；它只是无状态转换。

### session-event-codec.utils.ts

可选事件编解码工具。简单时先不拆；复杂后再拆。

当出现以下情况时，再独立为 `session-event-codec.utils.ts`：

- 事件版本迁移变复杂。
- JSONL 坏行处理策略变复杂。
- 需要兼容多种历史事件格式。
- 事件 schema 校验需要集中。

示例接口：

```ts
export function encodeSessionEvent(event: SessionEvent): string;
export function decodeSessionEvent(line: string): SessionEvent;
```

## 运行态路径

### AgentRunRequestManager 触发运行

`AgentRunRequestManager` 是运行流程的上层编排者。它在 `start()` 时订阅 ingress 上的 agent run request 和 abort request，并在 `dispose()` 时释放订阅。`SessionRunManager` 不直接读取文件，只接收 `AgentRunRequestManager` 准备好的 `sessionId` 和 `messages`。

调用 agent runtime 之前，`AgentRunRequestManager` 必须先拿到对应的 `SessionRun`，必要时显式创建它，并把 `request.message` 放入 `sessionRun.inbox`。这样 agent loop 启动时能从同一个运行态 owner 读取历史 messages 和新到达的用户输入。

```text
Ingress
  -> agent.run.request
  -> AgentRunRequestManager private send(request)
  -> 如果 request.sessionId 存在，SessionRepository.getSession(sessionId)
  -> 如果 request.sessionId 不存在，使用 request.agentRuntimeId 等元数据创建 session
  -> SessionRepository.listSessionMessages(sessionId)
  -> SessionRunManager.getSessionRun(sessionId)
  -> 如果不存在，SessionRunManager.createSessionRun({ sessionId, messages })
  -> sessionRun.inbox.enqueue(request.message)
  -> 从 session.manifest 读取 agentRuntimeId
  -> AgentRuntimeManager.getOrCreate(agentRuntimeId)
  -> ContextProviderManager.buildContext(resolved request)
  -> ToolProviderManager.buildTools(resolved request)
  -> build AgentRunSpec
  -> agentRuntime.run(agentRunSpec, { sessionRun, contextBlocks, tools, signal })
  -> 接收 runtime events
  -> 写入 SessionRepository / 发布 eventBus
```

abort 路径同样从 ingress 进入：

```text
Ingress
  -> agent.run.abort.request
  -> AgentRunRequestManager private abort(request)
  -> resolve SessionRun / activeRunId
  -> emit/apply abort event as needed
  -> bridge abort-related events to eventBus
```

这里的关键约束：

- agent run 的外部入口是 ingress request，不是直接调用 `AgentRunRequestManager.send(...)`。
- messages 来源属于上层编排者和 `SessionRepository`。
- agent runtime 实例来源属于 `AgentRuntimeManager`，request 只携带 `agentRuntimeId`。
- 已有 session 的 `agentRuntimeId` 以会话 manifest 为准；切换 runtime 必须是单独的 session metadata 变更请求。
- `SessionRunManager` 只创建和缓存运行态对象。
- `getSessionRun` 和 `createSessionRun` 严格分离，读取不会隐式创建。
- `SessionRun` 封装内部 state manager，不暴露 `stateManager` 字段。
- runtime 输出事件对接 event bus 和持久化，是 `AgentRunRequestManager` 的职责，不是 `SessionRunManager` 的职责。
- `AgentRunRequest` 可以携带较丰富的请求原料；`AgentRunSpec` 只保留 agent loop 本次运行规格。
- context/tool 原料由 `AgentRunRequestManager` 从 request 派生后传给 provider managers；`AgentRuntime` 只消费组装后的 `contextBlocks` 和 `tools`。

### AgentRuntime 读取状态与 Inbox

agent runtime 不直接依赖 `DefaultNcpAgentConversationStateManager`，而是依赖 `SessionRun`。

```text
AgentRuntime round
  -> sessionRun.inbox.drain()
  -> 对 drained messages 产生并 apply message.sent events
  -> sessionRun.getSnapshot().messages
  -> 合并 contextBlocks
  -> build model input
```

每一轮都重复这个流程。drain 出来的用户消息进入 conversation messages 后，再和历史 messages 一起构造模型输入。tool execution 完成后如果还要继续下一轮，也必须先回到这个 drain 步骤，而不是直接用旧 snapshot 继续调用模型。

### AgentRuntime 应用事件

runtime 产生的 NCP event 先进入 `SessionRun`。`SessionRun` 按事件职责分流：conversation events 进入内部 state manager，run lifecycle events 只更新 `activeRunId`，context-window events 不进入 `SessionRun`。随后 runtime 将事件 yield 给 `AgentRunRequestManager`。

```text
AgentRuntime event
  -> sessionRun.applyEvents([event])
  -> yield event
  -> AgentRunRequestManager
      -> SessionRepository.appendEvents(...)
      -> eventBus.emit(eventKeys.ncpEvent, event)
```

`AgentRunRequestManager` 调用 `agentRuntime.run(...)` 后，必须消费 runtime 输出的 async iterable，并把每个输出事件桥接到 event bus。也就是说 runtime event stream 的对外观察入口不是 `AgentRuntime` 自己，而是 `AgentRunRequestManager -> eventBus` 这条支路。

对于 replay、初始化或一批 runtime events，使用同一个事件入口：

```text
sessionRun.applyEvents(events)
```

这保证 conversation messages 的更新规则集中在现成 `NcpAgentConversationStateManager`，而它仍然被 `SessionRun` 封装。

`run.started`、`run.finished`、`run.error` 和 `message.abort` 这类事件可以更新 `SessionRun.activeRunId`，但不进入 conversation state manager 的 hydrate input，也不把 `abortDisabledReason` 这类 UI/控制语义塞进 conversation state。

### EventBus 支路

event bus 是运行观察流，服务前端、activity、context-window、搜索索引等消费者。

```text
AgentRuntime
  -> SessionRun.applyEvents
  -> yield event
  -> AgentRunRequestManager
  -> EventBus ncp.event
      -> UI streaming
      -> activity calculator
      -> context-window updater
      -> search/index/cache consumers
```

`SessionRunManager` 不发布 event bus；发布动作属于 `AgentRunRequestManager`。这样可以避免 `SessionRunManager` 同时变成运行态 owner、持久化 owner 和事件广播 owner。

`AgentRuntime` 也不直接发布 event bus。它只 yield runtime events；`AgentRunRequestManager` 负责把这些事件持久化，并桥接到 `eventBus.emit(eventKeys.ncpEvent, event)`。

session summary update 事件是另一条更窄的支路，由 `SessionRepository` 统一发布。它只表达“某个 session 的 manifest 当前态已经更新”，供会话列表、侧边栏和轻量 session cache 刷新；不承载 runtime streaming，也不替代 NCP event。

context-window 占用信息应在这条 event bus 支路上由独立消费者维护。它可以通过独立事件推给前端，但不回写 `SessionRun`，也不参与 agent runtime 的 conversation messages。

## 写入路径

### 创建会话

```text
SessionRepository.createSession
  -> build initial manifest
  -> SessionFileStore.writeManifest
  -> eventBus.emit(session.summary.updated, summary)
  -> return toSessionSummary(manifest)
```

第一版可以不写 `session.created` 事件。是否需要把创建也事件化，作为后续讨论点。

### 追加事件

```text
SessionRepository.appendEvents
  -> read manifest
  -> allocate seq
  -> append events.jsonl
  -> applySessionEventsToManifest(manifest, events)
  -> write manifest atomic
  -> eventBus.emit(session.summary.updated, summary)
  -> return toSessionSummary(manifest)
```

这里的关键约束：

- `appendEvents` 不接收整份 metadata snapshot。
- seq 分配只由 repository 做。
- manifest 更新只由 `session-manifest.utils.ts` 中的纯规则产生。

### 更新 metadata

```text
SessionRepository.patchMetadata
  -> read manifest
  -> patchSessionManifestMetadata(manifest, patch)
  -> optionally append metadata.patched event
  -> write manifest atomic
  -> eventBus.emit(session.summary.updated, summary)
  -> return toSessionSummary(manifest)
```

是否写 `metadata.patched` 事件需要讨论：

- 写事件：有审计和恢复优势。
- 不写事件：实现更简单，metadata 历史不可追。

我的倾向：项目 root、agent runtime id、model 这类会话上下文字段变更应写事件；纯 UI 已读时间这类临时字段可以只改 manifest，甚至不一定属于 session manifest。

## 读取路径

### 会话列表

```text
SessionRepository.listSessions
  -> fileStore.listSessionIds
  -> read each manifest
  -> toSessionSummary
  -> sort/filter/page
```

第一版不引入全局 index。这样慢一点，但最不容易错。`listSessions` 应返回所有不 expensive / heavy 的 manifest 当前态字段，避免前端为了普通列表、筛选、排序和快速恢复再 N+1 调 `getSession`。

### 单个会话详情

```text
SessionRepository.getSession
  -> read manifest
  -> toSessionSummary
  -> contextWindowOwner.getSnapshot(sessionId)
  -> return { summary, contextWindow }
```

`getSession` 不读 events，也不包含 messages。它返回 `SessionDetail`：其中 `summary` 和 `listSessions` 使用同一种 manifest 当前态模型；`contextWindow` 是额外观察字段，不属于 summary / metadata / manifest。

### 会话消息

```text
SessionRepository.listSessionMessages
  -> read events
  -> toSessionMessages
```

messages 是重集合，必须显式读取。agent run 初始化、会话详情页消息区域、历史导出等需要消息的场景，都调用 `listSessionMessages(sessionId)`。

如果未来单会话历史很大，可以增加 `cache/messages.snapshot.json`，但它仍然只能是可删 cache。

## 不建议第一版引入的抽象

- `ProjectionStore`
- `SummaryIndexStore`
- `MetadataStore`
- `LiveSessionMetadataCache`
- `SessionMetadataSynchronizer`
- `SessionEventBusProjectionWriter`
- `SessionRepairManager`
- `SessionReducer` class
- `SessionReader` class
- `SessionEventCodec` class
- 暴露 `stateManager` 字段的 `SessionRun`
- 负责存储读写的 `SessionRunManager`
- 把 invocation cancel/queue/retry 和 conversation state 混在一起的 `SessionRunManager`
- 把 `activeRun` / `abortDisabledReason` 放进 conversation state hydrate input
- 把 context-window 占用信息放进 `SessionRun` 或 conversation state manager
- `getOrCreateSessionRun` 这类读写混合 API
- `AgentRuntime` 直接依赖 `SessionRepository`、`SessionRunManager` 或 `eventBus`
- `AgentRuntime` API 直接接收裸 `NcpAgentConversationStateManager`
- `AgentRuntime` 直接读取 `metadata?: Record<string, unknown>`
- `AgentRuntime` 直接读取 `agentId` 或 `projectRoot`
- `AgentRuntime` 直接依赖 MCP registry、plugin registry 或 tool discovery 细节
- `AgentRunRequest` 直接携带 `AgentRuntime` 实例
- `AgentRunRequest` 直接携带 MCP registry、plugin registry 或 tools 大包
- 把 `AgentRunRequest` 和 `AgentRunSpec` 合并成一个大对象
- 同时保留 `thinking` / `thinkingLevel` / `reasoningEffort` / `reasoningLevel` 多套命名

这些概念不是永远不能有，而是不应该在第一版就有。只有出现真实性能、恢复或兼容压力时，才允许引入，并且必须证明它减少了真实复杂度。

## 设计取舍

### 为什么不用 projection 文件

projection 文件会引入同步关系。只要它开始像事实源，就会产生旧值覆盖新值、缓存过期、列表与详情不一致等问题。

第一版把列表摘要放进 manifest，是为了减少文件间同步。

### 为什么 manifest 可以放 stats

`stats` 是会话当前态的一部分，不是独立事实源。它由 append event 时的 manifest 纯规则更新，和 metadata 同属 manifest 当前态。

这比 `summary.json` 更简单，因为 summary 不再有单独写入口。

### 为什么 manifest 演进规则放 utils

如果没有集中规则，`appendEvents` 里会逐渐堆满 message count、preview、updatedAt、metadata patch 等计算。把这些逻辑放到 `session-manifest.utils.ts` 是为了集中纯计算，不是为了新增一个 owner class。

它更像 `SessionManifestReducer` 的函数集合，而不是完整的 `SessionReducer`。只有 manifest 当前态演进归它管，文件读写、事件序列和业务写入流程仍归 repository/store。

### 为什么 view 组装规则放 utils

`manifest -> SessionSummary`、`events -> messages` 是无状态转换，不是文件读取。因此不应叫 `SessionReader`，也不应放到 `stores/`。

第一版用 `session-view.utils.ts` 表达它的真实角色：把已经读到的数据组装成业务读取结果。它不定义默认包含 messages 的 `SessionView`，避免让 `getSession` 暗中变成 replay events 的重路径。

### 为什么需要 file store

文件 IO 是外部系统边界。把 tmp rename、JSONL append、路径解析集中起来，可以让 repository 专注业务操作。

### 为什么 repository 是唯一写入口

会话写入天然涉及多个事实：eventSeq、events、updatedAt、stats、metadata。只有一个 owner 统筹，才不会出现多个 manager 各自写一部分。

### 为什么 SessionRun 封装 state manager

现成的 `DefaultNcpAgentConversationStateManager` 已经承担 NCP event 到 conversation messages 的投影职责。终态设计应只保留 agent runtime 依赖的 conversation 信息，而不是把所有 UI 展示状态和 invocation 控制状态都混入同一个 state manager。

因此新设计不应该重写一套 messages list，也不应该把 state manager 裸露给外部。`SessionRun` 的价值在于把“某个 session 的运行时 conversation state”建模成业务对象，同时把具体投影实现收在内部，并额外维护最小 `activeRunId`。

这满足两个目标：

- agent runtime 只依赖 `SessionRun` 的稳定表面。
- 未来替换或调整 conversation state manager 时，不需要修改所有 session/runtime 调用方。
- context-window、abort UI 状态和完整 invocation 控制可以由各自 owner 演进，不污染 agent loop 运行时状态。

### 为什么 SessionRunManager 不碰持久化

`SessionRunManager` 的 information expert 是内存中的 `SessionRun` 生命周期，而不是文件中的会话事实。让它读取 repository 或写 events，会重新制造一条平行持久化入口。

正确边界是：上层编排者从 `SessionRepository` 读取 messages，再交给 `SessionRunManager.createSessionRun(...)` 创建运行态对象。运行态对象产生变化后，由 agent runtime 编排链路或明确的持久化 owner 决定哪些事件写回 repository。

## 待讨论问题

1. `metadata.patched` 是否必须进入 events？
2. `uiReadAt` 这类 UI 状态是否应属于 session manifest，还是应放到 UI 本地状态？
3. `messageCount` 和 `lastMessagePreview` 是否放 manifest，还是第一版从 events 计算？
4. 创建会话是否写 `session.created` event？
5. 坏事件行默认 fail closed，还是跳过并标记 repair？
6. `events.jsonl` 是否保留 provider/raw runtime 事件，还是只保留归一化领域事件？
7. 子会话关系放 metadata，还是放 manifest 顶层字段？
8. cache 引入阈值是什么：会话数、事件数、打开耗时，还是列表耗时？
9. `AgentRunRequestManager` 对 runtime events 的写入顺序是“先持久化再发 eventBus”，还是允许部分瞬时事件只发 eventBus？
10. 一次 invocation 的取消、排队、重试是否需要独立 owner，还是先保持在调用链局部变量中？
11. context provider 和 tool provider 的注册范围是 session feature 内部，还是未来抽到 agent-runtime feature？
12. `ContextBlock` 是否需要结构化 priority / placement / token budget，还是第一版只用 `string`？
13. `AgentRunRequest` 是否允许保留临时 `metadata` 兼容字段，还是在第一版就全部类型化？

## 渐进式落地策略

迁移方式按闭环切块推进，而不是按层先铺一批新 facade / manager。每一块都必须替掉一段旧职责，形成入口、owner、状态、输出和验证的完整闭环；不能只新增空壳，不能让新旧两套长期并行。

落地原则：

- 每次只做一个能独立成立的闭环切块。
- 新增 owner 前先确认现有对象是否已经能承接职责。
- 新增抽象必须替掉旧分叉或减少真实复杂度。
- 不为了“未来架构完整”预先添加暂时不用的稳定表面。
- 每个切块完成后，系统应该更少一条旧路径、更少一类事件或更清楚一个状态归属。
- 文件存储格式最后再动；在调用路径和 owner 边界收敛前，不提前迁移到 `manifest.json + events.jsonl`。

推荐切块顺序：

1. session summary event 收敛：把当前 summary upsert/delete 等分叉收敛成唯一 `session.summary.updated`，由当前实际负责 session summary 变化的 owner 统一发布。闭环是 summary 变化到 UI/list/cache 刷新。
2. context-window 归属剥离：从 summary / metadata 中移出 context-window 占用信息，收敛到独立观察状态 owner；`listSessions` 不带 context-window，`getSession` 聚合返回 `summary + contextWindow`。
3. `AgentRunRequestManager` ingress 化：复用现有 ingress，`start()` 订阅 agent run send / abort request，`send(...)` / `abort(...)` 私有化，并把 runtime 输出事件桥接到 eventBus。
4. `SessionRun` / inbox 运行态切入：只有在能替掉现有运行态消息列表或裸 state manager 暴露时再引入；目标闭环是 `sessionId + messages -> SessionRun -> inbox -> applyEvents -> snapshot.messages`。
5. context/tool provider contribution 化：从现有 context 构造或 tool 注册中挑一组具体能力迁移为 provider contribution；做到 `contribution start -> register provider -> run 使用 provider 输出 -> dispose unregister`。
6. `AgentRuntime` API 收敛：在 request manager、session run、provider 输出都稳定后，再把 runtime 入口收敛为 `AgentRunSpec + SessionRun + contextBlocks + tools + signal`。
7. 文件存储替换：最后把 repository/store 内部实现从当前 journal/metadata/index 等旧结构迁移到 `manifest.json + events.jsonl + artifacts/`。此时外部调用方不应感知存储格式变化。

## 当前推荐

第一版最小实现：

```text
AgentRunRequestManager
AgentRuntimeManager
ContextProviderManager
ToolProviderManager
Provider contributions (注册具体 ContextProvider / ToolProvider)
SessionRunManager
SessionRun
MessageInbox (由 SessionRun 暴露)
SessionRepository
Context-window owner (独立观察状态 owner，供 getSession 聚合读取)
SessionFileStore
session-manifest.utils.ts
session-view.utils.ts
session.types.ts
```

对应代码目录：

```text
features/session/managers/agent-run-request.manager.ts
features/session/managers/agent-runtime.manager.ts
features/session/managers/context-provider.manager.ts
features/session/managers/tool-provider.manager.ts
features/session/managers/session-run.manager.ts
features/session/contributions/<provider-name>/index.ts
features/session/managers/session-context-window.manager.ts
features/session/repositories/session.repository.ts
features/session/stores/session-file.store.ts
features/session/utils/session-manifest.utils.ts
features/session/utils/session-view.utils.ts
features/session/types/session.types.ts
```

可选后加：

```text
features/session/utils/session-event-codec.utils.ts
```

文件结构：

```text
sessions/<sessionId>/manifest.json
sessions/<sessionId>/events.jsonl
sessions/<sessionId>/artifacts/
```

暂不引入：

```text
summary.json
messages.json
global index.json
projections/
cache/
public stateManager field
```

只有当真实性能数据证明需要时，再加 `cache/`，并且 cache 必须是可删除、可重建、不可写回事实源的派生数据。
