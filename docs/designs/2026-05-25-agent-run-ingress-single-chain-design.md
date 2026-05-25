# Agent Run Ingress 单一链路设计草案

## 背景

当前新 agent-run branch 已经通过 `KernelBranch` 注册了 `ingressKeys.agentRun.send` handler。前端发送消息时走的是：

```text
POST /api/ncp/agent/send
  -> kernel.ingress.handle(ingressKeys.agentRun.send)
  -> branch AgentRunRequestManager
  -> eventBus.ncpEvent
  -> /api/ncp/agent/stream
```

这条链路能自然落到新 branch，是因为它没有直接依赖某个 manager 实例，而是通过 `Ingress` 发布“发送一条 agent run 消息”的语义命令。

微信、cron、plugin bridge 和 CLI 当前仍然走旧 direct runner 形态：

```text
runPromptOverNcp(...)
  -> agent.run(...)
  -> kernel.agentRunRequestManager.run(...)
```

在 branch 模式下，`kernel.agentRunRequestManager` 仍是旧 manager；新 branch 的 `agentRunRequestManager` 只在 `KernelBranch` 内部。因此这些入口绕过了 `Ingress` 上的 `ingressKeys.agentRun.send`，没有跟前端使用同一条链路。

## 目标

- 所有用户消息发送入口统一走现有 `Ingress` 入口：`ingressKeys.agentRun.send`。
- 不新增 `agentRun.requestReply`、`agentRun.runPrompt` 或新的 agent-run 公共命令。
- 不让 gateway、cron、plugin、CLI 直接访问 `KernelBranch`。
- 删除或改造 `NcpRunnerAgent.run(...)` 这条平行入口依赖。
- `ingressKeys.agentRun.send` 的 payload 自身成为 typed request；现有挂在 metadata 里的字段继续挂在 metadata，但 metadata 内部要类型化。
- channel/gateway 可以像前端一样基于 `eventBus.ncpEvent` 观察 run 输出；区别只是观察者在服务端，而不是浏览器。

## 非目标

- 不重写 channel adapter 协议。
- 不改变前端 `/api/ncp/agent/send` 与 `/api/ncp/agent/stream` 的 URL、响应形态、stream 机制和字段位置。
- 不引入新的 manager/facade 作为 `Ingress` 的平行替代。
- 不长期保留旧字段兼容散落在核心 manager 内。
- 不在本次解决整个 session 持久化架构，只补齐 agent-run 单一链路所需的显式 session key 能力。
- 不把图片输入能力做成新的 `visionModels` 数组或平行 capability map；模型能力归入单个模型自己的配置对象。

## 设计原则

- `single-domain-owner`：agent run 的写入口只有 `Ingress` 上的 `ingressKeys.agentRun.send`。
- `request-bus-decoupling`：跨 owner 请求通过现有 `Ingress`，输出通过现有 `eventBus.ncpEvent`。
- `boundary-normalization`：`ingressKeys.agentRun.send` 边界负责把外部输入转成明确 request，内部依赖 typed payload 和 `AgentRunRequest`。
- `deletion-first`：迁移 direct runner 调用方，而不是新增一套 reply 命令或 facade。
- `abstraction-earns-place`：保留一个轻量 `AgentRunClient` 作为调用方 helper；它的业务语义是发起 agent run 并观察结果，`Ingress` / `EventBus` 只是内部机制，不进入业务命名。
- `model-capability-locality`：thinking、vision 这类模型能力属于具体模型，不属于 provider 旁边的多个平行数组或 map。

## 当前问题清单

### 1. Gateway 绕过 ingress

`GatewayInboundProcessor` 当前直接传入旧 manager：

```ts
const result = await runPromptOverNcp({
  agent: this.runtime.kernel.agentRunRequestManager,
  sessionId: route.sessionKey,
  content: message.content,
  metadata: runMetadata,
});
```

channel reply 分支也一样：

```ts
await dispatchChannelReplyRoute({
  agent: this.runtime.kernel.agentRunRequestManager,
  ...
});
```

这两个调用都应该改为基于 `AgentRunClient`；`AgentRunClient` 内部只做 `ingress + eventBus` 编排，不持有 runtime 或 branch。

### 2. `runPromptOverNcp` 抽象表达了旧链路

`nextclaw-ncp-runner.utils.ts` 当前定义：

```ts
export type NcpRunnerAgent = {
  run: (
    envelope: NcpRequestEnvelope,
    options?: NcpAgentRunSendOptions,
  ) => AsyncIterable<NcpEndpointEvent>;
  assetApi?: AssetApi;
};
```

这个类型要求调用方提供可直接执行 runtime 的 agent。它不符合新目标，因为正确入口应该是：

```text
ingress.handle(ingressKeys.agentRun.send) -> eventBus.ncpEvent
```

### 3. cron/plugin/CLI 继续依赖旧 manager

调用面包括：

- `packages/nextclaw-service/src/shared/services/gateway/utils/cron-job-handler.utils.ts`
- `packages/nextclaw-service/src/shared/services/plugin/utils/plugin-runtime-bridge.utils.ts`
- `packages/nextclaw-service/src/cli/commands/agent/cli-agent-runner.utils.ts`

这些入口应统一传 `kernel.ingress`、`kernel.eventBus` 和 `kernel.assetStore`，不再传 `kernel.agentRunRequestManager`。

### 4. 显式 session key 缺少 create-if-missing

前端根会话可以不传 `sessionId`，由后端创建新 session。微信/gateway 不同：它有稳定的 `route.sessionKey`，例如某个微信 direct route。

如果直接把 `route.sessionKey` 作为 `ingressKeys.agentRun.send` payload 的 `sessionId` 传给 branch manager，当前 `SessionRepository.getSession(sessionId)` 在 session 不存在时会抛错。因此需要补齐：

```text
传入显式 sessionId
  -> session 存在：复用
  -> session 不存在：用这个 sessionId 创建
```

这不是新链路，而是让同一个 `Ingress` 入口 `ingressKeys.agentRun.send` 支持 channel 稳定 session identity。

### 5. `AgentRunSendIngressPayload` 还没有承接完整 request 合同

当前 `ingressKeys.agentRun.send` 虽然通过 typed key 约束了 payload 外壳，但 agent-run 实际依赖的一些字段仍藏在 `metadata?: Record<string, unknown>` 里。设计目标不是在 manager 里到处写：

```ts
metadata.agentRuntimeId ?? metadata.runtime ?? metadata.session_type
```

而是在 `AgentRunSendIngressPayload.metadata` 内把这些实际依赖字段类型化。字段位置不迁移，现状挂在哪，新合同就在哪约束。

## 目标链路

### UI

```text
UI
  -> POST /api/ncp/agent/send
  -> kernel.ingress.handle(ingressKeys.agentRun.send)
  -> eventBus.ncpEvent
  -> browser stream
```

### 微信 / QQ / 飞书 / gateway inbound

```text
channel extension
  -> messageBus.publishInbound
  -> GatewayInboundProcessor
  -> kernel.ingress.handle(ingressKeys.agentRun.send)
  -> eventBus.ncpEvent
  -> gateway waits/streams matching run events
  -> channel reply / outbound message
```

### cron / plugin / CLI

```text
caller builds prompt request
  -> kernel.ingress.handle(ingressKeys.agentRun.send)
  -> eventBus.ncpEvent
  -> helper waits for completed message
  -> return text / deliver outbound / print CLI output
```

## `AgentRunSendIngressPayload` 合同

`Ingress` 的 key 可以提供 payload 类型约束。这里应该让 `ingressKeys.agentRun.send` 的 payload 成为唯一对外请求合同，而不是再新增 `runPrompt`、`requestReply` 或新的 metadata request 类型。

推荐把 `AgentRunSendIngressPayload` 改成一个直接对象类型：

```ts
export type AgentRunSendIngressPayload = {
  sessionId?: string;
  correlationId?: string;

  message?: NcpMessage | NcpOutboundMessageDraft;
  content?: NcpMessagePart[];

  metadata?: Record<string, unknown> & {
    agentRuntimeId?: string;
    agentId?: string;
    projectRoot?: string;
    channel?: string;
    model?: string;
    maxTokens?: number;
    thinkingEffort?: string | null;
    chatId?: string;
    accountId?: string;
    senderId?: string;
    sessionKey?: string;
    label?: string;
  };
};
```

这里不再拆 `Base` / union / canonical metadata 类型。`message` 和 `content` 二选一继续由现有 runtime 校验保证；换来的是 request 合同表面清楚，调用方能直接看懂一次 agent run 需要什么。

字段职责：

- `sessionId`、`correlationId`、`message/content`：发送一次 run 的基础合同。
- `metadata.agentRuntimeId/agentId/projectRoot/model/maxTokens/thinkingEffort`：现状就在 metadata 内的 agent-run 执行决策输入，本轮只做类型化，不搬位置。
- `metadata.channel`：现状就在 metadata 内的来源字段，继续放 metadata。
- `metadata.chatId/accountId/senderId/sessionKey/label`：渠道上下文和展示/路由上下文。
- `metadata` 的其他字段：平台原始上下文或追踪信息，只透传，不作为 manager 决策依据。

`AgentRunRequestManager.toAgentRunRequest(...)` 继续从 metadata 读这些字段，但因为 `AgentRunSendIngressPayload.metadata` 已经类型化，不需要像读取 `Record<string, unknown>` 一样堆很多 `readXxx`：

```ts
const metadata = payload.metadata ?? {};
const requestMetadata = {
  agentRuntimeId: metadata.agentRuntimeId,
  agentId: metadata.agentId,
  projectRoot: metadata.projectRoot,
  channel: metadata.channel,
  correlationId: payload.correlationId,
  model: metadata.model,
  maxTokens: metadata.maxTokens,
  thinkingEffort: metadata.thinkingEffort,
  metadata: structuredClone(metadata),
};
```

不要在这里再读 legacy alias：

```text
metadata.session_type
metadata.agent_id
metadata.project_root
metadata.preferred_model
```

如果确实存在历史调用方还在写 legacy alias，本轮优先同步改调用方写 metadata 的 typed 字段；不要把 legacy alias 写成新合同。只有存量 session 读取这类“已落盘旧数据”可以在读取边界做有限迁移。

### 6. 非 vision 模型收到历史图片输入会触发 provider 反序列化错误

微信测试中出现：

```text
400 Failed to deserialize the JSON body into the target type: messages[1]: unknown variant imageurl, expected text
```

实际 session 当前最新消息是文本，但历史上下文里已有图片或工具截图内容。新 branch 会把这些历史消息投影进模型输入；如果当前模型不支持视觉输入，底层 provider 仍收到 `image_url` / `input_image` 内容块，就会在 provider 请求边界失败。

这个问题不属于微信，也不属于 gateway。它是“模型输入投递前没有按模型能力归一化”的问题。正确落点是在模型调用前的统一边界：

```text
NCP session messages
  -> model input builder
  -> ProviderManagerNcpLLMApi
  -> LlmProviderManager.chatStream(...)
  -> 按 modelConfig[model].vision 判断是否保留图片输入
  -> provider
```

上层只负责表达用户消息和附件事实；是否保留图片块由模型能力配置决定。

## Provider modelConfig 合同

现状 thinking 能力是：

```ts
providers.openai.models = ["openai/gpt-5.3-codex"];
providers.openai.modelThinking = {
  "gpt-5.3-codex": {
    supported: ["minimal", "low", "medium", "high"],
    default: "low",
  },
};
```

这个结构已经是“按模型配置 thinking”，但模型事实被拆成了 `models[]` 和 `modelThinking{}` 两块。如果再新增 `visionModels[]` 或 `modelCapabilities{}`，会继续分裂同一个模型的事实。

目标结构改为：

```ts
providers.openai.models = ["openai/gpt-5.3-codex"];
providers.openai.modelConfig = {
  "gpt-5.3-codex": {
    thinking: {
      supported: ["minimal", "low", "medium", "high"],
      default: "low",
    },
    vision: true,
  },
};
```

字段语义：

- `modelConfig[model].thinking`：该模型支持的 thinking 档位和默认档位。
- `modelConfig[model].vision`：该模型是否支持视觉输入；缺省等价于 `false`。
- `models[]`：仍保留为当前 UI 和配置选择器使用的模型 id 列表；不在本轮改成对象数组，避免扩大迁移面。

迁移策略：

- 读取旧配置时，把 `modelThinking[model]` 迁移到 `modelConfig[model].thinking`。
- 新 UI 和 API 只读写 `modelConfig`。
- 不新增 `visionModels` / `allowImageModels` / `modelCapabilities` 这类平行结构。
- builtin provider 里的静态视觉能力也迁到 `ProviderSpec.modelConfig[model].vision`。

### buildRunMetadata 改造

`packages/nextclaw-kernel/src/features/ncp-dispatch/utils/ncp-run-metadata.utils.ts` 当前同时写 camel + snake：

```ts
channel, chatId, chat_id, accountId, account_id, agentId, agent_id, sessionKey, session_key
```

改为只写 typed metadata 字段，不再同时写 snake_case 副本。合并外部 metadata 前先移除 legacy alias，避免旧字段继续在 session metadata 里扩散：

```ts
const metadataContext = omitAgentRunCoreMetadata({
  ...(message.metadata ?? {}),
  ...(metadata ?? {}),
});

return {
  ...metadataContext,
  channel: message.channel,
  chatId: message.chatId,
  accountId: route.accountId,
  agentId: route.agentId,
  sessionKey: route.sessionKey,
  senderId: message.senderId,
};
```

发起 run 时由调用方构造 typed payload：

```ts
const payload: AgentRunSendIngressPayload = {
  sessionId: route.sessionKey,
  content: parts,
  metadata: buildRunMetadata({ message, route, metadata }),
};
```

## 具体代码改动

### 1. 改 `nextclaw-ncp-runner.utils.ts`

文件：

```text
packages/nextclaw-kernel/src/features/ncp-dispatch/utils/nextclaw-ncp-runner.utils.ts
```

删除 `NcpRunnerAgent` 对 `agent.run(...)` 的依赖，替换为一个很薄的 `AgentRunClient`。它只负责两件事：

- 通过 `Ingress` 投递 `ingressKeys.agentRun.send`。
- 对需要返回结果的调用，先订阅 `eventBus.ncpEvent`，再投递请求。

```ts
export class AgentRunClient {
  constructor(private readonly options: {
    ingress: Ingress;
    eventBus: Pick<EventBus, "on">;
  }) {}

  send(input: AgentRunSendIngressPayload): Promise<NcpRunHandle>;
  sendAndWaitForReply(
    input: AgentRunSendIngressPayload,
    options?: AgentRunReplyOptions,
  ): Promise<AgentRunReply>;
  sendAndStreamEvents(
    input: AgentRunSendIngressPayload,
    options?: AgentRunStreamOptions,
  ): AsyncGenerator<NcpEndpointEvent>;
}
```

`AgentRunClient` 对外只暴露三个方法，不暴露更细的 wait/stream primitive：

- `send(...)`：只投递消息并返回 handle，适合已经有独立 stream 机制的调用方，例如 UI HTTP route。
- `sendAndWaitForReply(...)`：内部先订阅 `eventBus.ncpEvent`，再调用 `send` 的同一投递逻辑，等待最终 `MessageCompleted` / `RunError` / `MessageFailed`。
- `sendAndStreamEvents(...)`：内部先订阅 `eventBus.ncpEvent`，再调用 `send` 的同一投递逻辑，把本次 run 的事件流交给 channel reply。

原因是 `waitForReply(handle)` 或 `streamEvents(handle)` 会诱导调用方先 `send` 再订阅，从而可能错过早期事件。需要返回结果的 API 必须由 client 内部保证“先订阅、后发送”。

不再定义 `AgentRunSendInput` / `AgentRunReplyInput` / `AgentRunStreamInput`。`AgentRunClient` 的请求输入统一就是 `AgentRunSendIngressPayload`；等待、流式、abort 和回调属于调用行为，放在 options 里：

```ts
export type AgentRunReplyOptions = {
  abortSignal?: AbortSignal;
  onAssistantDelta?: (delta: string) => void;
  onEvent?: (event: NcpEndpointEvent) => void;
  missingCompletedMessageError?: string;
  runErrorMessage?: string;
};

export type AgentRunStreamOptions = {
  abortSignal?: AbortSignal;
  onEvent?: (event: NcpEndpointEvent) => void;
};

export type AgentRunReply = {
  handle: NcpRunHandle;
  text: string;
  completedMessage: NcpMessage;
};
```

内部实现分为两个私有步骤：

```ts
private prepareObserver(params: {
  correlationId: string;
  options?: AgentRunReplyOptions | AgentRunStreamOptions;
}): AgentRunObserver;

private sendWithCorrelation(
  input: AgentRunSendIngressPayload,
  correlationId: string,
): Promise<NcpRunHandle>;
```

`send(...)` 只调用 `sendWithCorrelation(...)`：

```ts
send = async (input: AgentRunSendIngressPayload): Promise<NcpRunHandle> =>
  await this.sendWithCorrelation(input, randomUUID());
```

`sendAndWaitForReply(...)` 的关键时序：

```ts
sendAndWaitForReply = async (
  input: AgentRunSendIngressPayload,
  options?: AgentRunReplyOptions,
): Promise<AgentRunReply> => {
  const correlationId = randomUUID();
  const observer = this.prepareObserver({ correlationId, options });
  try {
    const handle = await this.sendWithCorrelation(input, correlationId);
    observer.attachHandle(handle);
    const completedMessage = await observer.waitForReply(options);
    return {
      handle,
      completedMessage,
      text: extractTextFromNcpMessage(completedMessage),
    };
  } finally {
    observer.dispose();
  }
};
```

`sendAndStreamEvents(...)` 的关键时序：

```ts
sendAndStreamEvents = async function* (
  this: AgentRunClient,
  input: AgentRunSendIngressPayload,
  options?: AgentRunStreamOptions,
): AsyncGenerator<NcpEndpointEvent> {
  const correlationId = randomUUID();
  const observer = this.prepareObserver({ correlationId, options });
  try {
    const handle = await this.sendWithCorrelation(input, correlationId);
    observer.attachHandle(handle);
    yield* observer.stream(options);
  } finally {
    observer.dispose();
  }
};
```

`sendWithCorrelation(...)` 的流程：

```text
1. 复制 input 并补上 correlationId
2. ingress.handle(ingressKeys.agentRun.send, payload)
3. 返回 NcpRunHandle
```

`prepareObserver(...)` 的流程：

```text
1. 生成 correlationId
2. 先订阅 eventBus.ncpEvent
3. 先按 correlationId 过滤本次 run 事件
4. attachHandle 后记录 sessionId / runId
5. terminal event 后关闭 stream
6. abortSignal 触发时调用 ingressKeys.agentRun.abort
```

需要一个文件内私有队列：

```ts
class AsyncEventQueue<T> {
  push(value: T): void;
  close(): void;
  fail(error: unknown): void;
  [Symbol.asyncIterator](): AsyncGenerator<T>;
}
```

事件匹配函数：

```ts
function isRunEventMatch(params: {
  event: NcpEndpointEvent;
  correlationId: string;
  sessionId: string | null;
  runId: string | null;
}): boolean;
```

匹配规则：

- 有 `payload.correlationId` 且等于本次 `correlationId`，直接匹配。
- `attachHandle` 后记录 `handle.sessionId` 和 `handle.runId`，后续允许按 `sessionId + runId` 匹配没有 `correlationId` 的事件。
- terminal 事件包括 `MessageCompleted`、`MessageFailed`、`RunError`。

`AgentRunObserver.waitForReply(...)` 消费 observer 队列，遇到：

- `MessageTextDelta`：调用 `onAssistantDelta`
- `MessageCompleted`：记录 final message
- `MessageFailed` / `RunError`：抛错

### 2. 改 `channel-reply.utils.ts`

文件：

```text
packages/nextclaw-kernel/src/features/ncp-dispatch/utils/channel-reply.utils.ts
```

参数从：

```ts
agent: NcpRunnerAgent;
```

改为：

```ts
agentRunClient: AgentRunClient;
```

`eventStream` 改为先构造 `AgentRunSendIngressPayload`，再调用 stream API：

```ts
const payload = await buildAgentRunSendPayload({
  sessionId,
  contentText: content,
  attachments,
  assetStore,
  agentId: route.agentId,
  channel: route.channel,
  metadata,
});

const eventStream = agentRunClient.sendAndStreamEvents(payload, { abortSignal, onEvent });
```

附件解析继续留在 ncp-dispatch 这一层，复用现有“文本 + attachments -> `NcpMessagePart[]`”逻辑；`AgentRunClient` 不持有 `assetStore`，避免 helper 变成渠道附件 owner。

### 3. 改 `gateway-inbound-processor.service.ts`

文件：

```text
packages/nextclaw-kernel/src/features/ncp-dispatch/services/gateway-inbound-processor.service.ts
```

`GatewayInboundLoopRuntime.kernel` 改为：

```ts
kernel: {
  channels: ChannelManager;
  ingress: Ingress;
  eventBus: EventBus;
  assetStore: AssetApi;
};
```

普通 reply 路径：

```ts
const payload = await this.buildAgentRunSendPayload({
  sessionId: route.sessionKey,
  contentText: message.content,
  attachments: message.attachments,
  agentId: route.agentId,
  channel: message.channel,
  metadata: runMetadata,
});

const result = await this.agentRunClient.sendAndWaitForReply(payload, {
  onAssistantDelta: ...,
  missingCompletedMessageError: ...,
  runErrorMessage: ...,
});
```

channel direct reply 路径：

```ts
await dispatchChannelReplyRoute({
  agentRunClient: this.agentRunClient,
  route: replyRoute,
  sessionId: route.sessionKey,
  contentText: message.content,
  attachments: message.attachments,
  assetStore: this.runtime.kernel.assetStore,
  agentId: route.agentId,
  channel: message.channel,
  metadata: runMetadata,
});
```

删除该文件对 `NcpRunnerAgent` 和 `kernel.agentRunRequestManager` 的类型依赖。

### 4. 改 `nextclaw-ncp-dispatch.utils.ts`

文件：

```text
packages/nextclaw-kernel/src/features/ncp-dispatch/utils/nextclaw-ncp-dispatch.utils.ts
```

`DirectPromptDispatchParams` 从：

```ts
agentRunRequests: NcpRunnerAgent;
```

改成：

```ts
agentRunClient: AgentRunClient;
```

调用 `agentRunClient.sendAndWaitForReply(...)`。

这里保留 slash command 逻辑，因为它属于 direct prompt 输入前置处理，不属于 agent run runtime 执行链路。

### 5. 改 cron handler

文件：

```text
packages/nextclaw-service/src/shared/services/gateway/utils/cron-job-handler.utils.ts
```

`createCronJobHandler` 参数改为：

```ts
export function createCronJobHandler(params: {
  agentRunClient: AgentRunClient;
  bus: MessageBus;
}): (job: CronJobLike) => Promise<string>
```

内部调用 `params.agentRunClient.sendAndWaitForReply(...)`。

`NextclawGatewayRuntime` 中安装 cron handler 改为：

```ts
this.automation.onJob = createCronJobHandler({
  agentRunClient: this.agentRunClient,
  bus: this.messageBus,
});
```

### 6. 改 plugin bridge

文件：

```text
packages/nextclaw-service/src/shared/services/plugin/utils/plugin-runtime-bridge.utils.ts
```

`dispatchPromptOverNcp` 调用改为：

```ts
await dispatchPromptOverNcp({
  config: gateway.configManager.loadConfig(),
  agentRunClient: gateway.agentRunClient,
  ...request,
});
```

### 7. 改 CLI runner

文件：

```text
packages/nextclaw-service/src/cli/commands/agent/cli-agent-runner.utils.ts
```

`runCliInteractiveLoop` 参数从 `agentRunRequests` 改为：

```ts
agentRunClient: AgentRunClient;
```

所有 `dispatchPromptOverNcp` 调用都改成传 `agentRunClient`。

### 8. 支持显式 sessionId create-if-missing

#### 8.1 core session input

文件：

```text
packages/nextclaw-core/src/features/session/managers/session.manager.ts
```

`CreateSessionInput` 增加：

```ts
sessionId?: string;
```

`createSession` 中：

```ts
const sessionId = readOptionalString(params.sessionId) ?? buildSessionId();
```

#### 8.2 kernel NcpSessionManager

文件：

```text
packages/nextclaw-kernel/src/managers/ncp-session.manager.ts
```

`CreateSessionInput` 已从 core 引入，解构 `sessionId`：

```ts
const {
  sessionId: requestedSessionId,
  ...
} = params;
```

然后：

```ts
const sessionId = readOptionalString(requestedSessionId) ?? buildSessionId();
```

需要确认 `importSessionSnapshot` 对指定 sessionId 已可工作；当前 journal store 会按 record.sessionId 写 metadata 和 jsonl，符合要求。

#### 8.3 branch SessionRepository

文件：

```text
packages/nextclaw-kernel/src/features/agent-run/repositories/session.repository.ts
```

`CreateAgentRunSessionParams` 增加：

```ts
sessionId?: string;
metadata?: Record<string, unknown>;
```

`createSession` 调用 `ncpSessionManager.createSession` 时传：

```ts
sessionId,
metadataOverrides: {
  ...metadata,
  agentRuntimeId,
  channel,
},
```

新增：

```ts
getOrCreateSession = async (
  params: CreateAgentRunSessionParams,
): Promise<AgentRunSession> => {
  if (!params.sessionId) {
    return await this.createSession(params);
  }
  const existing = await this.ncpSessionManager.getSessionRecord(params.sessionId);
  if (existing) {
    return await this.getSession(params.sessionId);
  }
  return await this.createSession(params);
};
```

#### 8.4 branch AgentRunRequestManager

文件：

```text
packages/nextclaw-kernel/src/features/agent-run/managers/agent-run-request.manager.ts
```

`send` 中将：

```ts
const session = request.sessionId
  ? await this.sessionRepository.getSession(request.sessionId)
  : await this.sessionRepository.createSession(...);
```

改成：

```ts
const session = await this.sessionRepository.getOrCreateSession({
  sessionId: request.sessionId,
  agentId: request.agentId,
  agentRuntimeId: request.agentRuntimeId,
  channel: request.channel,
  metadata: request.metadata,
  model: request.model,
  projectRoot: request.projectRoot,
  task: readMessageTask(request.message),
  thinkingEffort: request.thinkingEffort,
});
```

`AgentRunRequest` 类型只需要保留普通上下文 metadata，不引入 canonical metadata 类型：

```ts
metadata?: Record<string, unknown>;
```

### 9. `ingressKeys.agentRun.send` payload 到 `AgentRunRequest` 的映射

#### 9.1 branch manager 直接读 typed metadata

`toAgentRunRequest` 开头改为：

```ts
const metadata = envelope.metadata ?? {};
const requestMetadata = {
  metadata: structuredClone(metadata),
  agentRuntimeId: metadata.agentRuntimeId,
  agentId: metadata.agentId,
  projectRoot: metadata.projectRoot,
  channel: metadata.channel,
  correlationId: envelope.correlationId,
  model: metadata.model,
  maxTokens: metadata.maxTokens,
  thinkingEffort: metadata.thinkingEffort,
};
```

不要在这里再读 `metadata.runtime`、`metadata.session_type`、`metadata.agent_id`、`metadata.project_root` 等旧字段。新的调用方必须构造 typed metadata。

#### 9.2 session metadata 写入边界

`SessionRepository.createSession(...)` 可以把 request metadata 作为上下文写入 session metadata，并继续用当前明确字段覆盖 session metadata 中的标准字段：

```ts
metadataOverrides: {
  ...metadata,
  agentRuntimeId,
  agentId,
  channel,
  model,
  projectRoot,
  thinkingEffort,
}
```

这样存储里仍保留 session 展示、历史和上下文需要的 metadata；新请求的决策来源是 `AgentRunSendIngressPayload.metadata` 中的 typed 字段。

#### 9.3 旧字段处理

本方案不新增 metadata normalization 公共工具，也不把 metadata 包装成新的公开 request 类型。旧字段处理只分两类：

- 未落盘的调用方：同步改成 typed metadata 字段。
- 已落盘的历史 session：如必须兼容，放在 session 存储读取或迁移逻辑里单独处理，不进入 `ingressKeys.agentRun.send` 新合同。

## 测试计划

### 1. AgentRunClient 测试

文件建议：

```text
packages/nextclaw-kernel/src/features/ncp-dispatch/clients/agent-run.client.test.ts
```

覆盖：

- `AgentRunClient.send` 调用 `ingress.handle(ingressKeys.agentRun.send)` 并返回 handle。
- `AgentRunClient.sendAndStreamEvents` 内部先订阅事件，再通过 `Ingress` 投递 `ingressKeys.agentRun.send`，并按 `correlationId/runId/sessionId` yield `RunStarted`、`MessageTextDelta`、`MessageCompleted`。
- `AgentRunClient.sendAndWaitForReply` 内部先订阅事件，再通过 `Ingress` 投递 `ingressKeys.agentRun.send`，并返回 completed message text。
- 返回 handle 后，根据 `correlationId/runId/sessionId` yield `RunStarted`、`MessageTextDelta`、`MessageCompleted`。
- `RunError` / `MessageFailed` 转成错误。
- `abortSignal` 触发时调用 `agentRun.abort`。

### 2. gateway inbound 测试

文件建议：

```text
packages/nextclaw-kernel/src/features/ncp-dispatch/services/gateway-inbound-processor.service.test.ts
```

覆盖：

- fake 微信 inbound 进入 processor 后，调用的是 `kernel.ingress.handle(ingressKeys.agentRun.send)`。
- 不再需要 `kernel.agentRunRequestManager`。
- `MessageTextDelta` 仍发布 `createAssistantStreamDeltaControlMessage`。
- `MessageCompleted` 后仍发布 outbound reply。
- reply-capable channel 仍通过 `consumeNcpReply` 消费同一个 `AgentRunClient.sendAndStreamEvents` event stream。

### 3. branch 显式 sessionId 测试

文件：

```text
packages/nextclaw-kernel/src/features/agent-run/managers/agent-run-request.manager.test.ts
```

新增覆盖：

- `ingressKeys.agentRun.send` payload 传入 `sessionId: "agent:main:weixin:..."` 且 session 不存在时，创建该 sessionId。
- 创建出的 session metadata 使用 typed metadata 字段，不包含 `agent_id/session_type/chat_id` 等新写入副本。
- 第二次同 sessionId 发送时复用已有 session。

### 4. `AgentRunSendIngressPayload` 映射测试

文件：

```text
packages/nextclaw-kernel/src/features/agent-run/managers/agent-run-request.manager.test.ts
```

覆盖：

- `metadata.agentRuntimeId/agentId/model/maxTokens/thinkingEffort/projectRoot/channel` 进入 `AgentRunRequest`。
- `metadata.session_type/agent_id/project_root` 不参与 `AgentRunRequest` 决策。
- `metadata.chatId/accountId/senderId/sessionKey` 作为上下文可写入 session metadata。
- `buildRunMetadata` 不再新写 snake_case 副本。

### 5. service 调用方测试

更新现有：

- `cron-job-handler.utils.test.ts`
- `service-plugin-runtime-bridge.service.test.ts`
- CLI 相关测试如已有覆盖则同步断言参数。

断言重点从 “传入 agentRunRequests” 改成 “传入 AgentRunClient”。

## 实施顺序

1. 修改 `AgentRunSendIngressPayload`，把实际依赖的 metadata 字段类型化。
2. 修改 branch `AgentRunRequestManager.toAgentRunRequest`，从 typed metadata 映射到 `AgentRunRequest`。
3. 增加显式 sessionId create-if-missing 能力和测试。
4. 将 `nextclaw-ncp-runner.utils.ts` 的 direct runner 语义迁移为 `AgentRunClient`，或新增 `clients/agent-run.client.ts` 后删除旧 direct runner 类型。
5. 改造 `channel-reply.utils.ts`，先构造 `AgentRunSendIngressPayload`，再调用 `sendAndStreamEvents`。
6. 改造 `GatewayInboundProcessor`，直接通过 `AgentRunClient` 发起 typed payload。
7. 改造 cron/plugin/CLI 调用方。
8. 删除 `NcpRunnerAgent` 类型和所有 `kernel.agentRunRequestManager` 的 direct runner 调用。
9. 跑 kernel/service TypeScript 与定向测试。

## 验收标准

- 前端 `/api/ncp/agent/send` 仍保持现有行为。
- branch 模式下，gateway inbound 不再依赖 `kernel.agentRunRequestManager`。
- 微信 inbound 进入 gateway 后通过 `kernel.ingress.handle(ingressKeys.agentRun.send)` 创建或复用稳定 session key。
- channel reply 能消费同一次 run 的 `eventBus.ncpEvent` stream。
- cron/plugin/CLI 全部通过 `kernel.ingress.handle(ingressKeys.agentRun.send)` 发起 run。
- `AgentRunSendIngressPayload.metadata` 承接并类型化现有 agent-run 核心输入字段；字段位置不迁移。
- `buildRunMetadata` 不再同时输出 snake_case 和 camelCase 双份字段。
- branch manager 内部不再从 metadata 读取 legacy run 字段。
- `pnpm -C packages/nextclaw-kernel tsc` 通过。
- `pnpm -C packages/nextclaw-service tsc` 通过。
- 定向测试覆盖 `AgentRunClient`、gateway inbound、显式 sessionId 创建和 payload 字段映射。

## 待 review 问题

1. 显式 sessionId 创建是否直接扩展 `CreateSessionInput.sessionId`，还是只在 `NcpSessionManager` 层支持。推荐扩展 core 类型，因为 core `SessionManager` 已经是 session 创建合同来源。
2. `AgentRunClient` 的事件匹配是否只用 `correlationId`，还是保留 `runId` fallback。推荐两者都用：`correlationId` 是主键，`runId` 用于兼容部分 runtime event 未带 correlationId 的情况。
3. 已落盘 session metadata 里的旧字段是否需要单独 migration。推荐不进入 `ingressKeys.agentRun.send` 新合同；如有必要，作为存储迁移或 session repository 读取策略单独 review。
4. `kernel.agentRunRequestManager` 顶层字段是否本轮删除。推荐本轮先删除 direct runner 调用，不强行删除旧字段；下一步再评估 legacy chain 删除。
