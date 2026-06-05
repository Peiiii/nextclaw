# @nextclaw/client-sdk

NextClaw Client SDK 提供会话、Agent Run、资产、实时事件等标准客户端能力。

Panel App 中真正对外的运行时入口是宿主同步注入的 `window.nextclaw.client`。开发期可以安装本包读取类型，运行期不要在 Panel App 里 import、new 或 create SDK 实例。

## Panel App Type Setup

现代 React/Vite/TypeScript Panel App 可以把本包作为 dev dependency：

```bash
pnpm add -D @nextclaw/client-sdk
```

在应用源码里声明注入 namespace：

```ts
import type { NextClawAppClient } from "@nextclaw/client-sdk";

declare global {
  interface Window {
    nextclaw?: {
      client?: NextClawAppClient;
    } & Record<string, unknown>;
  }
}

export {};
```

运行时代码只读取宿主注入对象：

```ts
const client = window.nextclaw?.client;
if (!client) {
  throw new Error("NextClaw App Client 未授权或不可用。");
}
```

## App Client API Map

`NextClawAppClient` 是底层 `NextClawClient` 的薄投影，不重写函数、不包装函数，只重组 namespace：

```ts
export function createNextClawAppClient(hostClient: NextClawClient) {
  return {
    sessions: {
      list: hostClient.sessions.list,
      get: hostClient.sessions.get,
      listMessages: hostClient.sessions.listMessages,
    },
    agents: {
      list: hostClient.agents.list,
      resolveAvatarUrl: hostClient.agents.resolveAvatarUrl,
    },
    agentRuns: {
      send: hostClient.agentRuns.send,
      stream: hostClient.agentRuns.stream,
      abort: hostClient.agentRuns.abort,
    },
    serviceActions: {
      list: hostClient.serviceApps.listServiceActions,
      invoke: hostClient.serviceApps.invokeServiceAction,
    },
    assets: {
      upload: hostClient.sessions.uploadAssets,
    },
    events: {
      subscribe: hostClient.realtime.subscribe,
    },
  };
}
```

- `sessions.list()`
- `sessions.get()`
- `sessions.listMessages()`
- `agents.list()`
- `agents.resolveAvatarUrl()`
- `agentRuns.send()`
- `agentRuns.stream()`
- `agentRuns.abort()`
- `serviceActions.list()`
- `serviceActions.invoke()`
- `assets.upload()`
- `events.subscribe()`

参数和返回值以本包导出的 TypeScript 声明为准，优先查看 `NextClawAppClient`、`AgentRunSendIngressPayload`、`NcpStreamRequestPayload`、`NcpEndpointEvent` 等类型。

## Usage Contracts

- `sessions.*` 读取 NextClaw 会话与消息事实源。页面刷新、流式事件丢失、或需要展示最终回复时，用 `sessions.listMessages(sessionId)` 恢复。
- `agents.*` 读取 Agent 列表和头像资源地址。
- `agentRuns.send()` 触发一次 Agent Run，返回 run handle；它不等价于“发送并直接返回完整回复文本”。
- `agentRuns.stream()` 监听指定会话的 NCP endpoint event。handler 收到的是原始 NCP event，事件名以 `@nextclaw/ncp` 类型声明为准，例如 `message.text-delta`、`message.completed`、`message.failed`、`run.finished`、`run.error`。
- `agentRuns.abort()` 中止指定 run/session。
- `events.subscribe()` 是全局 realtime 订阅，返回 `{ close() }`。它收到连接事件或 AppEvent；NCP 事件通常在 `event.type === "ncp.event"` 的 `event.payload` 里。不要把它和 `agentRuns.stream()` 混用。
- `assets.upload()` 上传会话资产。
- `serviceActions.*` 是标准 client projection。Panel App 里如果需要旧 bridge 的授权确认和自动 retry 体验，仍优先使用宿主注入的 `window.nextclaw.serviceActions.*`。

## Panel App Runtime Rules

- `window.nextclaw.client` 同步可用；如果不存在，说明 manifest 未声明 `client: true`、用户未授权，或宿主版本不支持。
- 不要保存 SDK token，不要自己构造 auth header，不要直接请求 NextClaw gateway。
- 不要使用 `localStorage`、`sessionStorage`、cookie、IndexedDB 或默认启用浏览器持久化的状态库插件保存 NextClaw 会话数据。NextClaw 是会话、消息、Agent Run、实时事件和资产的事实源。
- 不要假设 `panelApps.*`、`serviceApps.*`、`config.*`、`runtimeControl.*` 等 host/admin namespace 存在于 `window.nextclaw.client`。
