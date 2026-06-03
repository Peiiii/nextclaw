# NCP 当前会话 Live Stream 恢复设计

## 背景

用户在会话中执行 `gateway restart` 后，前端会短暂出现 `network error`。后端恢复后，再发送消息可能可以成功提交，但当前页面没有收到 assistant 回复；重新进入同一个会话后，又能看到回复已经存在。

这说明问题不是单纯的发送失败，也不是消息丢失，而是：

- `send` 链路在 runtime 恢复后可以重新成功；
- 当前会话的 live stream 在 restart 中断后没有可靠恢复；
- 断线期间已经落库的消息没有被当前页面 reconcile 回来。

这类能力直接关系到 NextClaw 作为长期工作台的连续性。按照产品愿景，它不是一个局部 UI 补丁，而是在增强系统对当前会话、运行状态和历史结果的自感知连续性。

## 当前证据

已读到的关键链路：

- `NcpChatPage` 发送消息调用 `agent.send(envelope)`；发送已有会话时并不会自动重开 stream。
- `useHydratedNcpAgent` 初次 hydrate 会 `loadSeed(sessionId)`，随后调用 `client.stream({ sessionId })`。
- `NcpHttpAgentClientEndpoint.stream()` 使用 SSE `/api/ncp/agent/stream?sessionId=...`，流失败后 publish `EndpointError` 并 throw。
- 服务端 `createNcpSessionEventStreamResponse()` 只是监听当前进程 `eventBus` 并转成 SSE，不是可回放日志。
- `useNcpSessionConversation` 只对 `ncp agent unavailable during startup` 做 ready 后 retry；对“已有本地 session state，但 live stream 已断”没有恢复策略。

阶段性结论：

当前问题的直接触发点是 restart 关闭了已有 SSE 连接。结构性根因是当前会话 live stream 没有独立生命周期 owner，也没有断线后的 `reopen stream + history reconcile` 机制。

## 目标

- 当前会话 live stream 因 restart / network error 中断后，runtime ready 时能自动恢复。
- 恢复时先做一次 history reconcile，补齐断线期间已经落库的消息。
- 保持 `send` 简单：发送只提交用户意图，不承担接收流恢复。
- 复用现有 `systemStatus` readiness 信号，不让 chat 自己探测 runtime。
- 把重连节奏做成可配置策略，不把 backoff 公式散落进 hook。
- 短期不改服务端协议，不要求 event replay / cursor。

## 非目标

- 不在 `POST /send` 上做透明自动 retry。没有幂等合同前，自动重试可能重复创建用户消息和 agent run。
- 不尝试识别断线到底是不是 restart。前端只能可靠识别“连接失败 / runtime 尚未 ready / runtime ready”。
- 不在本轮引入 session revision、stream cursor 或服务端事件回放。
- 不把恢复逻辑塞进 `NcpChatPage`、输入框、发送按钮或 presenter action。

## 设计原则

命中的原则：

- `information-expert`：live stream 的连接、失败、重连和补洞状态应归 stream 生命周期 owner。
- `complete-owner`：owner 必须覆盖 `open / close / reconnect / reconcile / dispose` 闭环，而不是只包装一次 `client.stream()`。
- `single-domain-owner`：当前会话实时接收恢复只能有一个事实 owner，避免页面、send、hydrate 各自补一段。
- `abstraction-calibration`：短期只抽出 live stream 恢复 owner；不提前引入完整 event cursor 协议。
- `request-bus-decoupling`：send 只发请求，输出仍通过既有 NCP event stream 和历史接口回到 manager。

## 推荐短期方案

新增一个当前会话 live stream owner，暂定名：

```text
NcpSessionLiveStreamController
```

它只负责一个 `sessionId` 的 live stream 生命周期：

- 第一次进入会话后打开 stream；
- stream 断开后记录 `disconnected`；
- 等待 runtime ready；
- ready 后按 cadence 重试恢复；
- 每次恢复前做 history reconcile；
- session 切换或组件卸载时 dispose。

它不负责：

- 发送消息；
- 决定输入框是否 disabled；
- 自己 ping runtime；
- 修改服务端存储；
- 解释 provider / model / tool 业务。

## 代码组织

短期建议落在 `@nextclaw/ncp-react`，因为它已经拥有 `useHydratedNcpAgent`、`useNcpAgentRuntime` 和 conversation manager 的组合权。

建议新增：

```text
packages/ncp-packages/nextclaw-ncp-react/src/live-stream/ncp-session-live-stream-controller.ts
packages/ncp-packages/nextclaw-ncp-react/src/live-stream/ncp-session-history-reconciler.ts
packages/ncp-packages/nextclaw-ncp-react/src/live-stream/ncp-live-stream-cadence.ts
packages/ncp-packages/nextclaw-ncp-react/src/live-stream/index.ts
```

`useHydratedNcpAgent` 负责创建和驱动这个 controller，但不直接写重连细节。

UI 侧 `useNcpSessionConversation` 只把 runtime gate 传进去：

```ts
const runtimeGate = {
  canConnect: systemStatus.phase === "ready",
  readyEpoch: systemStatus.lastReadyAt ?? null,
};

const agent = useHydratedNcpAgent({
  sessionId,
  client,
  loadSeed,
  runtimeGate,
});
```

这样 `ncp-react` 不依赖 `system-status`，只消费业务无关的 gate。

## Controller 接口草案

```ts
type NcpLiveStreamRuntimeGate = {
  canConnect: boolean;
  readyEpoch: string | number | null;
};

type NcpSessionLiveStreamControllerOptions = {
  client: NcpAgentClientEndpoint;
  manager: DefaultNcpAgentConversationStateManager;
  loadSeed: NcpConversationSeedLoader;
  cadence?: NcpLiveStreamCadence;
};

class NcpSessionLiveStreamController {
  setSession(sessionId: string | undefined): void;
  setRuntimeGate(gate: NcpLiveStreamRuntimeGate): void;
  hydrateInitialSession(): Promise<void>;
  recoverNow(reason: "runtime-ready" | "stream-error" | "manual"): void;
  dispose(): void;
}
```

实现上不一定暴露完整 class 给 React 外部。也可以由 hook 内部持有 class 实例，只把结果映射为 `hydrateError / isHydrating / streamState`。

## 重新打开 stream

重开 stream 的关键不是在页面里直接调用 `streamRun()`，而是让 controller 持有一个 generation：

```ts
private generation = 0;

private reconnect = async (reason: ReconnectReason): Promise<void> => {
  const sessionId = this.sessionId;
  if (!sessionId || !this.runtimeGate.canConnect) {
    this.pendingRecovery = true;
    return;
  }

  const generation = ++this.generation;
  this.state = "connecting";

  await this.reconcileHistory(sessionId, generation);
  if (!this.isCurrent(generation, sessionId)) return;

  try {
    await this.openStream(sessionId, generation);
  } catch (error) {
    if (!this.isCurrent(generation, sessionId)) return;
    this.handleStreamFailure(error);
  }
};
```

短期可以继续用现有 `client.stop()` 关闭旧 stream，但这是需要注意的债务：它会 abort client 上所有 active controllers。更优雅的收敛方向是给 `NcpHttpAgentClientEndpoint` 增加 stream-scoped lifecycle，例如：

```ts
stream(payload): Promise<NcpStreamHandle>
```

或者内部维护 `activeStreamController`，重开 stream 时只 abort 旧 stream，不影响 send / abort 请求。

短期若不先改 client 合同，controller 调用 `client.stop()` 的时机必须非常克制：只在 session 切换、dispose、初次 hydrate 前清旧 stream，不在发送过程中随意 stop。

## 等待 runtime ready

controller 不直接依赖 `SystemStatusManager`。它只消费：

```ts
canConnect = systemStatus.phase === "ready"
readyEpoch = systemStatus.lastReadyAt
```

状态规则：

- stream 失败时，如果 `canConnect === false`，不立刻请求，设置 `pendingRecovery = true`。
- 当 `canConnect` 从 false 变 true，或 `readyEpoch` 变化，若 `pendingRecovery === true`，立即执行一次 `recoverNow("runtime-ready")`。
- 如果 ready 后 stream 仍失败，进入 cadence retry。
- 如果 sessionId 改变，旧 generation 失效，旧 stream 事件和失败回调都不能再影响新 session。
- 如果 dispose，停止 timer、abort 旧 stream、忽略所有 pending promise。

伪代码：

```ts
setRuntimeGate(gate) {
  const becameReady =
    !this.runtimeGate.canConnect && gate.canConnect;
  const readyEpochChanged =
    this.runtimeGate.readyEpoch !== gate.readyEpoch;

  this.runtimeGate = gate;

  if (gate.canConnect && this.pendingRecovery && (becameReady || readyEpochChanged)) {
    this.pendingRecovery = false;
    this.cadence.reset();
    this.recoverNow("runtime-ready");
  }
}
```

## History Reconcile

短期 reconcile 以服务端历史接口为事实源，因为重新进入会话能看到回复，说明消息已经落库。

流程：

```ts
private reconcileHistory = async (
  sessionId: string,
  generation: number,
): Promise<void> => {
  const seed = await this.loadSeed(sessionId, this.createAbortSignal(generation));
  if (!this.isCurrent(generation, sessionId)) return;

  const current = this.manager.getSnapshot();
  const reconciled = reconcileNcpSessionHistory({
    sessionId,
    localMessages: current.messages,
    localStreamingMessage: current.streamingMessage,
    remoteMessages: seed.messages,
    remoteStatus: seed.status,
  });

  this.manager.hydrate({
    sessionId,
    messages: reconciled.messages,
    activeRun: seed.status === "running"
      ? { sessionId, runId: null, abortDisabledReason: null }
      : null,
  });
};
```

`reconcileNcpSessionHistory()` 是纯函数，便于单测。

合并规则：

1. 以 `message.id` 为主键。
2. 远端已有的消息以远端为准。
3. 本地 optimistic user message 如果远端没有同 id，短期保留在结果末尾，避免用户刚发出但 history 尚未刷新时闪没。
4. 本地 `streamingMessage` 如果远端已有同 id final message，丢弃 streaming，使用远端 final。
5. 本地 `streamingMessage` 如果远端没有同 id：
   - `remoteStatus === "running"` 时可以保留；
   - `remoteStatus === "idle"` 时丢弃，避免卡住“正在回复”。
6. 输出按 timestamp 稳定排序；timestamp 缺失时保持远端顺序，本地补充消息追加在后。
7. `remoteStatus === "idle"` 时清空 activeRun；`running` 时恢复 placeholder activeRun。

纯函数草案：

```ts
type ReconcileInput = {
  sessionId: string;
  localMessages: readonly NcpMessage[];
  localStreamingMessage: NcpMessage | null;
  remoteMessages: readonly NcpMessage[];
  remoteStatus: "idle" | "running";
};

function reconcileNcpSessionHistory(input: ReconcileInput): {
  messages: readonly NcpMessage[];
} {
  const remoteById = new Map(input.remoteMessages.map((message) => [message.id, message]));
  const next = [...input.remoteMessages];

  for (const message of input.localMessages) {
    if (remoteById.has(message.id)) continue;
    if (message.role === "user") next.push(message);
  }

  const streaming = input.localStreamingMessage;
  if (
    streaming &&
    !remoteById.has(streaming.id) &&
    input.remoteStatus === "running"
  ) {
    next.push(streaming);
  }

  return { messages: stableSortMessages(next) };
}
```

## 已知短期缝隙

短期方案有一个理论 race：

```text
load history 完成 -> open stream 成功
```

这两个动作之间如果刚好产生新事件，事件可能不会通过旧 history 或新 stream 捕获。

对当前 restart 场景，短期方案仍然能显著修复，因为断线期间的 assistant 回复已经落库，recover 时会被 history 拉回。要完全关闭 race，需要长期方案：session revision / cursor。

## 长期演进方向

长期应让历史接口和 stream 接口支持 cursor：

```ts
GET /api/ncp/sessions/:sessionId/messages -> { messages, status, revision }
GET /api/ncp/agent/stream?sessionId=...&afterRevision=...
```

每个事件带 revision。客户端记录 `lastSeenRevision`，重连时先从 `afterRevision` 补事件，再进入 live stream。这样才能做到严格无缝恢复。

短期实现时不要伪造 cursor，也不要在客户端用 timestamp 猜事件边界。timestamp 只能用于展示排序，不应用作协议级恢复合同。

## 测试计划

单测：

- `reconcileNcpSessionHistory`：
  - 远端 final assistant 覆盖本地 streaming；
  - 远端缺失 optimistic user 时保留；
  - `remoteStatus=idle` 清理 streaming；
  - `remoteStatus=running` 保留 streaming 并恢复 activeRun；
  - 重复 message id 不重复渲染。
- `NcpSessionLiveStreamController`：
  - stream error 后 runtime 未 ready 不请求；
  - runtime ready epoch 变化后立即 recover；
  - recover 前先调用 `loadSeed`，再打开 stream；
  - session 切换后旧 generation 的错误不污染新 session；
  - dispose 后 timer 和 pending promise 不再更新状态。
- `useHydratedNcpAgent`：
  - 初次 hydrate 后打开 stream；
  - 已有 session state 但 stream error 后，ready 时仍会 reconcile + reopen；
  - send 成功但 live stream 曾断时，恢复后消息从 history 补回。

定向功能验证：

1. 启动本地 source runtime。
2. 打开一个已有会话。
3. 执行 `gateway restart` 或 `pnpm local:runtime:restart`。
4. 等 runtime 恢复 ready。
5. 在同一页面发送消息。
6. 验证当前页面无需重新进入会话，也能显示 assistant 回复。
7. 验证重新进入会话后没有重复消息。

## 验收标准

- restart 断线后，当前会话页能自动恢复接收能力。
- 断线期间已经落库的回复能补回当前页面。
- 不发生重复 user / assistant message。
- 发送按钮和发送链路没有引入透明 POST retry。
- runtime readiness 仍由 `systemStatus` 提供，chat 不新增独立 ping。
- 重连节奏通过可配置 cadence 控制，长期失败不会固定高频请求。
- 当前实现清楚标注短期 race，未来 cursor/revision 有明确升级路径。
