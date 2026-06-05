# Panel App Bridge API Reference

Panel App 只能通过宿主注入的 `window.nextclaw` 与 NextClaw 交互。不要直接请求 NextClaw gateway、不要伪造 caller、不要保存 bridge token。

## Manifest 声明

所有 NextClaw 能力都必须写在 `panel-app.json`：

```json
{
  "title": "示例应用",
  "entry": "index.html",
  "capabilities": ["agent:generateObject"],
  "actions": ["workspace-files.list"],
  "client": true
}
```

- `actions` 使用 Service action id：`<service-app-id>.<tool-name>`。
- `capabilities` 使用 Agent capability：`agent:send`、`agent:generateObject`。
- 需要标准 NextClaw App Client 能力时写 `client: true`；新应用如果已经启用 App Client，可以通过 `window.nextclaw.client` 调用 agentRuns、sessions、assets、events 等标准能力。
- Service Actions 当前仍推荐使用 `actions` 对应的旧 bridge `window.nextclaw.serviceActions.*`，因为它包含 Panel App 授权确认和自动 retry 体验。
- 未启用 App Client 的轻量应用或旧应用，仍可使用 `actions` / `capabilities` 对应的旧 bridge。
- 不要在 HTML meta 中写 NextClaw manifest。

## Service Actions

### list

Panel App 当前推荐直接使用旧 bridge：

```js
const actions = await window.nextclaw.serviceActions.list();
```

返回值是数组：

```js
[
  {
    id: "workspace-files.list",
    appId: "workspace-files",
    name: "list",
    title: "List files",
    description: "List workspace files.",
    risk: "read"
  }
]
```

不要写 `const actions = response.actions`。

### invoke

```js
const payload = await window.nextclaw.serviceActions.invoke("workspace-files.list", {
  dir: "notes"
});
```

返回值是 action 的业务 payload：

```js
const files = payload.files ?? [];
```

不要写 `response.result`，也不要处理 MCP `content` envelope。宿主会把常见 MCP result 解包成业务 payload：

- `structuredContent` -> 直接返回。
- 单条 text content 且内容是 JSON -> 解析后返回对象。
- 单条 text content 且不是 JSON -> 返回字符串。

## Agent

新应用如果已经启用 App Client，触发标准 Agent Run 可以使用 `window.nextclaw.client.agentRuns.*`。本节旧 Agent bridge 主要用于未启用 App Client 的轻量应用，或需要 `generateObject()` 这类便利层的场景。

### generateObject

用于 AI 分析、总结、分类、生成结构化 UI 状态。

```js
const result = await window.nextclaw.agent.generateObject({
  peerId: "mood-analysis",
  prompt: "分析这些心情记录，返回总结和建议。",
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

返回值就是结构化对象本身，不是字符串，也不是 `{ result }`。

稳定会话使用 `peerId`。不要自己生成、缓存或猜测稳定 `sessionId`。

### send

用于只触发 Agent 会话，不等待结构化结果。

```js
await window.nextclaw.agent.send({
  peerId: "daily-review",
  content: [{ type: "text", text: "请基于当前数据继续分析。" }]
});
```

## Client SDK

当 `panel-app.json` 声明 `"client": true` 并经用户整体授权后，宿主会同步注入：

```js
const client = window.nextclaw.client;
```

`client` 是已初始化的 `NextClawAppClient` projection，不是完整底层 `NextClawClient`。Panel App 可以选择直接写 `window.nextclaw.client.sessions.list()`，也可以先赋值：

```js
const client = window.nextclaw?.client;
if (!client) {
  throw new Error("NextClaw Client SDK 未授权或不可用。");
}

const sessions = await client.sessions.list();
```

新代码需要标准 NextClaw 能力时，可以从这个 `client` 入口开始：`client.agentRuns.*`、`client.sessions.*`、`client.assets.*`、`client.events.*`。Service Actions 当前仍推荐走旧 bridge `window.nextclaw.serviceActions.*`。不要在 Panel App 中保存 token、自己构造 auth header 或重新初始化宿主注入的 client。

需要接口形状时，从已安装的 `@nextclaw/client-sdk` 包声明入口查 `NextClawAppClient`；不要凭记忆假设 `config`、`runtimeControl`、`panelApps`、`serviceApps` 等 host/admin namespace 存在于 `window.nextclaw.client`。

不要把 Client SDK 的 API schema 写死在本 reference 中。需要接口形状时，从用户机器已安装的 NPM 包解析 `@nextclaw/client-sdk`：

- 查看 package exports 或 `require.resolve("@nextclaw/client-sdk")` 定位包。
- 优先读取包声明文件，例如 `dist/index.d.ts` 或 exports 中的 `types` 入口。
- 找不到包或声明文件时，明确提示当前安装缺少 Client SDK 类型产物，不要凭空猜接口。

## 边界判断

- 标准 NextClaw 客户端能力：声明 `client: true`，授权后可以用 `window.nextclaw.client`。
- 标准 Agent Run：可以用 `client.agentRuns.send()` 和 `client.agentRuns.abort()`。
- **流式 Agent 回复**：`client.agentRuns.stream()` 在 Panel App 中会抛错（host 已有 transport，无法再开一个）。需要流式输出时，改用 `client.events.subscribe()` 监听实时事件，配合 `client.agentRuns.send()` 触发 run。

  **事件类型与 payload 结构**（NcpEndpointEvent）：

  | 事件类型 | payload 字段 | 说明 |
  |---|---|---|
  | `text.start` | `{ sessionId, messageId }` | 文本段开始 |
  | `text.delta` | `{ sessionId, messageId, delta }` | 文本增量追加 |
  | `text.end` | `{ sessionId, messageId }` | 文本段结束 |
  | `reasoning.start` | `{ sessionId, messageId }` | 思考过程段开始 |
  | `reasoning.delta` | `{ sessionId, messageId, delta }` | 思考过程增量 |
  | `reasoning.end` | `{ sessionId, messageId }` | 思考过程段结束 |
  | `message.completed` | `{ sessionId, message }` | 回复完成（`message.parts` 含 text/reasoning） |
  | `message.failed` | `{ sessionId, messageId?, error }` | 回复失败 |
  | `run.metadata` | `{ sessionId, metadata }` | 运行元数据（`metadata.kind === 'ready'` 表示开始流式） |
  | `connection.open` | — | WebSocket 连接建立 |
  | `connection.error` | — | 连接异常 |
  | `connection.close` | — | 连接断开 |

  **完整流式示例**：
  ```js
  // 1. 订阅实时事件
  const unsub = client.events.subscribe((event) => {
    // 连接事件
    if (event.type === 'connection.open') { /* 连接恢复 */ }
    if (event.type === 'connection.error') { /* 连接异常 */ }
    // 只处理当前会话的事件
    if (event.payload?.sessionId !== currentSessionId) return;
    switch (event.type) {
      case 'text.start': {
        segments[event.payload.messageId] = '';
        break;
      }
      case 'text.delta': {
        const mid = event.payload.messageId;
        if (segments[mid] !== undefined) {
          segments[mid] += event.payload.delta;
          // 合并所有段落并渲染
          renderedText = Object.values(segments).join('');
        }
        break;
      }
      case 'reasoning.delta': {
        const mid = event.payload.messageId;
        if (rSegments[mid] !== undefined) {
          rSegments[mid] += event.payload.delta;
          renderedReasoning = Object.values(rSegments).join('');
        }
        break;
      }
      case 'message.completed': {
        const msg = event.payload.message;
        if (msg) {
          // msg.parts: [{ type: 'text', text: '...' }, { type: 'reasoning', text: '...' }]
        }
        finalize();
        break;
      }
      case 'message.failed': {
        showError(event.payload.error?.message || '未知错误');
        finalize();
        break;
      }
      case 'run.metadata': {
        if (event.payload.metadata?.kind === 'ready') { /* 流式开始 */ }
        break;
      }
    }
  });

  // 2. 触发 run
  const handle = await client.agentRuns.send({
    peerId: "my-panel-app",          // 稳定 peerId，由系统创建/复用会话
    content: [{ type: 'text', text }],
    metadata: { agentId: selectedAgentId }
  });
  const currentSessionId = handle.sessionId;

  // 3. 等待流完成后取消订阅
  // message.completed 或 message.failed 触发后调用 unsub()
  ```

  **关键注意事项**：
  - 事件类型使用 `text.delta`（不是 `message.content-delta`），payload 在 `event.payload` 内。
  - 一次回复可能包含多个 `text.start/delta/end` 段（多个 `messageId`），需要用 `_segments` 对象按 `messageId` 分别累积再合并。
  - `reasoning` 和 `text` 是独立的事件流，分别追踪。
  - 中止生成：`await client.agentRuns.abort({ sessionId })`。
  - 安全超时：建议 3 分钟后自动 finalize，防止事件丢失导致永久卡住。
  - 使用 `peerId`（不是手动缓存 sessionId）来保持会话稳定；首次 send 会自动创建会话，后续 send 复用。
- Service App action：当前推荐用 `window.nextclaw.serviceActions.*`，不要默认替换成 `client.serviceActions.*`。
- AI 结构化便利层：只有明确需要旧 bridge 的 `generateObject()` 时才用 `window.nextclaw.agent.generateObject()`。
- 本地文件、外部 API、本地命令、权限动作：能力本身仍由 Service App action 提供。
- 不要默认在 Service App 中自建模型调用。除非用户明确要求外部模型服务，否则 AI 能力走 NextClaw Agent。
