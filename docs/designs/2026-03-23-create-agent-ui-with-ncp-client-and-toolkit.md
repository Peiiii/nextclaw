[我严格遵守规则] 下面是一套用 **client + toolkit** 从零搭建 agent 前端的方案，包含 UI 部分。

---

## 一、整体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  UI 层                                                                       │
│  ChatPage / ChatThread / ChatInputBar / MessageBubble / AbortButton          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↕
┌─────────────────────────────────────────────────────────────────────────────┐
│  桥接层（Session / Controller）                                               │
│  - 订阅 client 事件 → dispatch 到 state manager                             │
│  - send / resume / abort 封装                                                │
│  - 暴露 getSnapshot + subscribe 给 UI                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↕
┌──────────────────────┐    ┌──────────────────────────────────────────────┐
│  NcpHttpAgentClient  │    │  DefaultNcpAgentConversationStateManager      │
│  (transport)         │    │  (state)                                       │
│  send / resume /     │───→│  dispatch(event) → messages, streamingMessage,│
│  abort / subscribe   │    │  error, activeRun                              │
└──────────────────────┘    └────────────────────────────────────────────────┘
```

---

## 二、桥接层：AgentChatSession

在 toolkit 中提供 `createAgentChatSession`，把 client 和 state manager 连起来：

```ts
// @nextclaw/ncp-toolkit
export function createAgentChatSession(client: NcpAgentClientEndpoint) {
  const stateManager = new DefaultNcpAgentConversationStateManager();
  client.subscribe((event) => void stateManager.dispatch(event));

  return {
    send: async (envelope: NcpRequestEnvelope) => {
      stateManager.dispatch({ type: "message.request", payload: envelope });
      await client.send(envelope);
    },
    resume: async (payload: NcpResumeRequestPayload) => {
      await client.resume(payload);
    },
    abort: async (payload?: NcpMessageAbortPayload) => {
      await client.abort(payload);
    },
    getSnapshot: () => stateManager.getSnapshot(),
    subscribe: (fn: (s: NcpAgentConversationSnapshot) => void) => stateManager.subscribe(fn),
  };
}
```

职责：  
- 把 client 的 `NcpEndpointEvent` 全部 dispatch 到 state manager  
- 在 `send` 时先 dispatch `message.request`，再调用 `client.send`  
- 对外只暴露 `send / resume / abort` 和 `getSnapshot / subscribe`

---

## 三、React 集成

### 3.1 useAgentChatSession

```ts
function useAgentChatSession(baseUrl: string) {
  const sessionRef = useRef<ReturnType<typeof createAgentChatSession> | null>(null);
  if (!sessionRef.current) {
    const client = new NcpHttpAgentClientEndpoint({ baseUrl });
    client.start();
    sessionRef.current = createAgentChatSession(client);
  }

  const [snapshot, setSnapshot] = useState(() => sessionRef.current!.getSnapshot());
  useEffect(() => {
    return sessionRef.current!.subscribe(setSnapshot);
  }, []);

  return {
    snapshot,
    send: sessionRef.current!.send,
    resume: sessionRef.current!.resume,
    abort: sessionRef.current!.abort,
  };
}
```

### 3.2 或 useSyncExternalStore（更符合 React 18）

```ts
function useAgentChatSnapshot(session: ReturnType<typeof createAgentChatSession>) {
  return useSyncExternalStore(
    (cb) => session.subscribe(cb),
    () => session.getSnapshot(),
    () => session.getSnapshot()
  );
}
```

---

## 四、UI 组件结构

### 4.1 页面结构

```
ChatPage
├── ChatSidebar（可选：session 列表）
├── ChatMain
│   ├── ChatThread（消息列表）
│   │   └── MessageBubble[]（每条 NcpMessage）
│   └── ChatInputBar（输入 + 发送 + 停止）
```

### 4.2 数据流

| 组件 | 数据来源 | 行为 |
|------|----------|------|
| ChatThread | snapshot.messages + snapshot.streamingMessage | 渲染消息列表，流式消息单独展示 |
| ChatInputBar | - | 输入文本，调用 session.send(envelope) |
| AbortButton | snapshot.activeRun | activeRun 存在时显示，点击调用 session.abort() |
| ErrorBanner | snapshot.error | 有 error 时展示 |

### 4.3 NcpMessage → UI 渲染

`NcpMessage` 含 `parts: NcpMessagePart[]`，类型包括：

- text  
- reasoning  
- tool-invocation  
- file / source / card / action 等  

每个 `MessageBubble` 根据 `part.type` 选择对应子组件（TextPart、ReasoningPart、ToolInvocationPart 等）。

---

## 五、Send 流程

1. 用户输入文本，点击发送  
2. 构造 `NcpRequestEnvelope`：  
   - sessionId：当前 session（新建或已有）  
   - message：`{ id, sessionId, role: "user", status: "final", parts: [{ type: "text", text }] }`  
   - correlationId：可选，用于关联请求  
3. 调用 `session.send(envelope)`  
4. state manager 先处理 `message.request`，把 user 消息加入 messages  
5. client 发 HTTP，收到 SSE 事件  
6. client 把事件发给 state manager，更新 streamingMessage / messages / error / activeRun  
7. UI 通过 subscribe 拿到新 snapshot 并重渲染  

---

## 六、Resume 流程（断线重连）

1. 用户刷新或重连后，知道 `sessionId` 和 `remoteRunId`  
2. 调用 `session.resume({ sessionId, remoteRunId, fromEventIndex? })`  
3. client 发 GET `/reconnect?sessionId=...&remoteRunId=...`  
4. 服务端回放或继续流式返回事件  
5. 事件经 client → state manager，UI 通过 snapshot 展示  

---

## 七、Abort 流程

1. 流式回复进行中，`snapshot.activeRun` 非空  
2. 用户点击停止  
3. 调用 `session.abort({ runId: activeRun.runId })` 或 `session.abort()`  
4. client 发 POST `/abort`  
5. 收到 `message.abort` 或 `run.finished` 等，state manager 更新，activeRun 清空  

---

## 八、Session 管理（可选）

- 单 session：一个 client 对应一个 sessionId，简单场景足够  
- 多 session：每个 session 一个 client + state manager，或一个 client 多 sessionId，由业务决定  

---

## 九、文件结构建议

```
packages/nextclaw-ncp-toolkit/
  src/
    agent/
      agent-conversation-state-manager.ts  (已有)
      create-agent-chat-session.ts         (新增)
    index.ts

apps/agent-chat-ui/  或  packages/nextclaw-chat-ui/
  src/
    hooks/
      useAgentChatSession.ts
      useAgentChatSnapshot.ts
    components/
      ChatPage.tsx
      ChatThread.tsx
      ChatInputBar.tsx
      MessageBubble.tsx
      MessagePartRenderer.tsx   (text / reasoning / tool-invocation)
      AbortButton.tsx
      ErrorBanner.tsx
```

---

## 十、总结

| 层级 | 职责 |
|------|------|
| Client | HTTP/SSE 传输，send/resume/abort，事件推送 |
| State Manager | 消费事件，维护 messages / streamingMessage / error / activeRun |
| createAgentChatSession | 桥接 client 与 state manager，统一对外 API |
| useAgentChatSession / useAgentChatSnapshot | React 绑定 snapshot |
| UI 组件 | 根据 snapshot 渲染，调用 session.send/resume/abort |

这样一套方案，可以完全基于 client + toolkit 搭建 agent 前端，不依赖现有 Nextbot UI。