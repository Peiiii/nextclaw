# NCP 应用：前后端 Agent 对话示例

下面是一个**前端 ↔ 后端**的 Agent 场景：浏览器发一条用户消息，后端跑 Agent（流式），用 NCP 事件通过 SSE 推回前端，前端按事件更新 UI。

约定：

- **后端**：提供 `POST /api/chat`（body 为本次请求）+ `GET /api/chat/stream?sessionId=...`（SSE，同一次对话的 accepted/text-delta/completed/failed 等事件）。
- **协议**：请求/响应都走 NCP 事件；SSE 里每行一个 JSON，对应一个 `NcpEndpointEvent`。事件类型与 payload 定义在 `src/types/events.ts`，与 agent-chat 对齐（含 `message.text-*` / `message.reasoning-*` / `message.tool-call-*` / `run.*`）。
- **后端**：持有一个 `NcpEndpoint`，收到 HTTP 请求时把 body 转成 `message.request` 注入端点（broadcast），端点的一个订阅者跑 Agent 并 broadcast accepted/delta/completed，另一个订阅者把事件写到 SSE 响应里。

---

## 1. 后端：Agent 端点 + HTTP/SSE

后端有一个实现 `NcpAgentServerEndpoint` 的端点，用 `broadcast` 注入请求，用 `emit` 把事件推给所有订阅者（其中一个是 SSE 写出器）。

```typescript
// ---------- 后端：Server 端 NCP 端点 ----------
import {
  type NcpAgentServerEndpoint,
  type NcpEndpointEvent,
  type NcpEndpointManifest,
  type NcpEndpointSubscriber,
  type NcpRequestEnvelope,
  type NcpMessage,
  type NcpError,
} from "@nextclaw/ncp";

export class ServerAgentEndpoint implements NcpAgentServerEndpoint {
  readonly manifest: NcpEndpointManifest & { endpointKind: "agent" } = {
    endpointId: "server-agent",
    endpointKind: "agent",
    version: "0.1.0",
    supportsStreaming: true,
    supportsAbort: true,
    supportsProactiveMessages: false,
    supportsSessionResume: false,
    supportedPartTypes: ["text"],
    expectedLatency: "seconds",
  };

  private started = false;
  private readonly listeners = new Set<NcpEndpointSubscriber>();

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.started = false;
  }

  async emit(event: NcpEndpointEvent): Promise<void> {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  subscribe(listener: NcpEndpointSubscriber): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** HTTP 层收到 POST body 后调用，把前端请求注入为 message.request */
  injectRequest(envelope: NcpRequestEnvelope): void {
    this.emit({ type: "message.request", payload: envelope });
  }
}
```

后端在启动时创建端点、挂两个订阅者：一个跑 Agent 并 broadcast 结果，一个把事件写成 SSE。

```typescript
// ---------- 后端：订阅者 1 — 跑 Agent 并 broadcast accepted/text-*/completed/failed ----------
function subscribeAgentRunner(
  endpoint: ServerAgentEndpoint,
  runAgent: (message: NcpMessage) => AsyncIterable<string>,
) {
  endpoint.subscribe(async (event) => {
    if (event.type !== "message.request") return;
    const { payload } = event;
    const messageId = `msg-${Date.now()}`;
    const { sessionId, correlationId } = payload;

    endpoint.emit({
      type: "message.accepted",
      payload: { messageId, correlationId },
    });

    try {
      endpoint.emit({
        type: "message.text-start",
        payload: { sessionId, messageId },
      });
      let fullText = "";
      for await (const chunk of runAgent(payload.message)) {
        fullText += chunk;
        endpoint.emit({
          type: "message.text-delta",
          payload: { sessionId, messageId, delta: chunk },
        });
      }
      endpoint.emit({
        type: "message.text-end",
        payload: { sessionId, messageId },
      });
      const reply: NcpMessage = {
        id: messageId,
        sessionId,
        role: "assistant",
        status: "final",
        parts: [{ type: "text", text: fullText }],
        timestamp: new Date().toISOString(),
      };
      endpoint.emit({
        type: "message.completed",
        payload: { sessionId, message: reply, correlationId },
      });
    } catch (err) {
      endpoint.emit({
        type: "message.failed",
        payload: {
          sessionId,
          messageId,
          error: toNcpError(err),
          correlationId,
        },
      });
    }
  });
}

function toNcpError(err: unknown): NcpError {
  const message = err instanceof Error ? err.message : String(err);
  return { code: "runtime-error", message, details: {} };
}
```

```typescript
// ---------- 后端：订阅者 2 — 按 sessionId 把事件只写给当前请求的 SSE res ----------
const sseBySession = new Map<string, NodeJS.WritableStream>();

function subscribeSseWriter(endpoint: ServerAgentEndpoint): void {
  endpoint.subscribe((event) => {
    const sessionId = "sessionId" in event.payload ? event.payload.sessionId : null;
    if (!sessionId) return;
    const out = sseBySession.get(sessionId);
    if (out && "write" in out) (out as NodeJS.WritableStream).write(`data: ${JSON.stringify(event)}\n\n`);
  });
}

// ---------- 后端：HTTP 路由（Node 原生 http） ----------
import http from "node:http";

const endpoint = new ServerAgentEndpoint();

subscribeAgentRunner(endpoint, async function* runAgent(message) {
  const text = message.parts.find((p) => p.type === "text");
  const userText = text?.type === "text" ? text.text : "";
  yield "Echo: ";
  yield userText;
});
subscribeSseWriter(endpoint);

await endpoint.start();

http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/chat") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const envelope = JSON.parse(body) as NcpRequestEnvelope;
      const sessionId = envelope.sessionId;
      sseBySession.set(sessionId, res);
      res.on("close", () => sseBySession.delete(sessionId));
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.flushHeaders?.();
      endpoint.injectRequest(envelope);
    });
  }
}).listen(3000);
```

`endpoint.ready` 等事件没有 `sessionId`，可按需在订阅里忽略或单独广播给所有已连接的 res。

---

## 2. 前端：发 POST + 读 SSE，按 NCP 事件更新 UI

前端发一条用户消息（POST body = NcpRequestEnvelope），然后读同一次请求返回的 SSE 流（或另开 GET stream 并带 sessionId），解析为 NCP 事件，根据 `message.accepted` / `message.text-*` / `message.completed` / `message.failed` 等更新界面。

```typescript
// ---------- 前端：构建请求并发送，消费 SSE 流里的 NCP 事件 ----------
import type {
  NcpEndpointEvent,
  NcpRequestEnvelope,
  NcpMessage,
} from "@nextclaw/ncp";

async function sendMessage(sessionId: string, userText: string): Promise<void> {
  const correlationId = `req-${Date.now()}`;
  const envelope: NcpRequestEnvelope = {
    sessionId,
    message: {
      id: `user-${Date.now()}`,
      sessionId,
      role: "user",
      status: "final",
      parts: [{ type: "text", text: userText }],
      timestamp: new Date().toISOString(),
    },
    correlationId,
  };

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(envelope),
  });

  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const event = JSON.parse(line.slice(6)) as NcpEndpointEvent;
        handleNcpEvent(event);
      }
    }
  }
}

function handleNcpEvent(event: NcpEndpointEvent): void {
  switch (event.type) {
    case "message.accepted":
      console.log("Accepted", event.payload.messageId);
      break;
    case "message.text-start":
      startAssistantMessage(event.payload.messageId);
      break;
    case "message.text-delta":
      appendToAssistantMessage(event.payload.delta);
      break;
    case "message.text-end":
      break;
    case "message.completed":
      setAssistantMessageFinal(event.payload.message);
      break;
    case "message.failed":
      showError(event.payload.error.message);
      break;
    default:
      break;
  }
}

function startAssistantMessage(_messageId: string): void {
  document.getElementById("assistant-text").textContent = "";
}
function appendToAssistantMessage(delta: string): void {
  document.getElementById("assistant-text").textContent += delta;
}
function setAssistantMessageFinal(message: NcpMessage): void {
  const text = message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("");
  document.getElementById("assistant-text").textContent = text;
}
function showError(msg: string): void {
  document.getElementById("error").textContent = msg;
}
```

---

## 3. 小结

| 角色 | 做什么 |
|------|--------|
| **后端** | 持有一个 `ServerAgentEndpoint`（实现 `NcpAgentServerEndpoint`），`injectRequest(envelope)` 把 POST body 转成 `message.request` 并 emit；一个订阅者跑 Agent 并 `emit` accepted/delta/completed/failed，另一个订阅者把事件写成 SSE 发给前端。 |
| **前端** | POST 发送 `NcpRequestEnvelope`，读取响应 body 为 SSE 流，按行解析 JSON 得到 `NcpEndpointEvent`，根据 `message.accepted` / `message.text-*` / `message.completed` / `message.failed` 等更新 UI。 |
| **协议** | 请求 = `message.request`（POST body）；响应 = 同一 SSE 流上的 NCP 事件，无需再定义一套「chat API」格式。 |

这样就是一个可落地的、前后端分离的 Agent 场景：后端只依赖 NCP 事件形态和端点抽象，前端只依赖同一套事件类型解析 SSE，便于和现有 NextClaw 后端/前端逐步对齐。
