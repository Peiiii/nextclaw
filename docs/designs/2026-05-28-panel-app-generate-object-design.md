# Panel App Agent API 方案设计

## 背景

Panel App + Service App 已经让用户能低成本生成一个轻量 UI，并通过受控 action 调用用户自定义后端能力。但它仍然缺一类更“AI 原生”的能力：Panel App 需要把当前 UI 状态、用户选择、局部数据和任务说明交给 NextClaw 的持续 Agent 会话，并拿回一个可直接用于应用状态更新的结构化对象。

这不是普通 LLM API，也不是裸 session API。它的产品价值是：

> Panel App 可以把持续会话里的 Agent 当成一个结构化生成能力使用；同一个 `peerId` 复用同一个 session，因此它既像输入输出函数，又保留会话记忆。

第一版只做 `agent.send` 与 `generateObject`：前者薄透出现有 agent run send，后者在同一底层链路上等待结构化结果。不做 `generateText`、stream、session picker、Agent 操作 iframe DOM，也不把 Service App actions 默认投影给 Agent。

## 核心原则

- 不新增 kernel manager。现有 `NcpSessionManager`、`AgentRunRequestManager`、`Ingress`、`EventBus`、tool provider 电路已经是主链路。
- 不裸露底层 session API。Panel App 只看到面向应用场景的 `window.nextclaw.agent.send(...)` 与 `window.nextclaw.agent.generateObject(...)`。
- 不新增 peer 实体或 peer registry。`peerId` 是 App 作者自己提供的稳定字符串；系统只用 `appId + peerId` 查找或创建 session。
- 底层缺口只补通用机制：按请求 metadata 临时贡献结构化结果工具，而不是 Panel App 专属执行链。
- JSON/Object 输出不用 final reply 文本强约束，而用结构化结果 tool call 承载结果。

## 上层注入 API

第一版主能力是结构化返回：

```ts
type GenerateObjectInput = {
  peerId: string;
  prompt: string;
  context?: unknown;
  schema: Record<string, unknown>;
  title?: string;
  timeoutMs?: number;
};

type GenerateObject = (input: GenerateObjectInput) => Promise<unknown>;

window.nextclaw.agent.generateObject(input);
```

示例：

```ts
const result = await window.nextclaw.agent.generateObject({
  peerId: "mood-summary",
  prompt: "总结情绪趋势，并给出三个建议。",
  context: { entries },
  schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      suggestions: {
        type: "array",
        items: { type: "string" }
      }
    },
    required: ["summary", "suggestions"],
    additionalProperties: false
  }
});
```

返回值直接是 tool arguments 对应的 object，不默认返回 envelope。调试信息、`sessionId`、`requestId` 后续可以通过开发模式或显式 debug 选项暴露。

同一批可以顺手补一个更底层、更薄的 fire-and-forget 能力：

```ts
type AgentSendInput =
  | {
      sessionId?: string;
      peerId?: string;
      content: NcpMessagePart[];
      message?: never;
      metadata?: Record<string, unknown>;
    }
  | {
      sessionId?: string;
      peerId?: string;
      message: NcpMessage;
      content?: never;
      metadata?: Record<string, unknown>;
    };

type AgentRunHandle = {
  sessionId: string;
  userMessageId: string;
  assistantMessageId: null;
  runId?: string;
  correlationId?: string;
};

window.nextclaw.agent.send(input): Promise<AgentRunHandle>;
```

`agent.send` 的设计目标是不做智能包装：它的输入形态对齐现有 `AgentRunSendIngressPayload`，输出对齐现有 `NcpRunHandle`。Panel App 可以用它只触发一次会话 run，不关心最终回复；也可以传入稳定 `peerId`，由底层主链路复用同一个持续会话。

`agent.send` 与 `generateObject` 的关系：

- `agent.send` 是原子能力：只发起 run，返回 handle，不等待结果、不解析输出、不加结构化工具。
- `generateObject` 是应用便利能力：内部也是一次 agent send，但额外构造结构化结果合同，并等待 `nextclaw_submit_result`。
- 两者共享 bridge 身份、权限、session 复用和底层 `Ingress agent-run.send` 主链路。

即使 `agent.send` 尽量直出，也仍然是安全边界 API。bridge adapter 需要还原真实 Panel App 身份，并注入或覆盖这些保留 metadata，避免 iframe 伪造来源：

```json
{
  "source_kind": "panel_app",
  "panel_app_id": "mood-calendar",
  "panel_app_bridge_request_id": "..."
}
```

除这些身份字段和基础输入校验外，`agent.send` 不改写业务 payload，不替调用方创建 prompt 模板，不等待 event stream。

## peerId 与会话复用

`peerId` 是 `agent-run.send` 主链路的通用稳定会话身份输入，不只属于 `generateObject`。它不做系统级 peer 实体建模，也不需要 registry；调用方只提供一个稳定 key，session id 必须由内部 session owner 派生，不能由 Panel App、Service App、iframe 或其它外部扩展自己生成。

- `writing-assistant`：整个应用共用一个写作会话。
- `doc:${docId}`：每个文档一个会话。
- `game:${gameId}`：每盘棋一个会话。
- 随机 ID：一次性会话。

Panel App 场景由 bridge 还原出的 `appId` 提供内部 peer scope，再把 `peerId` 透传到 `Ingress agent-run.send`。`AgentRunRequestManager` 不生成 session id，只把 `peerId` 交给 `SessionManager.getOrCreateAgentRunSession(...)`。`SessionManager` 作为 session 事实 owner，用内部 peer scope + `peerId` 派生稳定 session id，并完成复用或创建。

metadata 使用与现有 session metadata 风格一致的 snake_case 字段：

```json
{
  "agent_peer_id": "mood-summary",
  "agent_peer_scope": "panel-app:mood-calendar",
  "panel_app_id": "mood-calendar",
  "panel_app_peer_id": "mood-summary",
  "label": "心情日历 / mood-summary"
}
```

稳定 sessionId 的具体格式是内部实现细节，第一版由 `SessionManager` 统一负责。外部扩展、注入 SDK、HTTP adapter 和 Panel App manager 不允许拼装或约定稳定 session id。这里不新增 `PeerManager` 或 `AppSessionManager`，也不为了第一版扫描全部 session metadata。

如果后续确实需要按 metadata 查询，再由 `NcpSessionManager` 作为 session 事实 owner 补索引能力；第一版不为这个场景新增索引或 registry。

`sessionId` 只保留给已有明确会话的 continuation 或历史兼容入口。新扩展能力如果想稳定绑定会话，默认必须使用 `peerId`，不能在外部生成、缓存或反推出稳定 session id。若同一请求同时传 `sessionId` 和 `peerId`，应视为身份语义冲突并拒绝。

## 结构化输出机制

`generateObject` 的结果必须来自工具调用，而不是 final reply 文本。

本次 run 通过 message metadata 声明一个结构化结果合同，由通用 provider 临时提供 result tool：

```ts
{
  name: "nextclaw_submit_result",
  description: "Submit the structured result for the current request.",
  parameters: input.schema
}
```

Agent 收到的任务消息会明确要求：

```text
You are handling a NextClaw Panel App generateObject request.
Use the nextclaw_submit_result tool to submit the result.
Do not use natural language as the result.
```

当 Agent 调用 `nextclaw_submit_result(args)` 时，工具校验 `args` 是否符合 schema，并把 `args` 原样作为 tool result 返回。`generateObject` 监听现有 `MessageToolCallResult` 事件拿到结果。final reply 可以存在于 session history 中，但不作为 Panel App 的返回值来源。

如果 Agent 没有调用工具、工具参数不符合 schema、run 失败或超时，Panel App 收到明确错误：

- `AGENT_OBJECT_RESULT_TIMEOUT`
- `AGENT_OBJECT_RESULT_NOT_SUBMITTED`
- `AGENT_OBJECT_RESULT_SCHEMA_INVALID`
- `AGENT_OBJECT_REQUEST_FAILED`

## 底层电路复用与最小补丁

当前已有主链路：

```text
Ingress agent-run.send
  -> AgentRunRequestManager
  -> SessionRunManager
  -> ContextProviderManager
  -> ToolProviderManager
  -> AgentRuntime
  -> EventBus eventKeys.ncpEvent
```

需要补的不是新链路，而是在现有 tool provider 机制里增加一个非常薄的 provider：

### StructuredResultToolProvider

`generateObject` 不把函数型 tool 塞进 ingress payload，也不改变 runtime 结束语义。它把结构化结果合同写入本次 user message 的 metadata，由 `ToolProviderManager` 中的 `StructuredResultToolProvider` 读取：

```ts
type StructuredResultToolRequestMetadata = {
  structured_result?: {
    request_id: string;
    tool_name: "nextclaw_submit_result";
    schema: Record<string, unknown>;
  };
};
```

provider 的行为是：

```ts
export class StructuredResultToolProvider implements ToolProvider {
  provide = (request: AgentRunRequest): readonly NcpTool[] => {
    const contract = readStructuredResultContract(request.message.metadata);
    if (!contract) {
      return [];
    }
    return [new StructuredResultSubmitTool(contract)];
  };
}
```

这仍然是通用底层能力，不是 Panel App 专属。未来 channel、automation、内部 workflow 只要在 message metadata 里声明同样合同，也能复用这个结构化结果提交工具。

### StructuredResultSubmitTool

`nextclaw_submit_result` 工具本身不执行业务逻辑。它只做参数校验，并把入参作为 tool result 原样返回：

```ts
export class StructuredResultSubmitTool implements NcpTool {
  readonly name = "nextclaw_submit_result";
  readonly description = "Submit the structured object result for this request.";

  constructor(private readonly contract: StructuredResultContract) {}

  get parameters(): Record<string, unknown> {
    return this.contract.schema;
  }

  validateArgs = (args: Record<string, unknown>): string[] =>
    validateJsonSchema(this.contract.schema, args);

  execute = async (args: Record<string, unknown>): Promise<unknown> => {
    return args;
  };
}
```

现有 runtime 在执行工具前已经会解析 JSON、检查 `parameters`，并调用 `validateArgs`。因此这个工具的 `execute` 不需要再做业务处理，直接返回入参即可。

结果捕获也不需要额外 callback。现有 runtime 会把 tool return value 发布为 `MessageToolCallResult`。由于 result event 只有 `toolCallId` 而不一定带 `toolName`，`PanelAppManager.generateObject` 应先监听同一 `correlationId` 下的 `MessageToolCallStart`，记录 `toolName === "nextclaw_submit_result"` 的 `toolCallId`，再从对应 `MessageToolCallResult` 读取 `content`。

如果 `MessageToolCallResult.content` 是 `{ ok: false, error: ... }`，并且错误来自 `invalid_tool_arguments` 或 `tool_execution_failed`，`generateObject` 把它转成 `AGENT_OBJECT_RESULT_SCHEMA_INVALID` 或 `AGENT_OBJECT_REQUEST_FAILED`。如果直到 run 结束或 timeout 都没有等到 result tool，则返回 `AGENT_OBJECT_RESULT_NOT_SUBMITTED` 或 `AGENT_OBJECT_RESULT_TIMEOUT`。

这也意味着第一版不新增 `finishAfterToolNames` 或 terminal tool 语义。Agent 调用结果工具后，runtime 可能自然继续一轮并生成 final reply；`generateObject` 在收到 tool result 时即可 resolve，不必等待 `RunFinished`。如果后续 token 成本或体验确实证明需要“提交即结束”，再作为独立底层能力讨论。

## Panel App Bridge 适配

现有 Panel App bridge 已负责 iframe 身份、安全通信和 service actions 授权。Agent 能力只在该 bridge 上新增两个方法类型：

```text
panel-app-bridge: agent.send
panel-app-bridge: agent.generateObject
```

Controller / bridge adapter 的共同职责：

1. 还原 app identity，不信任 iframe 自报 `appId`。
2. 校验 manifest/meta 中声明了对应能力：`agent:send` 或 `agent:generateObject`。
3. 校验或触发 app 级授权。
4. 校验输入是合法的 agent send payload 或 generateObject payload。
5. 注入或覆盖 Panel App 身份 metadata。

`agent.send` 的 adapter 更薄：校验 bridge session、能力和授权后，直接调用现有 `AgentRunClient.send(...)`，返回 run handle。

`generateObject` 的 adapter 在共同职责之后继续做：

1. 校验 `peerId`、`prompt`、`schema` 的基本形状与大小限制。
2. 构造带 `structured_result` metadata 的 message draft，不填 sessionId。
3. 把 `peerId` 交给现有 `AgentRunClient.sendAndStreamEvents(...)` 发起 run。
4. 从现有 event stream 等待 `nextclaw_submit_result` 的 tool result 或错误/超时。
5. 返回 object 给 iframe。

两者内部仍走 `Ingress agent-run.send` 与 `eventKeys.ncpEvent`。server 仍然应保持薄层；如果这段适配逻辑变长，优先放到现有 Panel Apps feature 内部的 bridge service/utility，而不是新增 kernel manager。

## 消息格式

投送到 session 的 user message 应稳定、可读、可追踪：

```text
Panel App generateObject request

Panel App: 心情日历
Panel App ID: mood-calendar
Peer ID: mood-summary

Context JSON:
{...}

Task:
总结情绪趋势，并给出三个建议。

Result contract:
Call the nextclaw_submit_result tool exactly once with an object matching the provided schema.
```

message metadata 建议包含：

```json
{
  "source_kind": "panel_app",
  "panel_app_id": "mood-calendar",
  "panel_app_peer_id": "mood-summary",
  "panel_app_bridge_request_id": "...",
  "structured_result": {
    "request_id": "...",
    "tool_name": "nextclaw_submit_result",
    "schema": {
      "type": "object",
      "properties": {}
    }
  }
}
```

## 权限模型

第一版做 app 级授权，不做 peerId 级授权：

```html
<meta name="nextclaw-panel-capabilities" content="agent:send agent:generateObject">
```

首次调用时展示类似：

> 允许“心情日历”向 NextClaw Agent 会话发送上下文，并接收结构化结果？

`agent:send` 的授权文案应更直接：

> 允许“心情日历”向 NextClaw Agent 会话发送消息？

授权状态复用现有 Panel App grant 机制，避免另建授权系统。后续如果需要更细粒度，再讨论 `agent:send:<peerId>`、`agent:generateObject:<peerId>` 或按数据敏感度确认。

## MVP 范围

第一版实现：

1. 注入 `window.nextclaw.agent.generateObject`。
2. 注入 `window.nextclaw.agent.send`。
3. Panel App capability / grant 支持 `agent:send` 与 `agent:generateObject`。
4. `agent-run.send` 支持 `peerId`，由 `SessionManager` 内部复用或创建稳定 session。
5. `StructuredResultToolProvider` 按 message metadata 提供 `nextclaw_submit_result` tool。
6. schema 校验后返回 object。
7. 超时与错误码。
8. 更新 `panel-app-creator` skill，给一个 `send` 和 `generateObject` 示例。

第一版不做：

- `generateText`
- streaming
- session picker
- peer registry / peer manager
- Agent 直接操作 iframe DOM
- Agent tool projection
- 自动 JSON repair
- marketplace 分发
- `agent.send` 的流式事件订阅封装

## 验收标准

- 一个 Panel App 调用 `generateObject`，第一次会自动创建 session；第二次同 `peerId` 复用同一 session，且 Panel App manager 不生成 sessionId。
- 一个 Panel App 调用 `agent.send({ peerId, ... })`，第一次会自动创建 session；第二次同 `peerId` 复用同一 session。
- 一个 Panel App 调用 `agent.send({ sessionId, ... })`，仍可作为已有会话 continuation；同时传 `sessionId` 与 `peerId` 必须失败。
- Agent 必须通过 `nextclaw_submit_result` 返回结构化结果；Panel App 拿到的是 object，不是字符串。
- Agent 不调用 result tool 时，Panel App 收到明确错误。
- schema 校验失败时，Panel App 收到明确错误。
- session history 中能看到 Panel App 投送的上下文与工具提交痕迹。
- 未声明 `agent:send` / `agent:generateObject` 或未授权的 Panel App 无法调用对应能力。
- 底层仍走 `Ingress -> AgentRunRequestManager -> runtime -> EventBus`，没有新增平行 agent run 链路。

## 第一版实现决策

1. schema 校验复用现有 `validateToolArgs`，不引入新的 JSON Schema validator。
2. 默认 timeout 为 60 秒，允许 Panel App 传 `timeoutMs`，上限 120 秒。
3. session 创建与模型/runtime 选择完全沿用现有 agent run 默认链路，`generateObject` 第一版不开放覆盖项。
4. `prompt` 与 `context` 做硬上限，避免 Panel App 一次性塞入过大上下文。
5. result tool 被调用后不 abort run；`generateObject` 收到 tool result 即返回，同时退订事件监听，让 run 按现有 runtime 语义自然完成。
6. capability grant 独立存储为 Panel App capability grant，不和 Service Action grant 混在一起，但授权 UI 复用现有确认 manager。
7. server/client/UI 只做薄 adapter；核心身份还原、能力声明校验、授权校验和 structured result 等待归 `PanelAppManager`，稳定 sessionId 派生归 `SessionManager`。
